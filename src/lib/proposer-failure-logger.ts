/**
 * Proposer Failure Logger
 *
 * Logs proposer refinement outcomes (failures and sampled successes) to enable
 * meta-AI learning loop and prompt enhancement analysis.
 *
 * Integration: enhanced-proposer-service.ts lines 336-367
 * Database: proposer_failures table (migration 003)
 * Sampling: 100% failures, 10% successes
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
// DEPRECATED v149: proposer-refinement-rules removed
// import type { RefinementResult } from './proposer-refinement-rules';
type RefinementResult = any; // Placeholder for backwards compatibility
import type { ValidationResult } from './contract-validator';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface ProposerFailureData {
  // Work order context
  work_order_id?: string;
  proposer_name: string;

  // Complexity context
  complexity_score: number;

  // Refinement metadata
  refinement_metadata: RefinementResult;

  // Optional: Contract validation result
  contract_validation?: ValidationResult;

  // Optional: Sanitizer telemetry (from proposer-refinement-rules.ts)
  sanitizer_metadata?: {
    changes_made: string[];
    functions_triggered: number;
  };
}

export interface FailureLogResult {
  logged: boolean;
  reason: string;
  failure_id?: string;
}

/**
 * Determine complexity band from score
 * Bands: 0.0-0.1, 0.1-0.2, 0.2-0.3, 0.3-0.4, 0.4-0.5, 0.5-0.6, 0.6-0.7, 0.7-0.8, 0.8-0.9, 0.9-1.0
 */
function getComplexityBand(score: number): string {
  const lowerBound = Math.floor(score * 10) / 10;
  const upperBound = lowerBound + 0.1;
  return `${lowerBound.toFixed(1)}-${upperBound.toFixed(1)}`;
}

/**
 * Classify failure based on refinement outcome
 */
function classifyFailure(data: ProposerFailureData): string | null {
  const { refinement_metadata, contract_validation } = data;

  // Success case - no classification needed
  if (refinement_metadata.final_errors === 0 &&
      (!contract_validation || contract_validation.breaking_changes.length === 0)) {
    return null;
  }

  // Contract violations present
  if (contract_validation && contract_validation.breaking_changes.length > 0) {
    return 'contract_violation';
  }

  // TypeScript errors present
  if (refinement_metadata.final_errors > 0) {
    // Further classify by error types
    const errorCodes = refinement_metadata.error_details.map(e => e.code);
    const hasImportErrors = errorCodes.some(c => c === 'TS2307' || c === 'TS2304');
    const hasSyntaxErrors = errorCodes.some(c => c.startsWith('TS1'));
    const hasTypeErrors = errorCodes.some(c => c.startsWith('TS2'));

    if (hasSyntaxErrors) {
      return 'syntax_error';
    } else if (hasImportErrors) {
      return 'import_error';
    } else if (hasTypeErrors) {
      return 'type_error';
    } else {
      return 'compile_error';
    }
  }

  return 'unknown_failure';
}

/**
 * Should we log this attempt?
 * - 100% of failures
 * - 10% of successes (for baseline comparison)
 */
function shouldLogAttempt(isSuccess: boolean): boolean {
  if (!isSuccess) {
    return true; // Always log failures
  }
  // 10% sampling for successes
  return Math.random() < 0.10;
}

/**
 * Extract error samples (first 5 errors with details)
 */
function extractErrorSamples(refinement_metadata: RefinementResult): any[] {
  return refinement_metadata.error_details.slice(0, 5).map(error => ({
    code: error.code,
    message: error.message,
    line: error.line,
    column: error.column
  }));
}

/**
 * Log proposer failure/success to database for learning loop
 *
 * Integration point: Call after refinement completes in enhanced-proposer-service.ts
 *
 * Example usage:
 * ```typescript
 * if (refinementMetadata && refinementMetadata.final_errors > 0) {
 *   await logProposerFailure({
 *     work_order_id: request.metadata?.work_order_id,
 *     proposer_name: proposerName,
 *     complexity_score: complexityAnalysis.score,
 *     refinement_metadata: refinementMetadata,
 *     contract_validation: contractValidation,
 *     sanitizer_metadata: {
 *       changes_made: sanitizerResult.changes_made,
 *       functions_triggered: sanitizerResult.telemetry.functions_triggered
 *     }
 *   });
 * }
 * ```
 */
