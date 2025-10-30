// Compilation Gate - TypeScript validation for Aider output
// Checks for TS errors and decides: proceed, warn, or escalate

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface CompilationResult {
  decision: 'proceed' | 'warn' | 'escalate';
  error_count: number;
  errors: TypeScriptError[];
  advice?: string;
}

export interface TypeScriptError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

/**
 * Compilation thresholds (configurable via env vars)
 */
const THRESHOLDS = {
  PROCEED: parseInt(process.env.COMPILATION_GATE_PROCEED_THRESHOLD || '0', 10),    // 0 errors
  WARN: parseInt(process.env.COMPILATION_GATE_WARN_THRESHOLD || '5', 10),          // 1-5 errors
  // 6+ errors = escalate
};

/**
 * Check TypeScript compilation in project
 *
 * Runs `npx tsc --noEmit` in the project directory and parses errors.
 *
 * Decision logic:
 * - 0 errors → proceed (auto-merge)
 * - 1-5 errors → warn (log but allow, for review)
 * - 6+ errors → escalate (send to Claude review system)
 *
 * @param projectPath - Path to project directory
 * @param workOrderId - WO ID for logging
 * @returns Compilation result with decision
 */
export async function checkCompilation(
  projectPath: string,
  workOrderId: string
): Promise<CompilationResult> {
  console.log(`[CompilationGate] Checking TypeScript compilation for WO ${workOrderId}`);
  console.log(`[CompilationGate] Project path: ${projectPath}`);

  try {
    // Run TypeScript compiler in noEmit mode (check only, don't build)
    const output = execSync('npx tsc --noEmit', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 60000 // 1 minute timeout
    });

    // No output = no errors
    console.log(`[CompilationGate] ✅ No TypeScript errors detected`);

    return {
      decision: 'proceed',
      error_count: 0,
      errors: [],
      advice: 'Compilation successful, proceed with merge'
    };

  } catch (error: any) {
    // TypeScript errors cause tsc to exit with non-zero code
    const stderr = error.stderr?.toString() || '';
    const stdout = error.stdout?.toString() || '';
    const output = stderr || stdout;

    // Parse TypeScript errors from output
    const errors = parseTypeScriptErrors(output);
    const errorCount = errors.length;

    console.log(`[CompilationGate] Found ${errorCount} TypeScript error(s)`);

    // Decision logic based on error count
    if (errorCount === THRESHOLDS.PROCEED) {
      return {
        decision: 'proceed',
        error_count: errorCount,
        errors: [],
        advice: 'No errors, proceed with merge'
      };
    } else if (errorCount <= THRESHOLDS.WARN) {
      console.warn(`[CompilationGate] ⚠️  ${errorCount} error(s) - within warning threshold`);
      return {
        decision: 'warn',
        error_count: errorCount,
        errors: errors.slice(0, 10), // First 10 errors for logging
        advice: `${errorCount} error(s) detected, below escalation threshold. Review recommended but not blocking.`
      };
    } else {
      console.error(`[CompilationGate] ❌ ${errorCount} error(s) - escalating for Claude review`);
      return {
        decision: 'escalate',
        error_count: errorCount,
        errors: errors.slice(0, 20), // First 20 errors for review
        advice: `${errorCount} error(s) exceed threshold. Escalating to Claude review system for analysis and fixes.`
      };
    }
  }
}

/**
 * Parse TypeScript error output into structured format
 *
 * Example input:
 * src/lib/example.ts(45,12): error TS2304: Cannot find name 'foo'.
 *
 * @param output - Raw tsc output
 * @returns Array of parsed errors
 */
function parseTypeScriptErrors(output: string): TypeScriptError[] {
  const errors: TypeScriptError[] = [];

  // Regex for TypeScript error format: file(line,col): error CODE: message
  const errorRegex = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;

  let match;
  while ((match = errorRegex.exec(output)) !== null) {
    errors.push({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      code: match[4],
      message: match[5]
    });
  }

  return errors;
}

/**
 * Format errors for logging/display
 */
export function formatErrorSummary(result: CompilationResult): string {
  if (result.error_count === 0) {
    return '✅ Compilation successful (0 errors)';
  }

  const lines = [
    `TypeScript Errors: ${result.error_count}`,
    `Decision: ${result.decision.toUpperCase()}`,
    ''
  ];

  if (result.errors.length > 0) {
    lines.push('Top errors:');
    result.errors.slice(0, 5).forEach(err => {
      lines.push(`  ${err.file}:${err.line}:${err.column} - ${err.code}: ${err.message}`);
    });
  }

  if (result.advice) {
    lines.push('');
    lines.push(`Advice: ${result.advice}`);
  }

  return lines.join('\n');
}
