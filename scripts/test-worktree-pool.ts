/**
 * Manual test script for WorktreePoolManager
 *
 * Tests:
 * 1. Initialize small pool (3 worktrees)
 * 2. Lease and release worktrees
 * 3. Test queue blocking when pool exhausted
 * 4. Verify cleanup
 */

import { WorktreePoolManager } from '../src/lib/orchestrator/worktree-pool'
import { projectService } from '../src/lib/project-service'

async function testWorktreePool() {
  console.log('🧪 Testing WorktreePoolManager')
  console.log('   Pool Size: 3 worktrees')
  console.log('   Target: C:/dev/multi-llm-discussion-v1\n')

  const pool = WorktreePoolManager.getInstance()

  try {
    // Get project from database
    console.log('📦 Fetching project...')
    const projects = await projectService.listProjects()
    const targetProject = projects.find(p => p.name === 'multi-llm-discussion-v1')

    if (!targetProject) {
      throw new Error('Project not found: multi-llm-discussion-v1')
    }

    console.log(`   ✓ Found project: ${targetProject.name} (${targetProject.id})`)

    // Test 1: Initialize pool
    console.log('\n' + '='.repeat(80))
    console.log('TEST 1: Initialize Pool (3 worktrees)')
    console.log('='.repeat(80))

    const initStart = Date.now()
    await pool.initialize(targetProject, 3)
    const initDuration = Date.now() - initStart

    const status1 = pool.getStatus()
    console.log(`✅ Pool initialized in ${(initDuration / 1000).toFixed(1)}s`)
    console.log(`   Total: ${status1.total}, Available: ${status1.available}, Leased: ${status1.leased}`)

    if (status1.total !== 3 || status1.available !== 3 || status1.leased !== 0) {
      throw new Error('Pool initialization failed: unexpected status')
    }

    // Test 2: Lease worktrees
    console.log('\n' + '='.repeat(80))
    console.log('TEST 2: Lease Worktrees')
    console.log('='.repeat(80))

    const handle1 = await pool.leaseWorktree('test-wo-1')
    console.log(`✅ Leased ${handle1.id} for test-wo-1`)
    console.log(`   Path: ${handle1.path}`)

    const status2 = pool.getStatus()
    console.log(`   Pool status: Available: ${status2.available}, Leased: ${status2.leased}`)

    if (status2.available !== 2 || status2.leased !== 1) {
      throw new Error('Lease failed: unexpected status')
    }

    const handle2 = await pool.leaseWorktree('test-wo-2')
    console.log(`✅ Leased ${handle2.id} for test-wo-2`)

    const handle3 = await pool.leaseWorktree('test-wo-3')
    console.log(`✅ Leased ${handle3.id} for test-wo-3`)

    const status3 = pool.getStatus()
    console.log(`   Pool status: Available: ${status3.available}, Leased: ${status3.leased}`)

    if (status3.available !== 0 || status3.leased !== 3) {
      throw new Error('Multiple leases failed: unexpected status')
    }

    // Test 3: Release worktree
    console.log('\n' + '='.repeat(80))
    console.log('TEST 3: Release Worktree')
    console.log('='.repeat(80))

    const releaseStart = Date.now()
    await pool.releaseWorktree(handle1)
    const releaseDuration = Date.now() - releaseStart

    console.log(`✅ Released ${handle1.id} in ${(releaseDuration / 1000).toFixed(1)}s`)

    const status4 = pool.getStatus()
    console.log(`   Pool status: Available: ${status4.available}, Leased: ${status4.leased}`)

    if (status4.available !== 1 || status4.leased !== 2) {
      throw new Error('Release failed: unexpected status')
    }

    // Test 4: Cleanup
    console.log('\n' + '='.repeat(80))
    console.log('TEST 4: Cleanup Pool')
    console.log('='.repeat(80))

    // Release remaining worktrees
    await pool.releaseWorktree(handle2)
    await pool.releaseWorktree(handle3)
    console.log('✅ Released all worktrees')

    const cleanupStart = Date.now()
    await pool.cleanup()
    const cleanupDuration = Date.now() - cleanupStart

    console.log(`✅ Cleanup completed in ${(cleanupDuration / 1000).toFixed(1)}s`)

    const status5 = pool.getStatus()
    console.log(`   Pool status: Total: ${status5.total}, Available: ${status5.available}, Leased: ${status5.leased}`)

    // Test 5: Test queueing (bonus)
    console.log('\n' + '='.repeat(80))
    console.log('TEST 5: Queue Blocking (Bonus)')
    console.log('='.repeat(80))

    console.log('Re-initializing pool with 2 worktrees...')
    await pool.initialize(targetProject, 2)

    const h1 = await pool.leaseWorktree('queue-wo-1')
    const h2 = await pool.leaseWorktree('queue-wo-2')
    console.log(`✅ Leased ${h1.id} and ${h2.id}`)

    // Try to lease a third worktree (should queue)
    console.log('Requesting third worktree (should queue)...')
    const queuePromise = pool.leaseWorktree('queue-wo-3')

    // Wait a bit to show it's queued
    await new Promise(resolve => setTimeout(resolve, 1000))

    const statusQueued = pool.getStatus()
    console.log(`   Pool status: Available: ${statusQueued.available}, Leased: ${statusQueued.leased}, Waiters: ${statusQueued.waiters}`)

    if (statusQueued.waiters !== 1) {
      throw new Error('Queue test failed: expected 1 waiter')
    }

    // Release one worktree to fulfill queued request
    console.log(`Releasing ${h1.id} to fulfill queued request...`)
    await pool.releaseWorktree(h1)

    const h3 = await queuePromise
    console.log(`✅ Queued request fulfilled with ${h3.id}`)

    // Cleanup
    await pool.releaseWorktree(h2)
    await pool.releaseWorktree(h3)
    await pool.cleanup()

    // Final summary
    console.log('\n' + '='.repeat(80))
    console.log('🎉 ALL TESTS PASSED')
    console.log('='.repeat(80))
    console.log('✅ Pool initialization: Working')
    console.log('✅ Lease/release cycle: Working')
    console.log('✅ Cleanup: Working')
    console.log('✅ Queue blocking: Working')
    console.log('\n📊 Performance:')
    console.log(`   - Pool initialization (3 worktrees): ${(initDuration / 1000).toFixed(1)}s`)
    console.log(`   - Worktree release: ${(releaseDuration / 1000).toFixed(1)}s`)
    console.log(`   - Pool cleanup: ${(cleanupDuration / 1000).toFixed(1)}s`)

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message)
    console.error(error.stack)

    // Attempt cleanup
    try {
      console.log('\n🧹 Attempting cleanup...')
      await pool.cleanup()
      console.log('✅ Cleanup successful')
    } catch (cleanupError: any) {
      console.error('❌ Cleanup failed:', cleanupError.message)
    }

    process.exit(1)
  }
}

testWorktreePool()