export async function logProposerFailure(data: ProposerFailureData): Promise<FailureLogResult> {
  try {
    const { refinement_metadata, complexity_score } = data;

    // Determine if this is a success or failure
    const isSuccess = refinement_metadata.final_errors === 0 &&
                      (!data.contract_validation || data.contract_validation.breaking_changes.length === 0);

    // Apply sampling logic
    if (!shouldLogAttempt(isSuccess)) {
      return {
        logged: false,
        reason: 'Skipped by sampling (10% success sampling)'
      };
    }

    const failureCategory = classifyFailure(data);
    const complexityBand = getComplexityBand(complexity_score);

    // Extract error codes and samples
    const errorCodes = refinement_metadata.error_details.map(e => e.code);
    const errorSamples = extractErrorSamples(refinement_metadata);

    // Prepare sanitizer telemetry
    const sanitizerChanges = data.sanitizer_metadata?.changes_made || [];
    const sanitizerFunctionsTriggered = data.sanitizer_metadata?.functions_triggered || 0;

    // Insert into proposer_failures table
    // Note: Using 'as any' until types are regenerated with new tables
    const { data: insertedData, error } = await (supabase as any)
      .from('proposer_failures')
      .insert({
        work_order_id: data.work_order_id || null,
        proposer_name: data.proposer_name,
        complexity_score,
        complexity_band: complexityBand,
        initial_errors: refinement_metadata.initial_errors,
        final_errors: refinement_metadata.final_errors,
        refinement_count: refinement_metadata.refinement_count,
        refinement_success: refinement_metadata.refinement_success,
        error_codes: errorCodes,
        error_samples: errorSamples,
        sanitizer_changes: sanitizerChanges,
        sanitizer_functions_triggered: sanitizerFunctionsTriggered,
        is_success: isSuccess,
        failure_category: failureCategory
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Failed to log proposer failure:', error);
      return {
        logged: false,
        reason: `Database error: ${error.message}`
      };
    }

    console.log(`📊 FAILURE LOGGER: Logged ${isSuccess ? 'success' : 'failure'} (${failureCategory || 'N/A'}) - ${refinement_metadata.final_errors} errors, complexity ${complexity_score.toFixed(3)}`);

    // Also update proposer_attempts for rolling window tracking
    await updateProposerAttempts(data.proposer_name, complexityBand, data.work_order_id, isSuccess, refinement_metadata);

    return {
      logged: true,
      reason: isSuccess ? 'Success sampled (10%)' : 'Failure logged (100%)',
      failure_id: insertedData.id
    };

  } catch (error) {
    console.error('❌ Exception in logProposerFailure:', error);
    return {
      logged: false,
      reason: `Exception: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Update proposer_attempts table (rolling 50-record window per complexity band)
 * Component 6 from the doc
 */
async function updateProposerAttempts(
  proposer_name: string,
  complexity_band: string,
  work_order_id: string | undefined,
  was_success: boolean,
  refinement_metadata: RefinementResult
): Promise<void> {
  try {
    // Insert new attempt
    await (supabase as any)
      .from('proposer_attempts')
      .insert({
        proposer_name,
        complexity_band,
        work_order_id: work_order_id || null,
        was_success,
        final_errors: refinement_metadata.final_errors,
        refinement_count: refinement_metadata.refinement_count
      });

    // Cleanup: Keep only latest 50 attempts per proposer + complexity band
    const { data: attempts } = await (supabase as any)
      .from('proposer_attempts')
      .select('id, sequence_num')
      .eq('proposer_name', proposer_name)
      .eq('complexity_band', complexity_band)
      .order('sequence_num', { ascending: false })
      .limit(51); // Get 51 to identify which to delete

    if (attempts && attempts.length > 50) {
      // Delete the oldest (51st onwards)
      const oldestSequenceNum = attempts[50].sequence_num;
      await (supabase as any)
        .from('proposer_attempts')
        .delete()
        .eq('proposer_name', proposer_name)
        .eq('complexity_band', complexity_band)
        .lt('sequence_num', oldestSequenceNum);
    }

  } catch (error) {
    console.error('⚠️ Failed to update proposer_attempts:', error);
    // Non-blocking - don't throw
  }
}

/**
 * Get recent failure statistics for a proposer (debugging/monitoring)
 */
export async function getProposerFailureStats(proposer_name: string, hours: number = 24): Promise<{
  total_attempts: number;
  failures: number;
  successes: number;
  success_rate: number;
  top_error_codes: Array<{ code: string; count: number }>;
}> {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data: attempts, error } = await (supabase as any)
      .from('proposer_failures')
      .select('is_success, error_codes')
      .eq('proposer_name', proposer_name)
      .gte('created_at', since);

    if (error || !attempts) {
      throw error || new Error('No data returned');
    }

    const failures = attempts.filter((a: any) => !a.is_success).length;
    const successes = attempts.filter((a: any) => a.is_success).length;
    const total_attempts = failures + (successes * 10); // Adjust for 10% sampling

    // Count error codes
    const errorCodeCounts = new Map<string, number>();
    attempts.filter((a: any) => !a.is_success).forEach((attempt: any) => {
      (attempt.error_codes || []).forEach((code: string) => {
        errorCodeCounts.set(code, (errorCodeCounts.get(code) || 0) + 1);
      });
    });

    const top_error_codes = Array.from(errorCodeCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total_attempts,
      failures,
      successes: successes * 10, // Adjust for sampling
      success_rate: total_attempts > 0 ? (successes * 10) / total_attempts : 0,
      top_error_codes
    };

  } catch (error) {
    console.error('Failed to get proposer failure stats:', error);
    return {
      total_attempts: 0,
      failures: 0,
      successes: 0,
      success_rate: 0,
      top_error_codes: []
    };
  }
}
