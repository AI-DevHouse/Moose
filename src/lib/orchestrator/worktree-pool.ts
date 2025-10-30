// Worktree Pool Manager - Manages isolated git worktrees for concurrent WO execution
// Eliminates file-level race conditions by providing dedicated working directories

import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import type { Project } from '@/lib/project-service';
import type { WorktreeHandle, WorktreePoolStatus } from './types';

const execAsync = promisify(exec);

interface WorktreeInfo {
  id: string;
  path: string;
  project_id: string;
  created_at: Date;
  last_used_at: Date | null;
  npm_installed: boolean;
}

/**
 * WorktreePoolManager
 *
 * Manages a pool of isolated git worktrees for concurrent work order execution.
 * Each worktree has its own working directory and node_modules, preventing
 * file-level race conditions between concurrent Aider executions.
 *
 * Architecture:
 * - N worktrees created at initialization (default: 15)
 * - Blocking queue: WOs wait if pool is exhausted
 * - Cleanup on release: reset to main, delete branches, stash changes
 *
 * Usage:
 *   const pool = WorktreePoolManager.getInstance();
 *   await pool.initialize(project, 15);
 *
 *   const handle = await pool.leaseWorktree(workOrderId);
 *   try {
 *     // Execute Aider in handle.path
 *   } finally {
 *     await pool.releaseWorktree(handle);
 *   }
 */
export class WorktreePoolManager {
  private static instance: WorktreePoolManager;

  // Pool state
  private availableWorktrees: WorktreeHandle[] = [];
  private leasedWorktrees: Map<string, WorktreeHandle> = new Map();
  private worktreeMetadata: Map<string, WorktreeInfo> = new Map();
  private waitQueue: Array<{
    workOrderId: string;
    resolve: (handle: WorktreeHandle) => void;
    reject: (error: Error) => void;
  }> = [];

  // Configuration
  private project: Project | null = null;
  private poolSize: number = 0;
  private enabled: boolean = false;

