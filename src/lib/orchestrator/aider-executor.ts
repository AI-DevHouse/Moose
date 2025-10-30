// Aider Executor - Spawns Aider CLI to apply code changes

import { spawn } from 'child_process';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { handleCriticalError } from '@/lib/error-escalation';
import { proposerRegistry } from '@/lib/proposer-registry';
import { validateWorkOrderSafety } from './project-safety';
import { projectService } from '@/lib/project-service';
import { projectValidator } from '@/lib/project-validator';
import { createSupabaseServiceClient } from '@/lib/supabase';
import type { WorkOrder, AiderResult } from './types';

/**
 * Build comprehensive prompt from Work Order requirements
 *
 * Generates natural language instructions for Aider based on:
 * - WO description and acceptance criteria
 * - Technical requirements (dependencies, config)
 * - Dependencies (if any)
 *
 * @param wo - Work Order
 * @returns Comprehensive prompt string
 */
function buildAiderPrompt(wo: WorkOrder): string {
  const instructionParts = [];

  // Header
  instructionParts.push(`# Work Order: ${wo.title}`);
  instructionParts.push(`ID: ${wo.id}`);
  instructionParts.push('');

  // Task description
  instructionParts.push('## Task Description');
  instructionParts.push(wo.description);
  instructionParts.push('');

  // Acceptance criteria
  if (wo.acceptance_criteria && wo.acceptance_criteria.length > 0) {
    instructionParts.push('## Acceptance Criteria');
    instructionParts.push('The implementation MUST satisfy all of the following:');
    wo.acceptance_criteria.forEach((ac, i) => {
      instructionParts.push(`${i + 1}. ${ac}`);
    });
    instructionParts.push('');
  }

  // Technical requirements
  if (wo.technical_requirements) {
    const techReq = wo.technical_requirements;

    if (techReq.npm_dependencies && techReq.npm_dependencies.length > 0) {
      instructionParts.push('## Required NPM Dependencies');
      techReq.npm_dependencies.forEach(dep => {
        instructionParts.push(`- ${dep}`);
      });
      instructionParts.push('');
    }

    if (techReq.npm_dev_dependencies && techReq.npm_dev_dependencies.length > 0) {
      instructionParts.push('## Required Dev Dependencies');
      techReq.npm_dev_dependencies.forEach(dep => {
        instructionParts.push(`- ${dep}`);
      });
      instructionParts.push('');
    }

    if (techReq.environment_variables && techReq.environment_variables.length > 0) {
      instructionParts.push('## Environment Variables Required');
      techReq.environment_variables.forEach(envVar => {
        instructionParts.push(`- ${envVar}`);
      });
      instructionParts.push('');
    }
  }

  // Files in scope
  if (wo.files_in_scope && wo.files_in_scope.length > 0) {
    instructionParts.push('## Files in Scope');
    wo.files_in_scope.forEach(f => {
      instructionParts.push(`- ${f}`);
    });
    instructionParts.push('');
  }

  // Implementation instructions
  instructionParts.push('## Implementation Instructions');
  instructionParts.push('1. Analyze the task description and acceptance criteria carefully');
  instructionParts.push('2. Create or modify the files listed in scope');
  instructionParts.push('3. Implement the solution that satisfies ALL acceptance criteria');
  instructionParts.push('4. Ensure TypeScript compilation succeeds with no errors');
  instructionParts.push('5. Follow best practices: type safety, error handling, clear naming');
  instructionParts.push('6. Commit changes with a descriptive message');
  instructionParts.push('');

  instructionParts.push('## Quality Standards');
  instructionParts.push('- All code must be valid TypeScript (no syntax errors)');
  instructionParts.push('- Use proper types (avoid `any` where possible)');
  instructionParts.push('- Handle edge cases and errors appropriately');
  instructionParts.push('- Write clear, self-documenting code');

  return instructionParts.join('\n');
}

/**
 * Create Aider instruction file from prompt
 */
