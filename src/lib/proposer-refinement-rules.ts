// src/lib/proposer-refinement-rules.ts
// Single source of truth for Proposer self-refinement logic
// Extracted from enhanced-proposer-service.ts for easy modification

import { parseTypeScriptErrors, type TypeScriptError } from './complexity-analyzer';
import type { ProposerRequest } from './enhanced-proposer-service';

// Refinement thresholds (easily modifiable)
export const REFINEMENT_THRESHOLDS = {
  MAX_CYCLES: 3,                    // Up from 1 in Phase 2.2.5
  MIN_ERROR_IMPROVEMENT: 0.25,      // Must fix at least 25% of errors to continue
  ZERO_PROGRESS_ABORT: 2,           // Abort if 2 consecutive cycles with no improvement
  TEMP_DIR: '.temp-refinement',     // Directory for temp TypeScript files
};

// Cost tracking per cycle (for budget monitoring)
export const REFINEMENT_COST_MULTIPLIERS = {
  CYCLE_1: 1.0,   // Base cost
  CYCLE_2: 1.2,   // +20% (more context)
  CYCLE_3: 1.5,   // +50% (full error history)
};

/**
 * Self-refinement metadata returned after refinement process
 */
export interface RefinementResult {
  content: string;                  // Final refined code
  refinement_count: number;         // How many cycles were attempted
  initial_errors: number;           // Starting error count
  final_errors: number;             // Ending error count
  refinement_success: boolean;      // Did we reduce errors?
  error_details: TypeScriptError[]; // Final remaining errors
  cycle_history: Array<{            // NEW: Track each cycle
    cycle: number;
    errors_before: number;
    errors_after: number;
    improvement_rate: number;
    prompt_strategy: string;
  }>;
}

/**
 * Check TypeScript errors for given code
 * Writes code to temp file, runs tsc --noEmit, parses output
 */
export async function checkTypeScriptErrors(code: string): Promise<TypeScriptError[]> {
  const fs = require('fs');
  const path = require('path');
  const { execSync } = require('child_process');

  const tempDir = path.join(process.cwd(), REFINEMENT_THRESHOLDS.TEMP_DIR);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempFile = path.join(tempDir, `check-${Date.now()}.ts`);

  try {
    fs.writeFileSync(tempFile, code, 'utf8');

    execSync(`npx tsc --noEmit ${tempFile}`, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe'
    });

    return []; // No errors

  } catch (error: any) {
    const stderr = error.stderr || error.stdout || '';
    const errors = parseTypeScriptErrors(stderr);
    return errors;

  } finally {
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch (cleanupError) {
      console.error('Failed to cleanup temp file:', cleanupError);
    }
  }
}

/**
 * Build refinement prompt with cycle-specific strategies
 * Cycle 1: Focus on syntax and imports
 * Cycle 2: Focus on type safety and missing declarations
 * Cycle 3: Aggressive fixes with fallback strategies
 */
export function buildRefinementPrompt(
  request: ProposerRequest,
  previousCode: string,
  errors: TypeScriptError[],
  cycleNumber: number,
  cycleHistory: Array<{ cycle: number; errors_before: number; errors_after: number }>
): string {
  const errorSummary = errors.map(e =>
    `- Line ${e.line}, Column ${e.column}: ${e.code} - ${e.message}`
  ).join('\n');

  // Cycle-specific prompting strategies
  let strategyGuidance = '';

  if (cycleNumber === 1) {
    strategyGuidance = `
REFINEMENT STRATEGY (Cycle 1/3): SYNTAX & IMPORTS
Focus on:
1. Add missing imports (React, types, utilities)
2. Fix syntax errors (brackets, semicolons, quotes)
3. Correct obvious typos in variable names
4. Ensure all type definitions are present`;

  } else if (cycleNumber === 2) {
    const previousCycle = cycleHistory[cycleHistory.length - 1];
    const improvementRate = previousCycle ?
      ((previousCycle.errors_before - previousCycle.errors_after) / previousCycle.errors_before * 100).toFixed(0) :
      '0';

    strategyGuidance = `
REFINEMENT STRATEGY (Cycle 2/3): TYPE SAFETY & DECLARATIONS
Previous cycle improved ${improvementRate}% of errors. Now focus on:
1. Declare all variables before use
2. Add proper type annotations to functions
3. Fix interface/type mismatches
4. Resolve 'undefined' and 'null' type issues
5. Ensure generic type parameters are correct`;

  } else {
    // Cycle 3: Aggressive fixes
    const totalImprovement = cycleHistory.reduce((sum, c) => sum + (c.errors_before - c.errors_after), 0);
    const remainingErrors = errors.length;

    strategyGuidance = `
REFINEMENT STRATEGY (Cycle 3/3 - FINAL): AGGRESSIVE FIXES
After ${cycleHistory.length} cycles, ${remainingErrors} errors remain (${totalImprovement} fixed so far).
This is the FINAL attempt. Try alternative approaches:
1. Rewrite problematic sections entirely (don't just patch)
2. Use 'any' as temporary escape hatch for stubborn type errors (comment with TODO)
3. Simplify complex type logic that's causing cascading errors
4. Consider removing features that are too complex to fix quickly
5. Ensure ALL critical functionality works (accept minor edge-case errors if needed)

IMPORTANT: Provide working code even if it means temporary compromises.`;
  }

  return `${request.task_description}

PREVIOUS ATTEMPT HAD ${errors.length} TYPESCRIPT ERRORS:
${errorSummary}

${strategyGuidance}

PREVIOUS CODE:
\`\`\`typescript
${previousCode}
\`\`\`

${cycleNumber === 3 ? 'FINAL ATTEMPT - Make it work!' : 'Please fix these TypeScript errors and provide corrected code.'}

Requirements:
1. All imports must be present
2. All types must be correctly defined
3. All variables must be declared before use
4. Function signatures must have proper type annotations
5. No syntax errors

Provide ONLY the corrected code without explanation.`;
}

