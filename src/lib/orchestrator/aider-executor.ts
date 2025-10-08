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
import type { WorkOrder, AiderResult } from './types';
import type { EnhancedProposerResponse } from '@/lib/enhanced-proposer-service';

/**
 * Create Aider instruction file
 *
 * @param wo - Work Order
 * @param proposerResponse - Proposer response with generated code
 * @returns Path to instruction file
 */
export function createAiderInstructionFile(
  wo: WorkOrder,
  proposerResponse: EnhancedProposerResponse
): string {
  const instructionParts = [];

  instructionParts.push(`Work Order ID: ${wo.id}`);
  instructionParts.push(`Title: ${wo.title}`);
  instructionParts.push('');
  instructionParts.push('Description:');
  instructionParts.push(wo.description);
  instructionParts.push('');

  if (wo.acceptance_criteria && wo.acceptance_criteria.length > 0) {
    instructionParts.push('Acceptance Criteria:');
    wo.acceptance_criteria.forEach((ac, i) => {
      instructionParts.push(`${i + 1}. ${ac}`);
    });
    instructionParts.push('');
  }

  if (wo.files_in_scope && wo.files_in_scope.length > 0) {
    instructionParts.push('Files to modify:');
    wo.files_in_scope.forEach(f => {
      instructionParts.push(`- ${f}`);
    });
    instructionParts.push('');
  }

  instructionParts.push(`Generated code from ${proposerResponse.proposer_used}:`);
  instructionParts.push('');
  instructionParts.push(proposerResponse.content);
  instructionParts.push('');
  instructionParts.push('Instructions:');
  instructionParts.push('1. Create/modify the files listed above');
  instructionParts.push('2. Apply the generated code changes');
  instructionParts.push('3. Ensure all acceptance criteria are met');
  instructionParts.push('4. Commit changes with descriptive message');

  const instruction = instructionParts.join('\n').trim();

  const tmpDir = os.tmpdir();
  const instructionPath = path.join(tmpDir, `wo-${wo.id}-instruction.txt`);
  fs.writeFileSync(instructionPath, instruction, 'utf-8');

  console.log(`[AiderExecutor] Created instruction file: ${instructionPath}`);

  return instructionPath;
}

/**
 * Create feature branch for Work Order
 *
 * @param wo - Work Order
 * @param workingDirectory - Directory to execute git commands in
 * @returns Branch name
 */
export async function createFeatureBranch(
  wo: WorkOrder,
  workingDirectory: string
): Promise<string> {
  const slug = wo.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30);

  const branchName = `feature/wo-${wo.id.substring(0, 8)}-${slug}`;

  console.log(`[AiderExecutor] Creating feature branch: ${branchName}`);
  console.log(`[AiderExecutor] Working directory: ${workingDirectory}`);

  try {
    // Get current branch (don't switch - create feature branch from wherever we are)
    const currentBranch = execSync('git branch --show-current', {
      cwd: workingDirectory,
      encoding: 'utf-8'
    }).trim();

    console.log(`[AiderExecutor] Current branch: ${currentBranch}`);
    console.log(`[AiderExecutor] Creating feature branch from current branch`);

    // Create feature branch from current branch
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
 * Execute Aider CLI to apply code changes
 *
 * Prerequisites:
 * - Aider must be installed: pip install aider-chat
 * - ANTHROPIC_API_KEY or OPENAI_API_KEY in environment
 *
 * @param wo - Work Order
 * @param proposerResponse - Proposer response
 * @param selectedProposer - Model selected by Manager
 * @returns Aider execution result
 */
export async function executeAider(
  wo: WorkOrder,
  proposerResponse: EnhancedProposerResponse,
  selectedProposer: string
): Promise<AiderResult> {
  console.log(`[AiderExecutor] Starting Aider execution for WO ${wo.id}`);

  // 0. SAFETY CHECK: Prevent self-modification
  validateWorkOrderSafety(wo.id, wo.project_id);

  // 1. Get and validate project (if project_id exists)
  let workingDirectory = process.cwd(); // Default: current directory (for backward compatibility)

  if (wo.project_id) {
    console.log(`[AiderExecutor] Work order linked to project: ${wo.project_id}`);

    // Validate project and get working directory
    const project = await projectValidator.validateOrThrow(wo.project_id);
    workingDirectory = project.local_path;

    console.log(`[AiderExecutor] Using project directory: ${workingDirectory}`);
  } else {
    console.warn(
      `[AiderExecutor] ⚠️  Work order ${wo.id} has no project_id. ` +
      `Executing in current directory: ${workingDirectory}`
    );
  }

  // 2. Create instruction file
  const instructionPath = createAiderInstructionFile(wo, proposerResponse);

  // 3. Create feature branch
  const branchName = await createFeatureBranch(wo, workingDirectory);

  // 4. Lookup Aider model from ProposerRegistry (uses model field from database)
  await proposerRegistry.initialize();
  const proposerConfig = proposerRegistry.getProposer(selectedProposer);

  if (!proposerConfig) {
    throw new Error(`Proposer '${selectedProposer}' not found in registry`);
  }

  const aiderModel = proposerConfig.name || 'claude-sonnet-4-20250514'; // Fallback to Claude Sonnet 4.5
  console.log(`[AiderExecutor] Using Aider model: ${aiderModel} (from proposer: ${selectedProposer})`);

  // 5. Build file list
  const files = wo.files_in_scope || [];
  if (files.length === 0) {
    throw new Error('files_in_scope is empty - cannot execute Aider without target files');
  }

  console.log(`[AiderExecutor] Executing Aider with model ${aiderModel} on ${files.length} files`);

  // 6. Spawn Aider process in project directory
  return new Promise((resolve, reject) => {
    const aiderArgs = [
      '--message-file', instructionPath,
      '--model', aiderModel,
      '--yes',
      '--auto-commits',
      ...files
    ];

    console.log(`[AiderExecutor] Command: py -3.11 -m aider ${aiderArgs.join(' ')}`);

    // Use Python 3.11 to run Aider (installed via: py -3.11 -m pip install aider-chat)
    const aiderProcess = spawn('py', ['-3.11', '-m', 'aider', ...aiderArgs], {
      cwd: workingDirectory,  // Execute in project directory
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY
      },
      timeout: 300000 // 5 minutes
    });

    let stdout = '';
    let stderr = '';

    aiderProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log('[Aider]', output);
    });

    aiderProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error('[Aider Error]', output);
    });

    aiderProcess.on('close', (code) => {
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
      } else {
        console.error(`[AiderExecutor] Aider exited with code ${code}`);
        reject(new Error(`Aider exited with code ${code}: ${stderr}`));
      }
    });

    aiderProcess.on('error', (error) => {
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
