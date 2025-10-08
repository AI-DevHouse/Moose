// Project Lock Manager - Prevents concurrent execution on same project

/**
 * Manages locks to prevent multiple work orders from executing
 * simultaneously on the same project
 *
 * This prevents:
 * - Git conflicts from concurrent Aider processes
 * - Race conditions on branch creation
 * - File system conflicts
 *
 * Usage:
 *   const releaseLock = await projectLockManager.acquireLock(projectId);
 *   try {
 *     // Execute work order
 *   } finally {
 *     releaseLock();
 *   }
 */

export class ProjectLockManager {
  private locks: Map<string, Promise<void>> = new Map();
  private lockHolders: Map<string, string> = new Map(); // projectId -> workOrderId

  /**
   * Acquire lock for a project
   *
   * Waits if another work order is executing on the same project
   *
   * @param projectId - Project UUID
   * @param workOrderId - Work order ID (for logging)
   * @returns Release function
   */
  async acquireLock(
    projectId: string,
    workOrderId?: string
  ): Promise<() => void> {
    const identifier = workOrderId || 'unknown';

    // Wait for existing lock to release
    while (this.locks.has(projectId)) {
      const currentHolder = this.lockHolders.get(projectId);
      console.log(
        `[ProjectLock] Work order ${identifier} waiting for project ${projectId} ` +
        `(held by ${currentHolder})`
      );
      await this.locks.get(projectId);
    }

    console.log(`[ProjectLock] Work order ${identifier} acquired lock for project ${projectId}`);

    // Create new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>(resolve => {
      releaseLock = resolve;
    });

    this.locks.set(projectId, lockPromise);
    this.lockHolders.set(projectId, identifier);

    // Return release function
    return () => {
      console.log(`[ProjectLock] Work order ${identifier} releasing lock for project ${projectId}`);
      this.locks.delete(projectId);
      this.lockHolders.delete(projectId);
      releaseLock!();
    };
  }

  /**
   * Check if project is currently locked
   *
   * @param projectId - Project UUID
   * @returns true if locked
   */
  isLocked(projectId: string): boolean {
    return this.locks.has(projectId);
  }

  /**
   * Get current lock holder for project
   *
   * @param projectId - Project UUID
   * @returns Work order ID holding the lock, or null if not locked
   */
  getLockHolder(projectId: string): string | null {
    return this.lockHolders.get(projectId) || null;
  }

  /**
   * Get all currently locked projects
   *
   * @returns Array of locked project IDs
   */
  getLockedProjects(): string[] {
    return Array.from(this.locks.keys());
  }

  /**
   * Force release all locks (for testing/debugging)
   *
   * WARNING: Use with caution - may cause concurrent execution issues
   */
  releaseAllLocks(): void {
    console.warn('[ProjectLock] Force releasing all locks');
    const projectIds = Array.from(this.locks.keys());

    for (const projectId of projectIds) {
      this.locks.delete(projectId);
      this.lockHolders.delete(projectId);
    }
  }

  /**
   * Get lock statistics
   *
   * @returns Lock stats for monitoring
   */
  getStats(): {
    lockedCount: number;
    lockedProjects: Array<{ projectId: string; holder: string }>;
  } {
    const lockedProjects = Array.from(this.locks.keys()).map(projectId => ({
      projectId,
      holder: this.lockHolders.get(projectId) || 'unknown'
    }));

    return {
      lockedCount: this.locks.size,
      lockedProjects
    };
  }
}

export const projectLockManager = new ProjectLockManager();
