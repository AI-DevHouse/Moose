/**
 * Full System Reset Script
 *
 * Resets the entire Moose Mission Control system back to a clean state
 * where work orders exist but have not been executed yet.
 *
 * This script:
 * 1. Resets all work orders to 'pending' status
 * 2. Clears all auto_approved flags in metadata
 * 3. Closes all open PRs in target repo
 * 4. Deletes all feature/wo-* branches (local and remote)
 * 5. Cleans working tree (removes untracked files)
 * 6. Returns target repo to main branch
 * 7. Cleans up any e2e test folders
 * 8. Verifies clean state
 *
 * Usage:
 *   powershell.exe -File scripts/run-with-env.ps1 scripts/full-system-reset.ts
 */

import { createSupabaseServiceClient } from '../src/lib/supabase'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

const PROJECT_ID = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'
const TARGET_REPO_PATH = 'C:/dev/multi-llm-discussion-v1'
const E2E_FOLDER_BASE = 'C:/dev'

interface WorkOrder {
  id: string
  title: string
  status: string
  github_pr_number?: number
  github_branch?: string
}

async function fullSystemReset() {
  console.log('\n🚀 Starting Full System Reset...\n')
  console.log('=' .repeat(80))

  const supabase = createSupabaseServiceClient()

  // ============================================================================
  // STEP 1: Reset Work Orders in Database
  // ============================================================================
  console.log('\n📊 STEP 1: Resetting Work Orders in Database\n')

  // Get all work orders to show current state
  const { data: allWOs } = await supabase
    .from('work_orders')
    .select('id, title, status, github_pr_number, github_branch, metadata')
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

    // Reset all to pending and clear auto_approved
    console.log('\n🔄 Resetting all work orders to "pending" and clearing metadata...')

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

    console.log(`✅ Successfully reset ${allWOs.length} work orders to pending`)
  }

  // ============================================================================
  // STEP 2: Close All Open PRs
  // ============================================================================
  console.log('\n' + '='.repeat(80))
  console.log('📝 STEP 2: Closing All Open PRs\n')

  try {
    const prListOutput = execSync('gh pr list --limit 100 --json number,title,headRefName', {
      cwd: TARGET_REPO_PATH,
      encoding: 'utf-8'
    })

    const openPRs = JSON.parse(prListOutput) as Array<{ number: number, title: string, headRefName: string }>

    if (openPRs.length === 0) {
      console.log('✅ No open PRs found')
    } else {
      console.log(`Found ${openPRs.length} open PRs`)

      for (const pr of openPRs) {
        console.log(`\n  Closing PR #${pr.number}: ${pr.title}`)
        try {
          execSync(`gh pr close ${pr.number} --comment "Closed by full-system-reset script for clean test run"`, {
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
  // STEP 3: Clean Target Repository
  // ============================================================================
  console.log('\n' + '='.repeat(80))
  console.log('🧹 STEP 3: Cleaning Target Repository\n')

  // Switch to main branch first
  console.log('Switching to main branch...')
  try {
    execSync('git checkout main', { cwd: TARGET_REPO_PATH, stdio: 'pipe' })
    console.log('✅ Switched to main branch')
  } catch (err) {
    console.error('⚠️  Error switching to main:', err)
  }

  // Clean working tree (remove untracked files)
  console.log('\nCleaning working tree (removing untracked files)...')
  try {
    execSync('git clean -fd', { cwd: TARGET_REPO_PATH, stdio: 'pipe' })
    console.log('✅ Working tree cleaned')
  } catch (err) {
    console.error('⚠️  Error cleaning working tree:', err)
  }

  // Reset any tracked changes
  console.log('\nResetting any tracked changes...')
  try {
    execSync('git reset --hard HEAD', { cwd: TARGET_REPO_PATH, stdio: 'pipe' })
    console.log('✅ Tracked changes reset')
  } catch (err) {
    console.error('⚠️  Error resetting tracked changes:', err)
  }

  // Fetch latest from remote
  console.log('\nFetching latest from remote...')
  try {
    execSync('git fetch origin', { cwd: TARGET_REPO_PATH, stdio: 'pipe' })
    console.log('✅ Fetched from remote')
  } catch (err) {
    console.error('⚠️  Error fetching from remote:', err)
  }

  // Pull latest main
  console.log('\nPulling latest main...')
  try {
    execSync('git pull origin main', { cwd: TARGET_REPO_PATH, stdio: 'pipe' })
    console.log('✅ Pulled latest main')
  } catch (err) {
    console.error('⚠️  Error pulling main:', err)
  }

  // Get all local branches
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
          console.error(`  ⚠️  Failed to delete local branch ${branch}:`, err)
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
          console.error(`  ⚠️  Failed to delete remote branch ${branch}:`, err)
        }
      }
    }
  } catch (err) {
    console.error('⚠️  Error deleting remote branches:', err)
  }

  // ============================================================================
  // STEP 4: Clean Worktrees
  // ============================================================================
  console.log('\n' + '='.repeat(80))
  console.log('🧹 STEP 4: Cleaning Worktrees\n')

  try {
    const projectName = path.basename(TARGET_REPO_PATH)
    console.log(`Cleaning worktrees for project: ${projectName}`)

    // Remove worktrees wt-1 through wt-15
    for (let i = 1; i <= 15; i++) {
      const worktreeId = `wt-${i}`
      const worktreePath = path.join(path.dirname(TARGET_REPO_PATH), `${projectName}-${worktreeId}`)

      try {
        execSync(`git worktree remove "${worktreePath}" --force`, {
          cwd: TARGET_REPO_PATH,
          stdio: 'pipe'
        })
        console.log(`  ✅ Removed ${worktreeId}`)
      } catch (err) {
        // Worktree might not exist
        console.log(`  ℹ️  ${worktreeId} does not exist or already removed`)
      }
    }

    // Prune worktree list
    try {
      execSync('git worktree prune', {
        cwd: TARGET_REPO_PATH,
        stdio: 'pipe'
      })
      console.log('  ✅ Pruned worktree list')
    } catch (err) {
      console.error('  ⚠️  Failed to prune worktrees:', err)
    }
  } catch (err) {
    console.error('⚠️  Error cleaning worktrees:', err)
  }

  // ============================================================================
  // STEP 5: Clean E2E Test Folders
  // ============================================================================
  console.log('\n' + '='.repeat(80))
  console.log('🗑️  STEP 5: Cleaning E2E Test Folders\n')

  try {
    const e2ePattern = /^e2e-test-/
    const devFiles = fs.readdirSync(E2E_FOLDER_BASE)
    const e2eFolders = devFiles.filter(f => {
      const fullPath = path.join(E2E_FOLDER_BASE, f)
      return e2ePattern.test(f) && fs.statSync(fullPath).isDirectory()
    })

    if (e2eFolders.length === 0) {
      console.log('✅ No e2e test folders found')
    } else {
      console.log(`Found ${e2eFolders.length} e2e test folders`)
      for (const folder of e2eFolders) {
        const fullPath = path.join(E2E_FOLDER_BASE, folder)
        console.log(`  Deleting: ${fullPath}`)
        try {
          fs.rmSync(fullPath, { recursive: true, force: true })
          console.log(`  ✅ Deleted: ${folder}`)
        } catch (err) {
          console.error(`  ⚠️  Failed to delete ${folder}:`, err)
        }
      }
    }
  } catch (err) {
    console.error('⚠️  Error cleaning e2e folders:', err)
  }

  // ============================================================================
  // STEP 6: Verify Clean State
  // ============================================================================
  console.log('\n' + '='.repeat(80))
  console.log('✅ STEP 6: Verifying Clean State\n')

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
    const statusOutput = execSync('git status --short', { cwd: TARGET_REPO_PATH, encoding: 'utf-8' })
    if (statusOutput.trim() === '') {
      console.log('✅ Working tree is clean')
    } else {
      console.log('⚠️  Warning: Working tree has uncommitted changes:')
      console.log(statusOutput)
    }

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
  console.log('\n🎉 Full System Reset Complete!\n')
  console.log('System is now ready for a fresh test run.')
  console.log('\nNext steps:')
  console.log('  1. Run: powershell.exe -File scripts/run-with-env.ps1 scripts/approve-phase1-wos.ts')
  console.log('  2. Verify: powershell.exe -File scripts/run-with-env.ps1 scripts/check-all-wos.ts')
  console.log('  3. Start: powershell.exe -File scripts/run-with-env.ps1 scripts/orchestrator-daemon.ts')
  console.log('')
}

fullSystemReset().catch(console.error)