  // Synchronization for npm install optimization
  private firstWorktreeNodeModulesPath: Promise<string> | null = null;
  private resolveFirstWorktreeNodeModulesPath: ((path: string) => void) | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): WorktreePoolManager {
    if (!WorktreePoolManager.instance) {
      WorktreePoolManager.instance = new WorktreePoolManager();
    }
    return WorktreePoolManager.instance;
  }

  /**
   * Initialize worktree pool
   *
   * Creates N worktrees in parallel directories, runs npm install in each,
   * and adds them to the available pool.
   *
   * @param project - Target project (contains local_path to main repo)
   * @param poolSize - Number of worktrees to create (default: 15)
   * @throws Error if initialization fails
   */
  async initialize(project: Project, poolSize: number = 15): Promise<void> {
    console.log(`[WorktreePool] Initializing pool with ${poolSize} worktrees...`);

    this.project = project;
    this.poolSize = poolSize;
    this.enabled = process.env.WORKTREE_POOL_ENABLED !== 'false';

    if (!this.enabled) {
      console.log('[WorktreePool] Worktree pool disabled via WORKTREE_POOL_ENABLED=false');
      return;
    }

    // Verify main repo exists and is a git repository
    if (!fs.existsSync(project.local_path)) {
      throw new Error(`Project directory not found: ${project.local_path}`);
    }

    const gitDir = path.join(project.local_path, '.git');
    if (!fs.existsSync(gitDir)) {
      throw new Error(`Not a git repository: ${project.local_path}`);
    }

    // Clean up stale worktrees only if explicitly enabled
    // Set WORKTREE_CLEANUP_ON_STARTUP=true to force cleanup
    // By default, we reuse existing worktrees for speed
    if (process.env.WORKTREE_CLEANUP_ON_STARTUP === 'true') {
      console.log('[WorktreePool] WORKTREE_CLEANUP_ON_STARTUP=true, removing all existing worktrees...');
      await this.cleanupStaleWorktrees();
    } else {
      console.log('[WorktreePool] Reusing existing worktrees if available (set WORKTREE_CLEANUP_ON_STARTUP=true to force cleanup)');
    }

    // Always prune stale worktree metadata before initialization
    // This ensures Git's worktree registry is clean even if directories were manually deleted
    console.log('[WorktreePool] Pruning stale worktree metadata...');
    try {
      execSync('git worktree prune', {
        cwd: this.project!.local_path,
        stdio: 'pipe'
      });
      console.log('[WorktreePool] Worktree metadata pruned successfully');
    } catch (error: any) {
      console.warn(`[WorktreePool] Failed to prune worktree metadata: ${error.message}`);
      // Non-fatal - continue with initialization
    }

    // Set up promise for first worktree's node_modules (for optimization)
    this.firstWorktreeNodeModulesPath = new Promise<string>((resolve) => {
      this.resolveFirstWorktreeNodeModulesPath = resolve;
    });

    // Create worktrees in parallel
    const worktreePromises: Promise<void>[] = [];
    for (let i = 1; i <= poolSize; i++) {
      worktreePromises.push(this.createWorktree(i));
    }

    try {
      await Promise.all(worktreePromises);
      console.log(`[WorktreePool] Successfully initialized ${this.availableWorktrees.length}/${poolSize} worktrees`);
    } catch (error: any) {
      console.error('[WorktreePool] Initialization failed:', error.message);
      // Cleanup partially created worktrees
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Create a single worktree (or reuse if already exists)
   *
   * @param index - Worktree index (1-based)
   */
  private async createWorktree(index: number): Promise<void> {
    const worktreeId = `wt-${index}`;

    // Extract project name from local_path
    // e.g., "C:\dev\multi-llm-discussion-v1" -> "multi-llm-discussion-v1"
    const projectName = path.basename(this.project!.local_path);
    const worktreePath = path.join(
      path.dirname(this.project!.local_path),
      `${projectName}-${worktreeId}`
    );

    console.log(`[WorktreePool] Initializing ${worktreeId} at ${worktreePath}...`);

    try {
      let needsWorktreeCreation = false;
      let needsNpmInstall = false;

      // Check if worktree already exists (from previous run)
      if (fs.existsSync(worktreePath)) {
        console.log(`[WorktreePool] ${worktreeId} already exists, checking if reusable...`);

        // Check if it's a valid git worktree
        const isValidWorktree = fs.existsSync(path.join(worktreePath, '.git'));
        const hasNodeModules = fs.existsSync(path.join(worktreePath, 'node_modules'));

        if (isValidWorktree) {
          console.log(`[WorktreePool] ${worktreeId} is valid worktree, cleaning and reusing...`);

          // Clean the existing worktree instead of deleting it
          try {
            // Detach HEAD to avoid branch conflicts
            execSync('git checkout --detach origin/main', {
              cwd: worktreePath,
              stdio: 'pipe',
              encoding: 'utf-8'
            });

            // Delete all feature branches
            const branches = execSync('git branch', {
              cwd: worktreePath,
              encoding: 'utf-8'
            }).split('\n');

            for (const branch of branches) {
              const trimmed = branch.trim().replace(/^\*\s+/, '');
              if (trimmed && trimmed !== 'main' && !trimmed.startsWith('(')) {
                try {
                  execSync(`git branch -D ${trimmed}`, {
                    cwd: worktreePath,
                    stdio: 'pipe'
                  });
                } catch (e) {}
              }
            }

            // Reset to clean state
            execSync('git reset --hard HEAD', { cwd: worktreePath, stdio: 'pipe' });
            execSync('git clean -fd', { cwd: worktreePath, stdio: 'pipe' });

            console.log(`[WorktreePool] ${worktreeId} cleaned and ready for reuse`);

            // If node_modules missing, mark for npm install (but worktree itself is reused)
            if (!hasNodeModules) {
              needsNpmInstall = true;
            }
          } catch (cleanError: any) {
            console.warn(`[WorktreePool] Failed to clean ${worktreeId}, recreating: ${cleanError.message}`);
            await this.removeWorktree(worktreePath, worktreeId);
            needsWorktreeCreation = true;
            needsNpmInstall = true;
          }
        } else {
          console.log(`[WorktreePool] ${worktreeId} is invalid, removing and recreating...`);
          await this.removeWorktree(worktreePath, worktreeId);
          needsWorktreeCreation = true;
          needsNpmInstall = true;
        }
      } else {
        needsWorktreeCreation = true;
        needsNpmInstall = true;
      }

      // Create worktree if it doesn't exist
      if (needsWorktreeCreation) {
        console.log(`[WorktreePool] Creating new ${worktreeId}...`);
        // Create worktree at main's commit (detached HEAD to avoid branch conflicts)
        execSync(`git worktree add --detach "${worktreePath}" main`, {
          cwd: this.project!.local_path,
          stdio: 'pipe',
          encoding: 'utf-8'
        });
      }

      // Install dependencies: wt-1 does full npm install, wt-2+ copy from wt-1
      // Skip if node_modules already exists and worktree was reused
      const nodeModulesPath = path.join(worktreePath, 'node_modules');
      const hasNodeModules = fs.existsSync(nodeModulesPath);

      if (hasNodeModules && !needsNpmInstall) {
        // Reused worktree with existing node_modules
        console.log(`[WorktreePool] ${worktreeId} reusing existing node_modules`);

        // If this is wt-1, signal that node_modules is ready for other worktrees
        if (index === 1 && this.resolveFirstWorktreeNodeModulesPath) {
          this.resolveFirstWorktreeNodeModulesPath(nodeModulesPath);
        }
      } else {
        // Need to install or copy node_modules
        // Check if package.json exists first (skip for greenfield projects)
        const packageJsonPath = path.join(worktreePath, 'package.json');
        const hasPackageJson = fs.existsSync(packageJsonPath);

        if (!hasPackageJson) {
          console.log(`[WorktreePool] ${worktreeId} has no package.json, skipping npm install (greenfield project)`);

          // For wt-1, signal empty node_modules path (worktrees will be usable without dependencies)
          if (index === 1 && this.resolveFirstWorktreeNodeModulesPath) {
            this.resolveFirstWorktreeNodeModulesPath(nodeModulesPath); // Signal even though it doesn't exist
          }
        } else {
          // Package.json exists, proceed with npm install/copy
          const npmInstallStart = Date.now();

          if (index === 1) {
            // First worktree: Run full npm install
            console.log(`[WorktreePool] ${worktreeId} running npm install --legacy-peer-deps...`);
            execSync('npm install --legacy-peer-deps', {
              cwd: worktreePath,
              stdio: 'pipe',
              encoding: 'utf-8'
            });

            const npmInstallDuration = Date.now() - npmInstallStart;
            console.log(`[WorktreePool] ${worktreeId} npm install completed in ${npmInstallDuration}ms`);

            // Signal that node_modules is ready for copying
            if (this.resolveFirstWorktreeNodeModulesPath) {
              this.resolveFirstWorktreeNodeModulesPath(nodeModulesPath);
            }
          } else {
            // Subsequent worktrees: Wait for wt-1 and copy node_modules
            console.log(`[WorktreePool] ${worktreeId} waiting for wt-1 node_modules...`);
            const sourceNodeModules = await this.firstWorktreeNodeModulesPath!;

            const copyStart = Date.now();
            console.log(`[WorktreePool] ${worktreeId} copying node_modules from wt-1...`);

            const targetNodeModules = path.join(worktreePath, 'node_modules');
            await this.copyDirectory(sourceNodeModules, targetNodeModules);

            const copyDuration = Date.now() - copyStart;
            const totalDuration = Date.now() - npmInstallStart;
            console.log(`[WorktreePool] ${worktreeId} node_modules copied in ${copyDuration}ms (total: ${totalDuration}ms)`);
          }
        }
      }

      // Create handle and metadata
      const handle: WorktreeHandle = {
        id: worktreeId,
        path: worktreePath,
        project_id: this.project!.id,
        leased_to: null,
        leased_at: null
      };

      const metadata: WorktreeInfo = {
        id: worktreeId,
        path: worktreePath,
        project_id: this.project!.id,
        created_at: new Date(),
        last_used_at: null,
        npm_installed: true
      };

      // Add to available pool
      this.availableWorktrees.push(handle);
      this.worktreeMetadata.set(worktreeId, metadata);

    } catch (error: any) {
      console.error(`[WorktreePool] Failed to create ${worktreeId}:`, error.message);
      throw new Error(`Worktree ${worktreeId} creation failed: ${error.message}`);
    }
  }

  /**
   * Lease a worktree for a work order
   *
   * If no worktrees are available, the request is queued and will be fulfilled
   * when a worktree is released.
   *
   * @param workOrderId - Work order ID requesting the worktree
   * @returns WorktreeHandle with path and metadata
   */
  async leaseWorktree(workOrderId: string): Promise<WorktreeHandle> {
    if (!this.enabled) {
      throw new Error('Worktree pool is disabled');
    }

    console.log(`[WorktreePool] Lease requested for WO ${workOrderId.slice(0, 8)}...`);

    // If worktrees are available, lease immediately
    if (this.availableWorktrees.length > 0) {
      const handle = this.availableWorktrees.shift()!;
      handle.leased_to = workOrderId;
      handle.leased_at = new Date();

      this.leasedWorktrees.set(workOrderId, handle);

      const metadata = this.worktreeMetadata.get(handle.id);
      if (metadata) {
        metadata.last_used_at = new Date();
      }

      console.log(`[WorktreePool] Leased ${handle.id} to WO ${workOrderId.slice(0, 8)} (available: ${this.availableWorktrees.length})`);

      return handle;
    }

    // No worktrees available - queue the request
    console.log(`[WorktreePool] Pool exhausted, queueing WO ${workOrderId.slice(0, 8)} (queue: ${this.waitQueue.length + 1})`);

    return new Promise<WorktreeHandle>((resolve, reject) => {
      this.waitQueue.push({ workOrderId, resolve, reject });
    });
  }

  /**
   * Release a worktree back to the pool
   *
   * Cleanup steps:
   * 1. Checkout main branch
   * 2. Delete feature branches
   * 3. Discard uncommitted changes
   * 4. Pull latest main
   * 5. Return to available pool or fulfill queued request
   *
   * @param handle - Worktree handle to release
   */
  async releaseWorktree(handle: WorktreeHandle): Promise<void> {
    console.log(`[WorktreePool] Releasing ${handle.id} from WO ${handle.leased_to?.slice(0, 8)}...`);

    try {
      // Run cleanup in worktree
      await this.cleanupWorktree(handle);

      // Remove from leased map
      if (handle.leased_to) {
        this.leasedWorktrees.delete(handle.leased_to);
      }

      // Reset handle
      handle.leased_to = null;
      handle.leased_at = null;

      // If there are queued requests, fulfill the first one
      if (this.waitQueue.length > 0) {
        const queued = this.waitQueue.shift()!;

        handle.leased_to = queued.workOrderId;
        handle.leased_at = new Date();
        this.leasedWorktrees.set(queued.workOrderId, handle);

        const metadata = this.worktreeMetadata.get(handle.id);
        if (metadata) {
          metadata.last_used_at = new Date();
        }

        console.log(`[WorktreePool] ${handle.id} leased to queued WO ${queued.workOrderId.slice(0, 8)} (queue: ${this.waitQueue.length})`);
        queued.resolve(handle);
      } else {
        // Return to available pool
        this.availableWorktrees.push(handle);
        console.log(`[WorktreePool] ${handle.id} returned to pool (available: ${this.availableWorktrees.length})`);
      }

    } catch (error: any) {
      console.error(`[WorktreePool] Failed to release ${handle.id}:`, error.message);
      // Still remove from leased map to avoid leaks
      if (handle.leased_to) {
        this.leasedWorktrees.delete(handle.leased_to);
      }
      throw error;
    }
  }

  /**
   * Cleanup a worktree after use
   *
   * @param handle - Worktree to clean
   */
  private async cleanupWorktree(handle: WorktreeHandle): Promise<void> {
    const cleanupStart = Date.now();

    try {
      // 1. Checkout main commit (detached HEAD to avoid branch conflicts)
      try {
        execSync('git checkout --detach origin/main', {
          cwd: handle.path,
          stdio: 'pipe',
          encoding: 'utf-8'
        });
      } catch (error: any) {
        // If origin/main doesn't exist, try main
        try {
          execSync('git checkout --detach main', {
            cwd: handle.path,
            stdio: 'pipe',
            encoding: 'utf-8'
          });
        } catch (error2: any) {
          console.warn(`[WorktreePool] Failed to checkout main in ${handle.id}: ${error2.message}`);
        }
      }

      // 2. Delete all feature branches
      try {
        const branches = execSync('git branch', {
          cwd: handle.path,
          encoding: 'utf-8'
        }).split('\n');

        for (const branch of branches) {
          const trimmed = branch.trim().replace(/^\*\s+/, '');
          if (trimmed && trimmed !== 'main' && !trimmed.startsWith('(')) {
            try {
              execSync(`git branch -D ${trimmed}`, {
                cwd: handle.path,
                stdio: 'pipe'
              });
            } catch (e) {
              // Branch might not exist or already deleted
            }
          }
        }
      } catch (error: any) {
        console.warn(`[WorktreePool] Failed to delete branches in ${handle.id}: ${error.message}`);
      }

      // 3. Discard uncommitted changes
      try {
        execSync('git reset --hard HEAD', {
          cwd: handle.path,
          stdio: 'pipe'
        });
        execSync('git clean -fd', {
          cwd: handle.path,
          stdio: 'pipe'
        });
      } catch (error: any) {
        console.warn(`[WorktreePool] Failed to reset ${handle.id}: ${error.message}`);
      }

      // 4. Pull latest main (optional - could skip for speed)
      try {
        execSync('git pull origin main', {
          cwd: handle.path,
          stdio: 'pipe',
          timeout: 30000 // 30s timeout
        });
      } catch (error: any) {
        // Pull might fail if offline or no changes - that's okay
        console.warn(`[WorktreePool] Failed to pull main in ${handle.id}: ${error.message}`);
      }

      // 5. Check if dependencies need to be installed after pull
      // This handles the greenfield → established project transition (e.g., after bootstrap WO merges)
      const packageJsonPath = path.join(handle.path, 'package.json');
      const nodeModulesPath = path.join(handle.path, 'node_modules');
      const hasPackageJson = fs.existsSync(packageJsonPath);
      const hasNodeModules = fs.existsSync(nodeModulesPath);

      if (hasPackageJson && !hasNodeModules) {
        console.log(`[WorktreePool] ${handle.id} detected new package.json, running npm install --legacy-peer-deps...`);
        try {
          const npmStart = Date.now();
          execSync('npm install --legacy-peer-deps', {
            cwd: handle.path,
            stdio: 'pipe',
            encoding: 'utf-8',
            timeout: 300000 // 5min timeout for npm install
          });
          const npmDuration = Date.now() - npmStart;
          console.log(`[WorktreePool] ${handle.id} npm install completed in ${npmDuration}ms`);

          // Update metadata to reflect npm install
          const metadata = this.worktreeMetadata.get(handle.id);
          if (metadata) {
            metadata.npm_installed = true;
          }
        } catch (error: any) {
          console.error(`[WorktreePool] Failed to install dependencies in ${handle.id}:`, error.message);
          // Non-fatal - continue cleanup, but next WO might fail
        }
      }

      const cleanupDuration = Date.now() - cleanupStart;
      console.log(`[WorktreePool] ${handle.id} cleanup completed in ${cleanupDuration}ms`);

    } catch (error: any) {
      console.error(`[WorktreePool] Cleanup failed for ${handle.id}:`, error.message);
      throw error;
    }
  }

  /**
   * Get current pool status
   */
  getStatus(): WorktreePoolStatus {
    return {
      total: this.poolSize,
      available: this.availableWorktrees.length,
      leased: this.leasedWorktrees.size,
      waiters: this.waitQueue.length,
      leasedWorktrees: new Map(this.leasedWorktrees)
    };
  }

  /**
   * Cleanup all worktrees and reset pool state
   *
   * Called on orchestrator shutdown or pool reinitialization.
   */
  async cleanup(): Promise<void> {
    console.log('[WorktreePool] Cleaning up all worktrees...');

    if (!this.project) {
      console.log('[WorktreePool] No project initialized, nothing to cleanup');
      return;
    }

    // Reject all queued requests
    for (const queued of this.waitQueue) {
      queued.reject(new Error('Worktree pool is shutting down'));
    }
    this.waitQueue = [];

    // Remove all worktrees
    const allWorktrees = [
      ...this.availableWorktrees,
      ...Array.from(this.leasedWorktrees.values())
    ];

    for (const handle of allWorktrees) {
      try {
        await this.removeWorktree(handle.path, handle.id);
      } catch (error: any) {
        console.error(`[WorktreePool] Failed to remove ${handle.id}:`, error.message);
      }
    }

    // Reset state
    this.availableWorktrees = [];
    this.leasedWorktrees.clear();
    this.worktreeMetadata.clear();
    this.firstWorktreeNodeModulesPath = null;
    this.resolveFirstWorktreeNodeModulesPath = null;

    console.log('[WorktreePool] Cleanup complete');
  }

  /**
   * Recursively copy directory using native OS commands for performance
   *
   * @param source - Source directory path
   * @param target - Target directory path
   */
  private async copyDirectory(source: string, target: string): Promise<void> {
    // Use native OS commands for much faster bulk copying
    if (process.platform === 'win32') {
      // Windows: Use robocopy (much faster than file-by-file copy)
      // /E = copy subdirectories including empty ones
      // /NFL = no file list (less verbose)
      // /NDL = no directory list
      // /NJH = no job header
      // /NJS = no job summary
      // /NC = no class
      // /NS = no size
      // /NP = no progress
      // Note: robocopy exit codes 0-7 are success (8+ are errors)
      try {
        execSync(`robocopy "${source}" "${target}" /E /NFL /NDL /NJH /NJS /NC /NS /NP`, {
          stdio: 'pipe',
          encoding: 'utf-8'
        });
      } catch (error: any) {
        // robocopy returns exit code 1 for successful copy with files copied
        // Only throw if exit code is 8 or higher (actual errors)
        if (error.status && error.status >= 8) {
          throw new Error(`Failed to copy directory: ${error.message}`);
        }
      }
    } else {
      // Unix/Linux/Mac: Use cp command
      execSync(`cp -r "${source}" "${target}"`, {
        stdio: 'pipe',
        encoding: 'utf-8'
      });
    }
  }

  /**
   * Remove a worktree
   *
   * @param worktreePath - Path to worktree directory
   * @param worktreeId - Worktree ID for logging
   */
  private async removeWorktree(worktreePath: string, worktreeId: string): Promise<void> {
    try {
      // Try git worktree remove first (cleanest)
      execSync(`git worktree remove "${worktreePath}" --force`, {
        cwd: this.project!.local_path,
        stdio: 'pipe'
      });
      console.log(`[WorktreePool] Removed ${worktreeId} via git worktree remove`);
    } catch (error: any) {
      // If git worktree remove fails, manually delete directory
      console.warn(`[WorktreePool] git worktree remove failed for ${worktreeId}, deleting directory...`);
      try {
        if (fs.existsSync(worktreePath)) {
          fs.rmSync(worktreePath, { recursive: true, force: true });
        }
        // Also prune the worktree from git's records
        execSync('git worktree prune', {
          cwd: this.project!.local_path,
          stdio: 'pipe'
        });
        console.log(`[WorktreePool] Manually removed ${worktreeId}`);
      } catch (cleanupError: any) {
        console.error(`[WorktreePool] Failed to cleanup ${worktreeId}:`, cleanupError.message);
        throw cleanupError;
      }
    }
  }

  /**
   * Clean up stale worktrees from previous runs
   * Only called when WORKTREE_CLEANUP_ON_STARTUP=true
   */
  private async cleanupStaleWorktrees(): Promise<void> {
    console.log('[WorktreePool] Cleaning up all existing worktrees...');

    try {
      // List all worktrees
      const output = execSync('git worktree list', {
        cwd: this.project!.local_path,
        encoding: 'utf-8'
      });

      const lines = output.split('\n');
      const projectName = path.basename(this.project!.local_path);

      for (const line of lines) {
        // Look for worktrees matching our naming pattern
        if (line.includes(`${projectName}-wt-`)) {
          const match = line.match(/^(.+?)\s+/);
          if (match) {
            const worktreePath = match[1].trim();
            const worktreeId = worktreePath.match(/wt-\d+/)?.[0] || 'unknown';
            console.log(`[WorktreePool] Found stale worktree ${worktreeId}, removing...`);
            await this.removeWorktree(worktreePath, worktreeId);
          }
        }
      }
    } catch (error: any) {
      // If git worktree list fails, that's okay (might be no worktrees)
      console.log('[WorktreePool] No stale worktrees found');
    }
  }

  /**
   * Check if pool is enabled
   */
  isEnabled(): boolean {
    // Check environment variable directly since this may be called before initialize()
    return process.env.WORKTREE_POOL_ENABLED !== 'false';
  }
}
