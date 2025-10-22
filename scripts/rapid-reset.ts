/**
 * Rapid System Reset Script
 *
 * Fast reset for testing iterations - only clears PRs and branches.
 * Preserves worktrees and working tree state for quick turnaround.
 *
 * This script:
 * 1. Resets all work orders to 'pending' status
 * 2. Clears metadata (PR numbers, branches, etc.)
 * 3. Closes all open PRs in target repo
 * 4. Deletes all feature/wo-* branches (local and remote)
 * 5. Switches target repo to main branch
 *
 * This script DOES NOT:
 * - Clean worktrees (left intact for reuse)
 * - Clean working tree files
 * - Pull latest changes
 * - Delete e2e test folders
 *
 * Usage:
 *   powershell.exe -File scripts/run-with-env.ps1 scripts/rapid-reset.ts
 */

import { createSupabaseServiceClient } from '../src/lib/supabase'
import { execSync } from 'child_process'

const PROJECT_ID = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'
const TARGET_REPO_PATH = 'C:/dev/multi-llm-discussion-v1'

async function rapidReset() {
  console.log('\n⚡ Starting Rapid System Reset...\n')
  console.log('=' .repeat(80))

  const supabase = createSupabaseServiceClient()

  // ============================================================================
  // STEP 1: Reset Work Orders in Database
  // ============================================================================
  console.log('\n📊 STEP 1: Resetting Work Orders in Database\n')

  const { data: allWOs } = await supabase
    .from('work_orders')
    .select('id, title, status')
    .eq('project_id', PROJECT_ID)
    .order('created_at', { ascending: true })

  if (!allWOs || allWOs.length === 0) {
    console.log('⚠️  No work orders found in database')
  } else {
    console.log(`Found ${allWOs.length} work orders`)

    const statusCounts = allWOs.reduce((acc, wo) => {
      acc[wo.status] = (acc[wo.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log('Current status distribution:')
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count}`)
    })

    console.log('\n🔄 Resetting to pending and clearing metadata...')

    const { error: resetError } = await supabase
      .from('work_orders')
      .update({
        status: 'pending',
        metadata: {},
        actual_cost: null,
        completed_at: null,
        github_pr_number: null,
        github_pr_url: null,
        github_branch: null
      })
      .eq('project_id', PROJECT_ID)

    if (resetError) {
      console.error('❌ Error resetting work orders:', resetError)
      throw resetError
    }

    console.log(`✅ Successfully reset ${allWOs.length} work orders`)
  }

  // ============================================================================
  // STEP 2: Close All Open PRs
  // ============================================================================
  console.log('\n' + '='.repeat(80))
  console.log('📝 STEP 2: Closing All Open PRs\n')

  try {
    const prListOutput = execSync('gh pr list --limit 100 --json number,title', {
      cwd: TARGET_REPO_PATH,
      encoding: 'utf-8'
    })

    const openPRs = JSON.parse(prListOutput) as Array<{ number: number, title: string }>

    if (openPRs.length === 0) {
      console.log('✅ No open PRs found')
    } else {
      console.log(`Found ${openPRs.length} open PRs`)

      for (const pr of openPRs) {
        console.log(`\n  Closing PR #${pr.number}: ${pr.title}`)
        try {
          execSync(`gh pr close ${pr.number} --comment "Closed by rapid-reset script for quick test iteration"`, {
            cwd: TARGET_REPO_PATH,
            encoding: 'utf-8'
          })
          console.log(`  ✅ Closed PR #${pr.number}`)
        } catch (err) {
          console.error(`  ⚠️  Failed to close PR #${pr.number}:`, err)
        }
      }
    }
  } catch (err) {
    console.error('⚠️  Error listing/closing PRs:', err)
  }

  // ============================================================================
  // STEP 3: Clean Branches
  // ============================================================================
  console.log('\n' + '='.repeat(80))
  console.log('🧹 STEP 3: Deleting Feature Branches\n')

  // Switch to main branch first
  console.log('Switching to main branch...')
  try {
    execSync('git checkout main', { cwd: TARGET_REPO_PATH, stdio: 'pipe' })
    console.log('✅ Switched to main branch')
  } catch (err) {
    console.error('⚠️  Error switching to main:', err)
  }

  // Delete local branches
  console.log('\nDeleting local feature/wo-* branches...')
  try {
    const branchOutput = execSync('git branch', { cwd: TARGET_REPO_PATH, encoding: 'utf-8' })
    const localBranches = branchOutput
      .split('\n')
      .map(b => b.replace('*', '').trim())
      .filter(b => b.startsWith('feature/wo-'))

    if (localBranches.length === 0) {
      console.log('  ✅ No local feature branches to delete')
    } else {
      console.log(`  Found ${localBranches.length} local feature branches`)
      for (const branch of localBranches) {
        try {
          execSync(`git branch -D ${branch}`, { cwd: TARGET_REPO_PATH, stdio: 'pipe' })
          console.log(`  ✅ Deleted local branch: ${branch}`)
        } catch (err) {
          console.error(`  ⚠️  Failed to delete local branch ${branch}`)
        }
      }
    }
  } catch (err) {
    console.error('⚠️  Error deleting local branches:', err)
  }

  // Delete remote branches
  console.log('\nDeleting remote feature/wo-* branches...')
  try {
    const remoteBranchOutput = execSync('git branch -r', { cwd: TARGET_REPO_PATH, encoding: 'utf-8' })
    const remoteBranches = remoteBranchOutput
      .split('\n')
      .map(b => b.trim())
      .filter(b => b.startsWith('origin/feature/wo-'))
      .map(b => b.replace('origin/', ''))

    if (remoteBranches.length === 0) {
      console.log('  ✅ No remote feature branches to delete')
    } else {
      console.log(`  Found ${remoteBranches.length} remote feature branches`)
      for (const branch of remoteBranches) {
        try {
          execSync(`git push origin --delete ${branch}`, { cwd: TARGET_REPO_PATH, stdio: 'pipe' })
          console.log(`  ✅ Deleted remote branch: ${branch}`)
        } catch (err) {
          console.error(`  ⚠️  Failed to delete remote branch ${branch}`)
        }
      }
    }
  } catch (err) {
    console.error('⚠️  Error deleting remote branches:', err)
  }

  // ============================================================================
  // STEP 4: Verify State
  // ============================================================================
  console.log('\n' + '='.repeat(80))
  console.log('✅ STEP 4: Verifying Clean State\n')

  // Verify DB state
  const { data: verifyWOs } = await supabase
    .from('work_orders')
    .select('id, title, status')
    .eq('project_id', PROJECT_ID)
    .neq('status', 'pending')

  if (verifyWOs && verifyWOs.length > 0) {
    console.log(`⚠️  Warning: ${verifyWOs.length} work orders are not in pending status:`)
    verifyWOs.forEach(wo => console.log(`  - ${wo.title}: ${wo.status}`))
  } else {
    console.log('✅ All work orders are in pending status')
  }

  // Verify Git state
  try {
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: TARGET_REPO_PATH, encoding: 'utf-8' }).trim()
    if (currentBranch === 'main') {
      console.log('✅ On main branch')
    } else {
      console.log(`⚠️  Warning: Not on main branch (currently on: ${currentBranch})`)
    }

    const localBranches = execSync('git branch', { cwd: TARGET_REPO_PATH, encoding: 'utf-8' })
      .split('\n')
      .map(b => b.replace('*', '').trim())
      .filter(b => b.startsWith('feature/wo-'))

    if (localBranches.length === 0) {
      console.log('✅ No local feature branches')
    } else {
      console.log(`⚠️  Warning: ${localBranches.length} local feature branches still exist`)
    }

    const remoteBranches = execSync('git branch -r', { cwd: TARGET_REPO_PATH, encoding: 'utf-8' })
      .split('\n')
      .map(b => b.trim())
      .filter(b => b.startsWith('origin/feature/wo-'))

    if (remoteBranches.length === 0) {
      console.log('✅ No remote feature branches')
    } else {
      console.log(`⚠️  Warning: ${remoteBranches.length} remote feature branches still exist`)
    }
  } catch (err) {
    console.error('⚠️  Error verifying Git state:', err)
  }

  // Check for open PRs
  try {
    const prListOutput = execSync('gh pr list --limit 100 --json number', {
      cwd: TARGET_REPO_PATH,
      encoding: 'utf-8'
    })
    const openPRs = JSON.parse(prListOutput)

    if (openPRs.length === 0) {
      console.log('✅ No open PRs')
    } else {
      console.log(`⚠️  Warning: ${openPRs.length} open PRs still exist`)
    }
  } catch (err) {
    console.error('⚠️  Error checking PRs:', err)
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n⚡ Rapid Reset Complete!\n')
  console.log('✅ Worktrees preserved for reuse')
  console.log('✅ Working tree state preserved')
  console.log('\nSystem is ready for next test run.')
  console.log('\nNext steps:')
  console.log('  1. Approve work order(s): powershell.exe -File scripts/run-with-env.ps1 scripts/approve-clipboard-wo.ts')
  console.log('  2. Start orchestrator: npm run orchestrator:daemon')
  console.log('')
}

rapidReset().catch(console.error)