function createInstructionFile(wo: WorkOrder, prompt: string): string {
  const tmpDir = os.tmpdir();
  const instructionPath = path.join(tmpDir, `wo-${wo.id}-instruction.txt`);
  fs.writeFileSync(instructionPath, prompt, 'utf-8');

  console.log(`[AiderExecutor] Created instruction file: ${instructionPath}`);

  return instructionPath;
}

/**
 * Create feature branch for Work Order
 *
 * @param wo - Work Order
 * @param workingDirectory - Directory to execute git commands in
 * @param baseBranch - Optional base branch to branch from (default: main)
 * @returns Branch name
 */
export async function createFeatureBranch(
  wo: WorkOrder,
  workingDirectory: string,
  baseBranch: string = 'main'
): Promise<string> {
  const slug = wo.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);

  const branchName = `feature/wo-${wo.id.substring(0, 8)}-${slug}`;

  console.log(`[AiderExecutor] Creating feature branch: ${branchName}`);
  console.log(`[AiderExecutor] Working directory: ${workingDirectory}`);

  try {
    // Get current branch for logging/debugging
    const currentBranch = execSync('git branch --show-current', {
      cwd: workingDirectory,
      encoding: 'utf-8'
    }).trim();

    console.log(`[AiderExecutor] Current branch before branching: ${currentBranch}`);

    // Check if branch already exists and delete it if needed
    try {
      const branchList = execSync('git branch --list', {
        cwd: workingDirectory,
        encoding: 'utf-8'
      });

      if (branchList.includes(branchName)) {
        console.log(`[AiderExecutor] Branch ${branchName} already exists, deleting it`);
        // Force delete the existing branch (no need to switch away first since we're in detached HEAD)
        execSync(`git branch -D ${branchName}`, { cwd: workingDirectory, stdio: 'pipe' });
        console.log(`[AiderExecutor] Deleted existing branch ${branchName}`);
      }
    } catch (error) {
      console.log(`[AiderExecutor] No existing branch to delete or error checking branches`);
    }

    // Create feature branch from base branch
    // If baseBranch is not main, fetch and checkout the base branch first
    if (baseBranch !== 'main') {
      console.log(`[AiderExecutor] Branching from dependency branch: ${baseBranch}`);

      // Fetch latest from remote to ensure we have the base branch
      try {
        execSync('git fetch origin', { cwd: workingDirectory, stdio: 'pipe' });
        console.log(`[AiderExecutor] Fetched latest from origin`);
      } catch (error) {
        console.warn(`[AiderExecutor] Warning: Could not fetch from origin`, error);
      }

      // Checkout the base branch (or track it from origin if it doesn't exist locally)
      try {
        execSync(`git checkout ${baseBranch}`, { cwd: workingDirectory, stdio: 'pipe' });
      } catch (error) {
        // If base branch doesn't exist locally, try origin/baseBranch
        console.log(`[AiderExecutor] Local branch ${baseBranch} not found, trying origin/${baseBranch}`);
        execSync(`git checkout -b ${baseBranch} origin/${baseBranch}`, { cwd: workingDirectory, stdio: 'pipe' });
      }

      console.log(`[AiderExecutor] Checked out base branch: ${baseBranch}`);
    } else {
      // Worktrees are created with --detach flag, so HEAD is already at main's commit
      // No need to checkout main (which would fail since main is locked by parent worktree)
      console.log(`[AiderExecutor] Creating feature branch from current HEAD (detached at main)`);
    }

    execSync(`git checkout -b ${branchName}`, { cwd: workingDirectory, stdio: 'pipe' });

    console.log(`[AiderExecutor] Feature branch created successfully`);
    return branchName;
  } catch (error: any) {
    await handleCriticalError({
      component: 'AiderExecutor',
      operation: 'createFeatureBranch',
      error: error,
      workOrderId: wo.id,
      severity: 'critical',
      metadata: { branchName, workingDirectory }
    });
    throw new Error(`Failed to create feature branch: ${error.message}`);
  }
}

