// GitHub Integration - Creates Pull Requests via gh CLI

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { handleCriticalError } from '@/lib/error-escalation';
import { projectService } from '@/lib/project-service';
import type { WorkOrder, GitHubPRResult } from './types';
import type { EnhancedProposerResponse } from '@/lib/enhanced-proposer-service';
import type { RoutingDecision } from '@/lib/manager-routing-rules';

/**
 * Build PR body with metadata
 *
 * @param wo - Work Order
 * @param routingDecision - Manager routing decision
 * @param proposerResponse - Proposer response
 * @returns Formatted PR body in markdown
 */
export function buildPRBody(
  wo: WorkOrder,
  routingDecision: RoutingDecision,
  proposerResponse: EnhancedProposerResponse
): string {
  const parts = [];

  parts.push(`## Work Order: ${wo.id}`);
  parts.push('');
  parts.push(`**Risk Level:** ${wo.risk_level}`);
  parts.push(`**Proposer Used:** ${proposerResponse.proposer_used}`);
  parts.push(`**Complexity Score:** ${routingDecision.routing_metadata?.complexity_score?.toFixed(2) || 'N/A'}`);
  parts.push(`**Cost:** $${proposerResponse.cost.toFixed(4)}`);
  parts.push(`**Hard Stop Required:** ${routingDecision.routing_metadata?.hard_stop_required ? 'Yes' : 'No'}`);

  if (proposerResponse.refinement_metadata) {
    parts.push(`**Refinement Cycles:** ${proposerResponse.refinement_metadata.refinement_count}`);
    if (proposerResponse.refinement_metadata.final_errors !== undefined) {
      parts.push(`**Final Error Count:** ${proposerResponse.refinement_metadata.final_errors}`);
    }
  }

  parts.push('');
  parts.push('## Description');
  parts.push('');
  parts.push(wo.description);
  parts.push('');

  if (wo.acceptance_criteria && wo.acceptance_criteria.length > 0) {
    parts.push('## Acceptance Criteria');
    parts.push('');
    wo.acceptance_criteria.forEach((ac) => {
      parts.push(`- [x] ${ac}`);
    });
    parts.push('');
  }

  if (wo.files_in_scope && wo.files_in_scope.length > 0) {
    parts.push('## Files Modified');
    parts.push('');
    wo.files_in_scope.forEach(f => {
      parts.push(`- \`${f}\``);
    });
    parts.push('');
  }

  parts.push('## Routing Decision');
  parts.push('');
  parts.push(`**Reason:** ${routingDecision.reason}`);
  if (routingDecision.confidence !== undefined) {
    parts.push(`**Confidence:** ${routingDecision.confidence.toFixed(2)}`);
  }
  parts.push('');

  parts.push('## Metadata');
  parts.push('');
  parts.push('```json');
  parts.push(JSON.stringify({
    work_order_id: wo.id,
    routing_metadata: routingDecision.routing_metadata,
    proposer_metadata: {
      cost: proposerResponse.cost,
      token_usage: proposerResponse.token_usage,
      execution_time_ms: proposerResponse.execution_time_ms,
      refinement_metadata: proposerResponse.refinement_metadata
    }
  }, null, 2));
  parts.push('```');
  parts.push('');
  parts.push('---');
  parts.push('');
  parts.push('🤖 Generated with [Moose Mission Control](https://github.com/AI-DevHouse/Moose)');

  return parts.join('\n');
}

/**
 * Push branch and create Pull Request
 *
 * Prerequisites:
 * - GitHub CLI must be installed: gh --version
 * - GitHub CLI must be authenticated: gh auth login
 *
 * @param wo - Work Order
 * @param branchName - Feature branch name
 * @param routingDecision - Manager routing decision
 * @param proposerResponse - Proposer response
 * @param worktreePath - Optional worktree path (overrides project.local_path for concurrent execution)
 * @returns PR result with URL and number
 */
