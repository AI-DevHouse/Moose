import { WorktreePoolManager } from '../src/lib/orchestrator/worktree-pool'

async function cleanupWorktrees() {
  console.log('🧹 Cleaning up worktree pool...\n')

  const worktreePool = WorktreePoolManager.getInstance()

  try {
    await worktreePool.cleanup()
    console.log('✅ Cleanup complete\n')
  } catch (error: any) {
    console.error('❌ Cleanup failed:', error.message)
  }
}

cleanupWorktrees().catch(console.error)