/**
 * Get base branch for work order (from dependencies)
 *
 * If the work order has dependencies, returns the github_branch of the first dependency.
 * Otherwise returns 'main'.
 *
 * @param wo - Work Order
 * @returns Base branch name (default: 'main')
 */
async function getBaseBranchForWorkOrder(wo: WorkOrder): Promise<string> {
  const metadata = wo.metadata || {};
  const dependencies = metadata.dependencies || [];

  // If no dependencies, branch from main
  if (!Array.isArray(dependencies) || dependencies.length === 0) {
    return 'main';
  }

  // Get the first dependency's branch name
  const dependencyId = dependencies[0];
  console.log(`[AiderExecutor] WO ${wo.id} depends on ${dependencyId}, fetching its branch`);

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from('work_orders')
      .select('github_branch')
      .eq('id', dependencyId)
      .single();

    if (error || !data) {
      console.warn(`[AiderExecutor] Could not fetch dependency ${dependencyId} branch, defaulting to main`);
      return 'main';
    }

    const dependencyBranch = data.github_branch;

    if (!dependencyBranch) {
      console.warn(`[AiderExecutor] Dependency ${dependencyId} has no github_branch set, defaulting to main`);
      return 'main';
    }

    console.log(`[AiderExecutor] Will branch from dependency branch: ${dependencyBranch}`);
    return dependencyBranch;
  } catch (error) {
    console.error(`[AiderExecutor] Error fetching dependency branch:`, error);
    return 'main';
  }
}

/**
 * Execute Aider CLI to apply code changes
 *
 * Prerequisites:
 * - Aider must be installed: pip install aider-chat
 * - ANTHROPIC_API_KEY or OPENAI_API_KEY in environment
 *
 * @param wo - Work Order
 * @param selectedProposer - Model selected by Manager
 * @param worktreePath - Optional worktree path (overrides project.local_path for concurrent execution)
 * @returns Aider execution result
 */