/**
 * Perform multi-cycle self-refinement with adaptive prompting
 * Returns final code + metadata about refinement process
 */
export async function attemptSelfRefinement(
  originalContent: string,
  request: ProposerRequest,
  executeProposer: (request: ProposerRequest) => Promise<{ content: string }>,
  maxCycles: number = REFINEMENT_THRESHOLDS.MAX_CYCLES
): Promise<RefinementResult> {
  let currentContent = originalContent;
  let refinementCount = 0;
  let consecutiveZeroProgress = 0;
  const cycleHistory: RefinementResult['cycle_history'] = [];

  // Initial error check
  const initialErrors = await checkTypeScriptErrors(currentContent);
  const initialErrorCount = initialErrors.length;
  let currentErrors = initialErrors;

  console.log('🔍 SELF-REFINEMENT: Initial TS check found', initialErrorCount, 'errors');

  if (initialErrorCount === 0) {
    return {
      content: currentContent,
      refinement_count: 0,
      initial_errors: 0,
      final_errors: 0,
      refinement_success: true,
      error_details: [],
      cycle_history: []
    };
  }

  // Multi-cycle refinement loop
  while (refinementCount < maxCycles && currentErrors.length > 0) {
    refinementCount++;
    const errorsBefore = currentErrors.length;

    console.log(`🔧 SELF-REFINEMENT: Cycle ${refinementCount}/${maxCycles}`);
    console.log(`   Errors to fix: ${errorsBefore}`);
    console.log(`   Top 3 errors: ${currentErrors.slice(0, 3).map(e => e.code).join(', ')}`);

    // Build cycle-specific prompt
    const refinementPrompt = buildRefinementPrompt(
      request,
      currentContent,
      currentErrors,
      refinementCount,
      cycleHistory
    );

    // Execute refinement with proposer
    const refinedResponse = await executeProposer({
      ...request,
      task_description: refinementPrompt
    });

    currentContent = refinedResponse.content;

    // Check new errors
    const newErrors = await checkTypeScriptErrors(currentContent);
    const errorsAfter = newErrors.length;
    const errorsFixed = errorsBefore - errorsAfter;
    const improvementRate = errorsFixed / errorsBefore;

    console.log(`   Result: ${errorsBefore} → ${errorsAfter} errors (${errorsFixed >= 0 ? 'fixed ' + errorsFixed : 'added ' + Math.abs(errorsFixed)})`);

    // Track cycle history
    cycleHistory.push({
      cycle: refinementCount,
      errors_before: errorsBefore,
      errors_after: errorsAfter,
      improvement_rate: improvementRate,
      prompt_strategy: refinementCount === 1 ? 'syntax_imports' :
                       refinementCount === 2 ? 'type_safety' :
                       'aggressive_fixes'
    });

    currentErrors = newErrors;

    // Abort if no progress for 2 consecutive cycles
    if (errorsFixed <= 0) {
      consecutiveZeroProgress++;
      console.warn(`   ⚠️  No improvement (${consecutiveZeroProgress}/${REFINEMENT_THRESHOLDS.ZERO_PROGRESS_ABORT})`);

      if (consecutiveZeroProgress >= REFINEMENT_THRESHOLDS.ZERO_PROGRESS_ABORT) {
        console.warn('   🛑 Aborting: No progress after 2 consecutive cycles');
        break;
      }
    } else {
      consecutiveZeroProgress = 0;
    }

    // Abort if improvement rate too low (except on final cycle)
    if (improvementRate < REFINEMENT_THRESHOLDS.MIN_ERROR_IMPROVEMENT &&
        refinementCount < maxCycles) {
      console.warn(`   ⚠️  Low improvement rate: ${(improvementRate * 100).toFixed(0)}% (threshold: ${REFINEMENT_THRESHOLDS.MIN_ERROR_IMPROVEMENT * 100}%)`);
      // Continue anyway - might improve in next cycle
    }
  }

  const refinementSuccess = currentErrors.length < initialErrorCount;
  const finalErrorReduction = ((initialErrorCount - currentErrors.length) / initialErrorCount * 100).toFixed(0);

  console.log(`✅ SELF-REFINEMENT: Complete after ${refinementCount} cycles`);
  console.log(`   Initial: ${initialErrorCount} errors → Final: ${currentErrors.length} errors`);
  console.log(`   Overall improvement: ${finalErrorReduction}%`);

  return {
    content: currentContent,
    refinement_count: refinementCount,
    initial_errors: initialErrorCount,
    final_errors: currentErrors.length,
    refinement_success: refinementSuccess,
    error_details: currentErrors,
    cycle_history: cycleHistory
  };
}

/**
 * Calculate estimated cost multiplier for refinement cycle
 * Later cycles have more context = higher cost
 */
export function getRefinementCostMultiplier(cycleNumber: number): number {
  switch (cycleNumber) {
    case 1: return REFINEMENT_COST_MULTIPLIERS.CYCLE_1;
    case 2: return REFINEMENT_COST_MULTIPLIERS.CYCLE_2;
    case 3: return REFINEMENT_COST_MULTIPLIERS.CYCLE_3;
    default: return 1.0;
  }
}

/**
 * Update refinement thresholds (for future dynamic configuration)
 */
export function updateRefinementThresholds(
  updates: Partial<typeof REFINEMENT_THRESHOLDS>
): void {
  Object.assign(REFINEMENT_THRESHOLDS, updates);
}

/**
 * Get current thresholds (for inspection/debugging)
 */
export function getRefinementThresholds() {
  return { ...REFINEMENT_THRESHOLDS };
}
