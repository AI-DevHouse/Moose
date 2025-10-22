// src/lib/orchestrator/__tests__/worktree-pool.test.ts
// Unit tests for WorktreePoolManager

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorktreePoolManager } from '../worktree-pool';
import type { Project } from '@/lib/project-service';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
vi.mock('child_process');
vi.mock('fs');

describe('WorktreePoolManager', () => {
  let poolManager: WorktreePoolManager;
  let mockProject: Project;

  beforeEach(() => {
    // Reset singleton instance
    (WorktreePoolManager as any).instance = undefined;
    poolManager = WorktreePoolManager.getInstance();

    mockProject = {
      id: 'test-project-id',
      name: 'test-project',
      local_path: '/test/project/path',
      github_url: 'https://github.com/test/repo',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    } as Project;

    // Setup default mocks
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(child_process.execSync).mockReturnValue('');

    // Enable pool by default
    process.env.WORKTREE_POOL_ENABLED = 'true';
    process.env.WORKTREE_CLEANUP_ON_STARTUP = 'false'; // Skip cleanup for tests
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = WorktreePoolManager.getInstance();
      const instance2 = WorktreePoolManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('isEnabled', () => {
    it('should return true when WORKTREE_POOL_ENABLED is not set', () => {
      delete process.env.WORKTREE_POOL_ENABLED;

      expect(poolManager.isEnabled()).toBe(true);
    });

    it('should return false when WORKTREE_POOL_ENABLED is false', () => {
      process.env.WORKTREE_POOL_ENABLED = 'false';

      expect(poolManager.isEnabled()).toBe(false);
    });

    it('should return true when WORKTREE_POOL_ENABLED is true', () => {
      process.env.WORKTREE_POOL_ENABLED = 'true';

      expect(poolManager.isEnabled()).toBe(true);
    });
  });

  describe('initialize', () => {
    it('should throw error if project directory does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(poolManager.initialize(mockProject, 3)).rejects.toThrow(
        'Project directory not found'
      );
    });

    it('should throw error if directory is not a git repository', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return !String(p).includes('.git');
      });

      await expect(poolManager.initialize(mockProject, 3)).rejects.toThrow(
        'Not a git repository'
      );
    });

    it('should create specified number of worktrees', async () => {
      const poolSize = 3;
      let worktreeCreateCount = 0;

      vi.mocked(child_process.execSync).mockImplementation((cmd: any) => {
        const cmdStr = String(cmd);
        if (cmdStr.includes('git worktree add')) {
          worktreeCreateCount++;
        }
        return '';
      });

      await poolManager.initialize(mockProject, poolSize);

      expect(worktreeCreateCount).toBe(poolSize);
    });

    it('should run npm install in each worktree', async () => {
      const poolSize = 3;
      let npmInstallCount = 0;

      vi.mocked(child_process.execSync).mockImplementation((cmd: any) => {
        const cmdStr = String(cmd);
        if (cmdStr.includes('npm install')) {
          npmInstallCount++;
        }
        return '';
      });

      await poolManager.initialize(mockProject, poolSize);

      expect(npmInstallCount).toBe(poolSize);
    });

    it('should skip initialization if pool is disabled', async () => {
      process.env.WORKTREE_POOL_ENABLED = 'false';

      await poolManager.initialize(mockProject, 3);

      const status = poolManager.getStatus();
      expect(status.total).toBe(0);
    });

    it('should have all worktrees available after initialization', async () => {
      await poolManager.initialize(mockProject, 5);

      const status = poolManager.getStatus();
      expect(status.total).toBe(5);
      expect(status.available).toBe(5);
      expect(status.leased).toBe(0);
    });
  });

  describe('leaseWorktree', () => {
    beforeEach(async () => {
      await poolManager.initialize(mockProject, 3);
    });

    it('should lease a worktree when available', async () => {
      const handle = await poolManager.leaseWorktree('wo-test-1');

      expect(handle).toBeDefined();
      expect(handle.id).toMatch(/wt-\d+/);
      expect(handle.leased_to).toBe('wo-test-1');
      expect(handle.leased_at).toBeInstanceOf(Date);
    });

    it('should reduce available count after lease', async () => {
      const statusBefore = poolManager.getStatus();

      await poolManager.leaseWorktree('wo-test-1');

      const statusAfter = poolManager.getStatus();
      expect(statusAfter.available).toBe(statusBefore.available - 1);
      expect(statusAfter.leased).toBe(statusBefore.leased + 1);
    });

    it('should lease different worktrees for concurrent requests', async () => {
      const handle1 = await poolManager.leaseWorktree('wo-test-1');
      const handle2 = await poolManager.leaseWorktree('wo-test-2');

      expect(handle1.id).not.toBe(handle2.id);
      expect(handle1.leased_to).toBe('wo-test-1');
      expect(handle2.leased_to).toBe('wo-test-2');
    });

    it('should throw error if pool is disabled', async () => {
      process.env.WORKTREE_POOL_ENABLED = 'false';
      const disabledPool = WorktreePoolManager.getInstance();

      await expect(disabledPool.leaseWorktree('wo-test')).rejects.toThrow(
        'Worktree pool is disabled'
      );
    });

    it('should queue request when pool is exhausted', async () => {
      // Lease all 3 worktrees
      await poolManager.leaseWorktree('wo-1');
      await poolManager.leaseWorktree('wo-2');
      await poolManager.leaseWorktree('wo-3');

      // 4th request should be queued (promise not resolved yet)
      const leasePromise = poolManager.leaseWorktree('wo-4');

      const status = poolManager.getStatus();
      expect(status.available).toBe(0);
      expect(status.leased).toBe(3);
      expect(status.waiters).toBe(1);

      // Promise should still be pending
      const timeoutRace = Promise.race([
        leasePromise,
        new Promise((_, reject) => setTimeout(() => reject('timeout'), 100))
      ]);

      await expect(timeoutRace).rejects.toBe('timeout');
    });
  });

  describe('releaseWorktree', () => {
    beforeEach(async () => {
      await poolManager.initialize(mockProject, 3);
    });

    it('should return worktree to available pool', async () => {
      const handle = await poolManager.leaseWorktree('wo-test-1');

      await poolManager.releaseWorktree(handle);

      const status = poolManager.getStatus();
      expect(status.available).toBe(3);
      expect(status.leased).toBe(0);
    });

    it('should run cleanup commands on release', async () => {
      const handle = await poolManager.leaseWorktree('wo-test-1');

      let gitCheckoutCalled = false;
      let gitResetCalled = false;

      vi.mocked(child_process.execSync).mockImplementation((cmd: any) => {
        const cmdStr = String(cmd);
        if (cmdStr.includes('git checkout')) gitCheckoutCalled = true;
        if (cmdStr.includes('git reset')) gitResetCalled = true;
        return '';
      });

      await poolManager.releaseWorktree(handle);

      expect(gitCheckoutCalled).toBe(true);
      expect(gitResetCalled).toBe(true);
    });

    it('should reset handle properties on release', async () => {
      const handle = await poolManager.leaseWorktree('wo-test-1');

      expect(handle.leased_to).toBe('wo-test-1');
      expect(handle.leased_at).toBeInstanceOf(Date);

      await poolManager.releaseWorktree(handle);

      expect(handle.leased_to).toBeNull();
      expect(handle.leased_at).toBeNull();
    });

    it('should fulfill queued request on release', async () => {
      // Lease all 3 worktrees
      const handle1 = await poolManager.leaseWorktree('wo-1');
      await poolManager.leaseWorktree('wo-2');
      await poolManager.leaseWorktree('wo-3');

      // Queue a 4th request
      const queuedPromise = poolManager.leaseWorktree('wo-4');

      // Release one worktree
      await poolManager.releaseWorktree(handle1);

      // Queued request should be fulfilled
      const handle4 = await queuedPromise;
      expect(handle4).toBeDefined();
      expect(handle4.leased_to).toBe('wo-4');

      const status = poolManager.getStatus();
      expect(status.available).toBe(0);
      expect(status.leased).toBe(3);
      expect(status.waiters).toBe(0);
    });
  });

  describe('getStatus', () => {
    beforeEach(async () => {
      await poolManager.initialize(mockProject, 5);
    });

    it('should return accurate pool status', () => {
      const status = poolManager.getStatus();

      expect(status.total).toBe(5);
      expect(status.available).toBe(5);
      expect(status.leased).toBe(0);
      expect(status.waiters).toBe(0);
    });

    it('should update status after leasing worktrees', async () => {
      await poolManager.leaseWorktree('wo-1');
      await poolManager.leaseWorktree('wo-2');

      const status = poolManager.getStatus();
      expect(status.available).toBe(3);
      expect(status.leased).toBe(2);
    });

    it('should include leased worktree details', async () => {
      await poolManager.leaseWorktree('wo-test-1');

      const status = poolManager.getStatus();
      expect(status.leasedWorktrees.size).toBe(1);
      expect(status.leasedWorktrees.has('wo-test-1')).toBe(true);
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await poolManager.initialize(mockProject, 3);
    });

    it('should remove all worktrees', async () => {
      let worktreeRemoveCount = 0;

      vi.mocked(child_process.execSync).mockImplementation((cmd: any) => {
        const cmdStr = String(cmd);
        if (cmdStr.includes('git worktree remove')) {
          worktreeRemoveCount++;
        }
        return '';
      });

      await poolManager.cleanup();

      expect(worktreeRemoveCount).toBe(3);
    });

    it('should reset pool state after cleanup', async () => {
      await poolManager.cleanup();

      const status = poolManager.getStatus();
      expect(status.total).toBe(0);
      expect(status.available).toBe(0);
      expect(status.leased).toBe(0);
    });

    it('should reject all queued requests on cleanup', async () => {
      // Exhaust pool
      await poolManager.leaseWorktree('wo-1');
      await poolManager.leaseWorktree('wo-2');
      await poolManager.leaseWorktree('wo-3');

      // Queue requests
      const queuedPromise1 = poolManager.leaseWorktree('wo-4');
      const queuedPromise2 = poolManager.leaseWorktree('wo-5');

      // Cleanup
      await poolManager.cleanup();

      // Queued promises should be rejected
      await expect(queuedPromise1).rejects.toThrow('shutting down');
      await expect(queuedPromise2).rejects.toThrow('shutting down');
    });
  });

  describe('Concurrent Operations', () => {
    beforeEach(async () => {
      await poolManager.initialize(mockProject, 10);
    });

    it('should handle multiple concurrent lease requests', async () => {
      const leasePromises = Array.from({ length: 10 }, (_, i) =>
        poolManager.leaseWorktree(`wo-${i + 1}`)
      );

      const handles = await Promise.all(leasePromises);

      expect(handles.length).toBe(10);

      // All handles should have unique IDs
      const ids = handles.map(h => h.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);

      const status = poolManager.getStatus();
      expect(status.leased).toBe(10);
      expect(status.available).toBe(0);
    });

    it('should handle mixed lease and release operations', async () => {
      // Lease 5 worktrees
      const handles = await Promise.all([
        poolManager.leaseWorktree('wo-1'),
        poolManager.leaseWorktree('wo-2'),
        poolManager.leaseWorktree('wo-3'),
        poolManager.leaseWorktree('wo-4'),
        poolManager.leaseWorktree('wo-5')
      ]);

      // Release 3 worktrees
      await Promise.all([
        poolManager.releaseWorktree(handles[0]),
        poolManager.releaseWorktree(handles[1]),
        poolManager.releaseWorktree(handles[2])
      ]);

      const status = poolManager.getStatus();
      expect(status.available).toBe(8);
      expect(status.leased).toBe(2);
    });

    it('should maintain pool integrity under high concurrency', async () => {
      const operations: Promise<any>[] = [];

      // Lease 10 worktrees
      for (let i = 0; i < 10; i++) {
        operations.push(
          poolManager.leaseWorktree(`wo-lease-${i}`).then(handle => ({ type: 'lease', handle }))
        );
      }

      // Execute all operations
      const results = await Promise.all(operations);

      // Verify all leases succeeded
      const leaseResults = results.filter(r => r.type === 'lease');
      expect(leaseResults.length).toBe(10);

      const status = poolManager.getStatus();
      expect(status.leased).toBe(10);
      expect(status.available).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero-sized pool initialization', async () => {
      await poolManager.initialize(mockProject, 0);

      const status = poolManager.getStatus();
      expect(status.total).toBe(0);
    });

    it('should handle releasing worktree multiple times gracefully', async () => {
      await poolManager.initialize(mockProject, 1);
      const handle = await poolManager.leaseWorktree('wo-test');

      // First release should succeed
      await poolManager.releaseWorktree(handle);

      // Second release should not crash (handle already released)
      await expect(poolManager.releaseWorktree(handle)).resolves.not.toThrow();
    });

    it('should handle cleanup when pool is not initialized', async () => {
      await expect(poolManager.cleanup()).resolves.not.toThrow();
    });

    it('should handle git command failures gracefully', async () => {
      vi.mocked(child_process.execSync).mockImplementation((cmd: any) => {
        const cmdStr = String(cmd);
        if (cmdStr.includes('git worktree add')) {
          throw new Error('git worktree add failed');
        }
        return '';
      });

      await expect(poolManager.initialize(mockProject, 3)).rejects.toThrow();
    });
  });
});