export async function executeAider(
  wo: WorkOrder,
  selectedProposer: string,
  worktreePath?: string
): Promise<AiderResult> {
  console.log(`[AiderExecutor] Starting direct Aider execution for WO ${wo.id}`);
  console.log(`[AiderExecutor] Using model: ${selectedProposer}`);

  // 0. SAFETY CHECK: Prevent self-modification
  validateWorkOrderSafety(wo.id, wo.project_id);

  // 1. Get and validate project (if project_id exists)
  let workingDirectory: string;

  if (worktreePath) {
    // Use worktree path if provided (from worktree pool)
    workingDirectory = worktreePath;
    console.log(`[AiderExecutor] Using worktree directory: ${workingDirectory}`);
  } else if (wo.project_id) {
    console.log(`[AiderExecutor] Work order linked to project: ${wo.project_id}`);

    // Validate project and get working directory
    const project = await projectValidator.validateOrThrow(wo.project_id);
    workingDirectory = project.local_path;

    console.log(`[AiderExecutor] Using project directory: ${workingDirectory}`);
  } else {
    // Default: current directory (for backward compatibility)
    workingDirectory = process.cwd();
    console.warn(
      `[AiderExecutor] ⚠️  Work order ${wo.id} has no project_id. ` +
      `Executing in current directory: ${workingDirectory}`
    );
  }

  // 2. Build comprehensive prompt and create instruction file
  console.log(`[AiderExecutor] Building comprehensive prompt from WO requirements`);
  const prompt = buildAiderPrompt(wo);
  const instructionPath = createInstructionFile(wo, prompt);

  console.log(`[AiderExecutor] Prompt length: ${prompt.length} characters`);

  // 3. Determine base branch from dependencies
  const baseBranch = await getBaseBranchForWorkOrder(wo);

  // 4. Create feature branch from base branch
  const branchName = await createFeatureBranch(wo, workingDirectory, baseBranch);

  // 5. Lookup Aider model from ProposerRegistry (uses model field from database)
  await proposerRegistry.initialize();
  const proposerConfig = proposerRegistry.getProposer(selectedProposer);

  if (!proposerConfig) {
    throw new Error(`Proposer '${selectedProposer}' not found in registry`);
  }

  const aiderModel = proposerConfig.model; // Use model identifier from database (e.g., 'claude-sonnet-4-5-20250929')
  console.log(`[AiderExecutor] Using Aider model: ${aiderModel} (from proposer: ${selectedProposer})`);

  // 6. Build file list
  const files = wo.files_in_scope || [];
  if (files.length === 0) {
    throw new Error('files_in_scope is empty - cannot execute Aider without target files');
  }

  console.log(`[AiderExecutor] Executing Aider with model ${aiderModel} on ${files.length} files`);

  // 7. Set explicit Git environment variables for Aider (fix for Git detection in worktrees)
  // Issue: Worktrees have .git as a file (not directory) containing "gitdir: <path>"
  // Solution: Read .git file in worktrees to extract actual git directory path
  // These are standard Git environment variables that all Git tools respect
  // Important: Normalize paths to use forward slashes for Python/GitPython compatibility
  const gitFilePath = path.join(workingDirectory, '.git');
  let gitDir: string;

  if (fs.existsSync(gitFilePath) && fs.statSync(gitFilePath).isFile()) {
    // Worktree: .git is a file with "gitdir: <path>"
    const gitFileContent = fs.readFileSync(gitFilePath, 'utf-8').trim();
    const match = gitFileContent.match(/^gitdir:\s*(.+)$/);
    if (match) {
      gitDir = path.resolve(workingDirectory, match[1]).replace(/\\/g, '/');
      console.log(`[AiderExecutor] Detected worktree, resolved GIT_DIR from .git file`);
    } else {
      // Fallback if .git file format is unexpected
      gitDir = gitFilePath.replace(/\\/g, '/');
      console.warn(`[AiderExecutor] Unexpected .git file format, using as-is`);
    }
  } else {
    // Main repo: .git is a directory
    gitDir = gitFilePath.replace(/\\/g, '/');
    console.log(`[AiderExecutor] Detected main repository`);
  }

  const normalizedWorkingDir = workingDirectory.replace(/\\/g, '/');
  console.log(`[AiderExecutor] Setting GIT_DIR=${gitDir}, GIT_WORK_TREE=${normalizedWorkingDir}`);

  // 8. Spawn Aider process in project directory with Git detection retry logic
  // Note: With proper GIT_DIR resolution above, Git detection should now work reliably
  // Retry logic remains as a backup for edge cases
  return new Promise(async (resolve, reject) => {
    const aiderArgs = [
      '--message-file', instructionPath,
      '--model', aiderModel,
      '--yes',
      '--auto-commits',
      ...files
    ];

    console.log(`[AiderExecutor] Command: py -3.11 -m aider ${aiderArgs.join(' ')}`);

    let retryCount = 0;
    const maxRetries = 1; // Retry once if Git detection fails
    let gitDetectionFailed = false;

    // Configurable timeout (default: 10 minutes)
    // Can be increased for complex WOs via AIDER_TIMEOUT_MS env var
    const aiderTimeoutMs = parseInt(process.env.AIDER_TIMEOUT_MS || '600000', 10);
    console.log(`[AiderExecutor] Aider timeout set to ${aiderTimeoutMs}ms (${aiderTimeoutMs / 1000}s)`);

    const spawnAider = (): void => {
      // Use Python 3.11 to run Aider (installed via: py -3.11 -m pip install aider-chat)
      const aiderProcess = spawn('py', ['-3.11', '-m', 'aider', ...aiderArgs], {
        cwd: workingDirectory,  // Execute in project directory
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          GIT_DIR: gitDir,
          GIT_WORK_TREE: normalizedWorkingDir,
          PYTHONIOENCODING: 'utf-8'  // Fix Unicode encoding issues on Windows
        },
        timeout: aiderTimeoutMs
      });

      let stdout = '';
      let stderr = '';

      aiderProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('[Aider]', output);

        // Detect Git repo detection failure
        if (output.includes('Git repo: none')) {
          gitDetectionFailed = true;
          console.warn('[AiderExecutor] ⚠️  Git detection failed: "Git repo: none"');

          // Retry logic: Kill process and retry once after 5 seconds
          if (retryCount < maxRetries) {
            retryCount++; // Increment immediately when we decide to retry
            console.log(`[AiderExecutor] Retrying Aider execution (attempt ${retryCount + 1}/${maxRetries + 1}) after 5s delay...`);

            // Kill the current process
            aiderProcess.kill();

            // Wait 5 seconds and retry (allows git process to fully initialize)
            setTimeout(() => {
              gitDetectionFailed = false; // Reset flag
              spawnAider(); // Recursive retry
            }, 5000);
          }
        }
      });

      aiderProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.error('[Aider Error]', output);
      });

      aiderProcess.on('close', (code) => {
        // If we're retrying due to Git detection failure, don't clean up or resolve yet
        if (gitDetectionFailed && retryCount <= maxRetries) {
          return; // Let the retry logic handle it
        }

        // Clean up instruction file
        try {
          fs.unlinkSync(instructionPath);
        } catch (e) {
          console.warn('[AiderExecutor] Could not delete instruction file:', e);
        }

        if (code === 0) {
          console.log(`[AiderExecutor] Aider completed successfully for WO ${wo.id}`);
          resolve({
            success: true,
            branch_name: branchName,
            stdout,
            stderr
          });
        } else if (code === null) {
          // Exit code null = process killed by signal (timeout, OOM, external termination)
          console.error(`[AiderExecutor] Aider process terminated (exit code null) - likely timeout after ${aiderTimeoutMs / 1000}s`);
          const errorMsg = stderr.trim() || stdout.slice(-500).trim() || 'No output captured';
          reject(new Error(`Aider process terminated (likely timeout after ${aiderTimeoutMs / 1000}s). Last output: ${errorMsg}`));
        } else {
          console.error(`[AiderExecutor] Aider exited with code ${code}`);
          reject(new Error(`Aider exited with code ${code}: ${stderr}`));
        }
      });

      aiderProcess.on('error', (error) => {
        // If we're retrying due to Git detection failure, don't clean up or reject yet
        if (gitDetectionFailed && retryCount <= maxRetries) {
          return; // Let the retry logic handle it
        }

        // Clean up instruction file
        try {
          fs.unlinkSync(instructionPath);
        } catch (e) {
          console.warn('[AiderExecutor] Could not delete instruction file:', e);
        }

        if (error.message.includes('ENOENT')) {
          reject(new Error('Aider not found. Please install: py -3.11 -m pip install aider-chat'));
        } else {
          reject(error);
        }
      });
    };

    // Start the first attempt
    spawnAider();
  });
}

/**
 * Rollback failed Aider execution
 *
 * Deletes feature branch and returns to main
 *
 * @param branchName - Feature branch to delete
 */
export function rollbackAider(branchName: string): void {
  console.log(`[AiderExecutor] Rolling back branch: ${branchName}`);

  try {
    // Return to main
    try {
      execSync('git checkout main', { cwd: process.cwd(), stdio: 'pipe' });
    } catch {
      execSync('git checkout master', { cwd: process.cwd(), stdio: 'pipe' });
    }

    // Delete feature branch
    execSync(`git branch -D ${branchName}`, { cwd: process.cwd(), stdio: 'pipe' });

    console.log(`[AiderExecutor] Rollback successful`);
  } catch (error: any) {
    console.error('[AiderExecutor] Error during rollback:', error.message);
    // Don't throw - rollback is best-effort
  }
}