export async function pushBranchAndCreatePR(
  wo: WorkOrder,
  branchName: string,
  routingDecision: RoutingDecision,
  proposerResponse: EnhancedProposerResponse,
  worktreePath?: string
): Promise<GitHubPRResult> {
  console.log(`[GitHubIntegration] Pushing branch and creating PR for WO ${wo.id}`);

  try {
    // Get working directory and repo name (if project_id exists)
    let workingDirectory: string;
    let repoName: string | null = null;

    if (worktreePath) {
      // Use worktree path if provided (from worktree pool)
      workingDirectory = worktreePath;
      console.log(`[GitHubIntegration] Using worktree directory: ${workingDirectory}`);

      // Still get repo name from project
      if (wo.project_id) {
        const project = await projectService.getProject(wo.project_id);
        if (project && project.github_org && project.github_repo_name) {
          repoName = `${project.github_org}/${project.github_repo_name}`;
          console.log(`[GitHubIntegration] Target repository: ${repoName}`);
        }
      }
    } else if (wo.project_id) {
      const project = await projectService.getProject(wo.project_id);
      if (project) {
        workingDirectory = project.local_path;
        // Use org/repo format for GitHub CLI
        if (project.github_org && project.github_repo_name) {
          repoName = `${project.github_org}/${project.github_repo_name}`;
        }
        console.log(`[GitHubIntegration] Using project directory: ${workingDirectory}`);
        if (repoName) {
          console.log(`[GitHubIntegration] Target repository: ${repoName}`);
        }
      } else {
        workingDirectory = process.cwd();
      }
    } else {
      workingDirectory = process.cwd();
    }

    // 1. Push branch to remote
    console.log(`[GitHubIntegration] Pushing branch: ${branchName}`);
    execSync(`git push -u origin ${branchName}`, {
      cwd: workingDirectory,
      stdio: 'pipe'
    });

    // 2. Build PR title and body
    const prTitle = `WO-${wo.id.substring(0, 8)}: ${wo.title}`;
    const prBody = buildPRBody(wo, routingDecision, proposerResponse);

    // 3. Write PR body to temp file (avoids shell escaping issues with complex JSON)
    const tmpDir = os.tmpdir();
    const prBodyPath = path.join(tmpDir, `wo-${wo.id}-pr-body.txt`);
    fs.writeFileSync(prBodyPath, prBody, 'utf-8');
    console.log(`[GitHubIntegration] Created PR body file: ${prBodyPath}`);

    // 4. Create PR via gh CLI
    console.log(`[GitHubIntegration] Creating PR: ${prTitle}`);

    // Escape quotes in title for shell
    const escapedTitle = prTitle.replace(/"/g, '\\"');

    // Try gh command (use full path on Windows if not in PATH)
    const ghCommand = process.platform === 'win32'
      ? '"C:\\Program Files\\GitHub CLI\\gh.exe"'
      : 'gh';

    // Build PR create command
    let prCreateCommand = `${ghCommand} pr create --title "${escapedTitle}" --body-file "${prBodyPath}" --head ${branchName}`;

    // Add --repo flag if project has GitHub repo configured
    if (repoName) {
      prCreateCommand += ` --repo ${repoName}`;
    }

    const prOutput = execSync(prCreateCommand, {
      cwd: workingDirectory,
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    // 5. Extract PR URL from output (gh CLI outputs the URL on the last line)
    const prUrl = prOutput.trim().split('\n').pop() || '';

    console.log(`[GitHubIntegration] PR created: ${prUrl}`);

    // 6. Get PR number
    const prNumber = await getPRNumber(branchName, workingDirectory, repoName);

    // 7. Clean up temp file
    try {
      fs.unlinkSync(prBodyPath);
    } catch (e) {
      console.warn('[GitHubIntegration] Could not delete temp PR body file:', e);
    }

    return {
      pr_url: prUrl,
      pr_number: prNumber,
      branch_name: branchName
    };
  } catch (error: any) {
    await handleCriticalError({
      component: 'GitHubIntegration',
      operation: 'pushBranchAndCreatePR',
      error: error,
      workOrderId: wo.id,
      severity: 'critical',
      metadata: { branchName }
    });

    if (error.message.includes('gh: command not found') || error.message.includes('ENOENT')) {
      throw new Error('GitHub CLI not found. Please install: https://cli.github.com/');
    }

    if (error.message.includes('authentication')) {
      throw new Error('GitHub CLI not authenticated. Please run: gh auth login');
    }

    throw new Error(`Failed to create PR: ${error.message}`);
  }
}

/**
 * Get PR number for a branch
 *
 * @param branchName - Feature branch name
 * @param workingDirectory - Directory to execute command in
 * @param repoName - Repository name (e.g., "user/repo")
 * @returns PR number
 */
async function getPRNumber(
  branchName: string,
  workingDirectory: string = process.cwd(),
  repoName: string | null = null
): Promise<number> {
  try {
    // Try gh command (use full path on Windows if not in PATH)
    const ghCommand = process.platform === 'win32'
      ? '"C:\\Program Files\\GitHub CLI\\gh.exe"'
      : 'gh';

    // Build command - use --json without --jq, parse JSON in code instead (fixes Windows quote escaping issues)
    let prListCommand = `${ghCommand} pr list --head ${branchName} --json number`;

    // Add --repo flag if repo name provided
    if (repoName) {
      prListCommand += ` --repo ${repoName}`;
    }

    const output = execSync(prListCommand, {
      cwd: workingDirectory,
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    // Parse JSON output
    const prList = JSON.parse(output.trim());

    if (!Array.isArray(prList) || prList.length === 0) {
      throw new Error('No PRs found for branch');
    }

    const prNumber = prList[0].number;

    if (typeof prNumber !== 'number' || isNaN(prNumber)) {
      throw new Error('Could not parse PR number');
    }

    return prNumber;
  } catch (error: any) {
    console.error('[GitHubIntegration] Error getting PR number:', error.message);
    // Return 0 if we can't get the PR number (non-fatal)
    return 0;
  }
}

/**
 * Rollback failed PR creation
 *
 * Deletes remote branch and local branch
 *
 * @param branchName - Feature branch to delete
 * @param workingDirectory - Directory to execute git commands in (defaults to current directory)
 */
export function rollbackPR(branchName: string, workingDirectory: string = process.cwd()): void {
  console.log(`[GitHubIntegration] Rolling back PR for branch: ${branchName}`);
  console.log(`[GitHubIntegration] Working directory: ${workingDirectory}`);

  try {
    // Delete remote branch
    try {
      execSync(`git push origin --delete ${branchName}`, {
        cwd: workingDirectory,
        stdio: 'pipe'
      });
    } catch (e) {
      console.warn('[GitHubIntegration] Remote branch does not exist or already deleted');
    }

    // Return to main
    try {
      execSync('git checkout main', { cwd: workingDirectory, stdio: 'pipe' });
    } catch {
      execSync('git checkout master', { cwd: workingDirectory, stdio: 'pipe' });
    }

    // Delete local branch
    execSync(`git branch -D ${branchName}`, {
      cwd: workingDirectory,
      stdio: 'pipe'
    });

    console.log(`[GitHubIntegration] Rollback successful`);
  } catch (error: any) {
    console.error('[GitHubIntegration] Error during rollback:', error.message);
    // Don't throw - rollback is best-effort
  }
}
