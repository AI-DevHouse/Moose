#!/usr/bin/env ts-node
/**
 * Cleanup Test Run
 *
 * Cleans up:
 * 1. Local worktrees
 * 2. Local feature branches
 * 3. Remote PRs (closes them)
 * 4. Remote branches (deletes them)
 * 5. Resets work order statuses
 */

import { execSync } from 'child_process';
import { createSupabaseServiceClient } from '../src/lib/supabase';
import { projectService } from '../src/lib/project-service';
import * as path from 'path';

async function cleanupTestRun() {
  console.log('🧹 Cleaning up test run...\n');

  const supabase = createSupabaseServiceClient();

  // Get all WOs from this test run with PRs
  const { data: wos, error } = await supabase
    .from('work_orders')
    .select('id, title, status, github_pr_url, github_pr_number, github_branch_name, project_id')
    .in('status', ['in_progress', 'needs_review', 'failed'])
    .not('github_pr_url', 'is', null)
    .limit(100);

  if (error) {
    console.error('❌ Error fetching WOs:', error);
    return;
  }

  console.log(`📋 Found ${wos?.length || 0} WOs with PRs to clean up\n`);

  if (!wos || wos.length === 0) {
    console.log('✅ No WOs to clean up');
    return;
  }

  // Get project info
  const projectId = wos[0].project_id;
  const project = await projectService.getProject(projectId);
  const workingDir = project.local_path;
  const repoFullName = `${project.github_org}/${project.github_repo_name}`;

  console.log(`📁 Project: ${project.name}`);
  console.log(`📂 Working Dir: ${workingDir}`);
  console.log(`🔗 Repo: ${repoFullName}\n`);

  // Step 1: Close all PRs on GitHub
  console.log('🔒 Closing PRs on GitHub...\n');
  for (const wo of wos) {
    if (wo.github_pr_number) {
      try {
        console.log(`  Closing PR #${wo.github_pr_number} for WO ${wo.id.substring(0, 8)}...`);
        execSync(`gh pr close ${wo.github_pr_number} --repo ${repoFullName} --comment "Cleaning up test run"`, {
          cwd: workingDir,
          stdio: 'pipe'
        });
        console.log(`  ✅ Closed PR #${wo.github_pr_number}`);
      } catch (error: any) {
        console.log(`  ⚠️  Failed to close PR #${wo.github_pr_number}: ${error.message}`);
      }
    }
  }

  console.log();

  // Step 2: Delete remote branches
  console.log('🗑️  Deleting remote branches...\n');
  for (const wo of wos) {
    if (wo.github_branch_name) {
      try {
        console.log(`  Deleting remote branch ${wo.github_branch_name}...`);
        execSync(`git push origin --delete ${wo.github_branch_name}`, {
          cwd: workingDir,
          stdio: 'pipe'
        });
        console.log(`  ✅ Deleted remote branch ${wo.github_branch_name}`);
      } catch (error: any) {
        console.log(`  ⚠️  Failed to delete remote branch ${wo.github_branch_name}: ${error.message}`);
      }
    }
  }

  console.log();

  // Step 3: Clean up local worktrees
  console.log('🧹 Cleaning up local worktrees...\n');
  const projectName = path.basename(workingDir);

  for (let i = 1; i <= 15; i++) {
    const worktreeId = `wt-${i}`;
    const worktreePath = path.join(path.dirname(workingDir), `${projectName}-${worktreeId}`);

    try {
      console.log(`  Removing ${worktreeId}...`);
      execSync(`git worktree remove "${worktreePath}" --force`, {
        cwd: workingDir,
        stdio: 'pipe'
      });
      console.log(`  ✅ Removed ${worktreeId}`);
    } catch (error: any) {
      console.log(`  ⚠️  ${worktreeId} already removed or doesn't exist`);
    }
  }

  // Prune worktree list
  try {
    execSync('git worktree prune', {
      cwd: workingDir,
      stdio: 'pipe'
    });
    console.log(`  ✅ Pruned worktree list`);
  } catch (error: any) {
    console.log(`  ⚠️  Failed to prune worktrees: ${error.message}`);
  }

  console.log();

  // Step 4: Delete local feature branches
  console.log('🗑️  Deleting local feature branches...\n');

  // Get current branch first
  let currentBranch = 'main';
  try {
    currentBranch = execSync('git branch --show-current', {
      cwd: workingDir,
      encoding: 'utf-8'
    }).trim();
  } catch (error) {
    // ignore
  }

  // Checkout main if not already there
  if (currentBranch !== 'main') {
    try {
      execSync('git checkout main', {
        cwd: workingDir,
        stdio: 'pipe'
      });
      console.log('  ✅ Checked out main branch');
    } catch (error: any) {
      console.log(`  ⚠️  Failed to checkout main: ${error.message}`);
    }
  }

  // Delete all feature branches
  for (const wo of wos) {
    if (wo.github_branch_name) {
      try {
        execSync(`git branch -D ${wo.github_branch_name}`, {
          cwd: workingDir,
          stdio: 'pipe'
        });
        console.log(`  ✅ Deleted local branch ${wo.github_branch_name}`);
      } catch (error: any) {
        console.log(`  ⚠️  Branch ${wo.github_branch_name} doesn't exist locally`);
      }
    }
  }

  console.log();

  // Step 5: Reset work order statuses
  console.log('🔄 Resetting work order statuses...\n');

  for (const wo of wos) {
    const { error: updateError } = await supabase
      .from('work_orders')
      .update({
        status: 'pending',
        github_pr_url: null,
        github_pr_number: null,
        github_branch_name: null,
        acceptance_result: null
      })
      .eq('id', wo.id);

    if (updateError) {
      console.log(`  ❌ Failed to reset WO ${wo.id.substring(0, 8)}: ${updateError.message}`);
    } else {
      console.log(`  ✅ Reset WO ${wo.id.substring(0, 8)} - ${wo.title.substring(0, 50)}`);
    }
  }

  console.log();
  console.log('='.repeat(70));
  console.log('✅ Cleanup complete!');
  console.log('='.repeat(70));
}

cleanupTestRun().catch(console.error);
