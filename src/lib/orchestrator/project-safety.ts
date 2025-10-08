// Project Safety - Prevents Moose from modifying its own codebase

import * as fs from 'fs';
import * as path from 'path';

/**
 * Check if a directory is Moose's own repository
 *
 * Uses file-based detection to identify Moose's codebase
 *
 * @param dirPath - Directory path to check
 * @returns true if directory is Moose repository
 */
export function isMooseRepository(dirPath: string): boolean {
  // Check for unique Moose files that wouldn't exist in generated apps
  const mooseIndicators = [
    'src/lib/architect-service.ts',
    'src/lib/proposer-registry.ts',
    'src/app/api/architect/decompose/route.ts',
    'src/lib/orchestrator/aider-executor.ts'
  ];

  return mooseIndicators.some(indicator =>
    fs.existsSync(path.join(dirPath, indicator))
  );
}

/**
 * Validate work order can be safely executed
 *
 * Prevents execution if:
 * - No project_id is set
 * - Current working directory is Moose's repository
 *
 * @param workOrderId - Work order ID for error messages
 * @param projectId - Project ID (null/undefined triggers check)
 * @throws Error if safety check fails
 */
export function validateWorkOrderSafety(
  workOrderId: string,
  projectId: string | null | undefined
): void {
  // If no project_id, check if we're in Moose's repo
  if (!projectId) {
    const currentDir = process.cwd();

    if (isMooseRepository(currentDir)) {
      throw new Error(
        `🚨 SAFETY CHECK FAILED: Work order ${workOrderId} has no project_id.\n` +
        `This would modify Moose's own codebase!\n` +
        `Current directory: ${currentDir}\n` +
        `All work orders must be linked to a target project.\n` +
        `\n` +
        `To fix:\n` +
        `1. Create a project: POST /api/projects/initialize\n` +
        `2. Link work order to project: UPDATE work_orders SET project_id = '...' WHERE id = '${workOrderId}'`
      );
    }

    // If not in Moose's repo but still no project_id, warn but allow
    // (for backward compatibility during migration)
    console.warn(
      `⚠️  WARNING: Work order ${workOrderId} has no project_id.\n` +
      `This will execute in current directory: ${currentDir}\n` +
      `Please assign project_id to ensure isolation.`
    );
  }
}
