// src/lib/proposer-refinement-rules.ts
// Single source of truth for Proposer self-refinement logic
// Extracted from enhanced-proposer-service.ts for easy modification

import { parseTypeScriptErrors, type TypeScriptError } from './complexity-analyzer';
import type { ProposerRequest } from './enhanced-proposer-service';
import { sanitizeTypeScript } from './code-sanitizer';

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
  contract_violations?: Array<{     // NEW: Contract violations per cycle
    cycle: number;
    breaking_changes: number;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    violations: any[];
  }>;
  final_contract_validation?: any;  // Final contract validation result
  sanitizer_metadata?: {            // NEW: Sanitizer telemetry (Phase 1)
    initial_changes: string[];      // Changes made before initial TS check
    cycle_changes: Array<{          // Changes made after each cycle
      cycle: number;
      changes: string[];
    }>;
    total_functions_triggered: number; // Total sanitizer corrections applied
  };
  cycle_history: Array<{            // Track each cycle
    cycle: number;
    errors_before: number;
    errors_after: number;
    improvement_rate: number;
    prompt_strategy: string;
    contract_violations?: number;   // NEW: Contract violations in this cycle
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
  cycleHistory: Array<{ cycle: number; errors_before: number; errors_after: number }>,
  contractViolations?: Array<{ cycle: number; breaking_changes: number; risk_level: string; violations: any[] }>
): string {
  const errorSummary = errors.map(e =>
    `- Line ${e.line}, Column ${e.column}: ${e.code} - ${e.message}`
  ).join('\n');

  // Contract violations summary
  let contractSummary = '';
  if (contractViolations && contractViolations.length > 0) {
    const latestViolation = contractViolations[contractViolations.length - 1];
    if (latestViolation.violations && latestViolation.violations.length > 0) {
      contractSummary = `

CONTRACT VIOLATIONS DETECTED (${latestViolation.risk_level.toUpperCase()} RISK):
${latestViolation.violations.map((bc: any) =>
  `- ${bc.type}: ${bc.impact_description}`
).join('\n')}

CRITICAL: Fix these contract violations or code will be rejected!`;
    }
  }

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
${errorSummary}${contractSummary}

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
  maxCycles: number = REFINEMENT_THRESHOLDS.MAX_CYCLES,
  validateContract?: (code: string) => Promise<any>
): Promise<RefinementResult> {
  let currentContent = originalContent;
  let refinementCount = 0;
  let consecutiveZeroProgress = 0;
  const cycleHistory: RefinementResult['cycle_history'] = [];
  const contractViolationHistory: RefinementResult['contract_violations'] = [];

  // Track sanitizer changes for telemetry
  const sanitizerInitialChanges: string[] = [];
  const sanitizerCycleChanges: Array<{ cycle: number; changes: string[] }> = [];
  let totalSanitizerFunctions = 0;

  // Pre-process original content to fix mechanical issues
  const sanitizerResult = sanitizeTypeScript(currentContent);
  if (sanitizerResult.changes_made.length > 0) {
    console.log(`🧹 SANITIZER: Auto-fixed ${sanitizerResult.changes_made.length} issue(s): ${sanitizerResult.changes_made.join(', ')}`);
    currentContent = sanitizerResult.sanitized;
    sanitizerInitialChanges.push(...sanitizerResult.changes_made);
    totalSanitizerFunctions += sanitizerResult.telemetry.functions_triggered;
  }

  // Initial error check (on sanitized code)
  const initialErrors = await checkTypeScriptErrors(currentContent);
  const initialErrorCount = initialErrors.length;
  let currentErrors = initialErrors;

  console.log('🔍 SELF-REFINEMENT: Initial TS check found', initialErrorCount, 'errors');

  // Initial contract validation check
  let currentContractValidation: any = null;
  if (validateContract) {
    try {
      currentContractValidation = await validateContract(currentContent);
      if (currentContractValidation && currentContractValidation.breaking_changes.length > 0) {
        contractViolationHistory.push({
          cycle: 0,
          breaking_changes: currentContractValidation.breaking_changes.length,
          risk_level: currentContractValidation.risk_assessment.level,
          violations: currentContractValidation.breaking_changes
        });
        console.log(`⚠️ SELF-REFINEMENT: Initial contract check found ${currentContractValidation.breaking_changes.length} violations (${currentContractValidation.risk_assessment.level} risk)`);
      } else {
        console.log('✅ SELF-REFINEMENT: Initial contract check passed');
      }
    } catch (error) {
      console.error('Contract validation failed on initial check:', error);
    }
  }

  if (initialErrorCount === 0 && (!currentContractValidation || currentContractValidation.breaking_changes.length === 0)) {
    return {
      content: currentContent,
      refinement_count: 0,
      initial_errors: 0,
      final_errors: 0,
      refinement_success: true,
      error_details: [],
      contract_violations: contractViolationHistory,
      final_contract_validation: currentContractValidation,
      sanitizer_metadata: totalSanitizerFunctions > 0 ? {
        initial_changes: sanitizerInitialChanges,
        cycle_changes: sanitizerCycleChanges,
        total_functions_triggered: totalSanitizerFunctions
      } : undefined,
      cycle_history: []
    };
  }

  // Multi-cycle refinement loop
  while (refinementCount < maxCycles && (currentErrors.length > 0 || (currentContractValidation && currentContractValidation.breaking_changes.length > 0))) {
    refinementCount++;
    const errorsBefore = currentErrors.length;
    const contractViolationsBefore = currentContractValidation?.breaking_changes.length || 0;

    console.log(`🔧 SELF-REFINEMENT: Cycle ${refinementCount}/${maxCycles}`);
    console.log(`   TS Errors to fix: ${errorsBefore}`);
    console.log(`   Contract violations to fix: ${contractViolationsBefore}`);
    if (errorsBefore > 0) {
      console.log(`   Top 3 TS errors: ${currentErrors.slice(0, 3).map(e => e.code).join(', ')}`);
    }

    // Build cycle-specific prompt
    const refinementPrompt = buildRefinementPrompt(
      request,
      currentContent,
      currentErrors,
      refinementCount,
      cycleHistory,
      contractViolationHistory
    );

    // Execute refinement with proposer
    const refinedResponse = await executeProposer({
      ...request,
      task_description: refinementPrompt
    });

    currentContent = refinedResponse.content;

    // Sanitize refined code before checking errors
    const cycleSanitizerResult = sanitizeTypeScript(currentContent);
    if (cycleSanitizerResult.changes_made.length > 0) {
      console.log(`   🧹 Sanitizer auto-fixed ${cycleSanitizerResult.changes_made.length} issue(s): ${cycleSanitizerResult.changes_made.join(', ')}`);
      currentContent = cycleSanitizerResult.sanitized;
      sanitizerCycleChanges.push({
        cycle: refinementCount,
        changes: cycleSanitizerResult.changes_made
      });
      totalSanitizerFunctions += cycleSanitizerResult.telemetry.functions_triggered;
    }

    // Check new errors (on sanitized code)
    const newErrors = await checkTypeScriptErrors(currentContent);
    const errorsAfter = newErrors.length;
    const errorsFixed = errorsBefore - errorsAfter;
    const improvementRate = errorsBefore > 0 ? errorsFixed / errorsBefore : 0;

    console.log(`   TS Result: ${errorsBefore} → ${errorsAfter} errors (${errorsFixed >= 0 ? 'fixed ' + errorsFixed : 'added ' + Math.abs(errorsFixed)})`);

    // Check contract violations
    let contractViolationsAfter = 0;
    if (validateContract) {
      try {
        currentContractValidation = await validateContract(currentContent);
        contractViolationsAfter = currentContractValidation?.breaking_changes.length || 0;

        if (contractViolationsAfter > 0) {
          contractViolationHistory.push({
            cycle: refinementCount,
            breaking_changes: contractViolationsAfter,
            risk_level: currentContractValidation.risk_assessment.level,
            violations: currentContractValidation.breaking_changes
          });
          console.log(`   Contract Result: ${contractViolationsBefore} → ${contractViolationsAfter} violations (${contractViolationsBefore - contractViolationsAfter >= 0 ? 'fixed ' + (contractViolationsBefore - contractViolationsAfter) : 'added ' + Math.abs(contractViolationsBefore - contractViolationsAfter)})`);
        } else {
          console.log(`   Contract Result: ✅ No violations`);
        }
      } catch (error) {
        console.error(`   Contract validation failed in cycle ${refinementCount}:`, error);
      }
    }

    // Track cycle history
    cycleHistory.push({
      cycle: refinementCount,
      errors_before: errorsBefore,
      errors_after: errorsAfter,
      improvement_rate: improvementRate,
      prompt_strategy: refinementCount === 1 ? 'syntax_imports' :
                       refinementCount === 2 ? 'type_safety' :
                       'aggressive_fixes',
      contract_violations: contractViolationsAfter
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
  const finalErrorReduction = initialErrorCount > 0 ? ((initialErrorCount - currentErrors.length) / initialErrorCount * 100).toFixed(0) : '100';
  const finalContractViolations = currentContractValidation?.breaking_changes.length || 0;

  console.log(`✅ SELF-REFINEMENT: Complete after ${refinementCount} cycles`);
  console.log(`   Initial: ${initialErrorCount} TS errors → Final: ${currentErrors.length} errors`);
  console.log(`   Overall TS improvement: ${finalErrorReduction}%`);
  if (validateContract) {
    const initialContractViolations = contractViolationHistory[0]?.breaking_changes || 0;
    console.log(`   Initial: ${initialContractViolations} contract violations → Final: ${finalContractViolations} violations`);
  }

  return {
    content: currentContent,
    refinement_count: refinementCount,
    initial_errors: initialErrorCount,
    final_errors: currentErrors.length,
    refinement_success: refinementSuccess,
    error_details: currentErrors,
    contract_violations: contractViolationHistory,
    final_contract_validation: currentContractValidation,
    sanitizer_metadata: totalSanitizerFunctions > 0 ? {
      initial_changes: sanitizerInitialChanges,
      cycle_changes: sanitizerCycleChanges,
      total_functions_triggered: totalSanitizerFunctions
    } : undefined,
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
