/**
 * Decision Logging System
 *
 * Purpose: Track all decision points in work order execution for pattern analysis.
 * Used by: Manager routing, proposer refinement, error escalation, orchestrator
 *
 * Created: 2025-10-09 (Phase 2A - Learning System Foundation)
 */

import { createSupabaseServiceClient } from './supabase';

// ============================================================================
// Types
// ============================================================================

/**
 * Decision types matching database enum
 */
export type DecisionType =
  | 'routing'           // Manager routing decision (which proposer to use)
  | 'refinement_cycle'  // Proposer self-refinement attempt
  | 'escalation'        // Error escalated to Client Manager
  | 'retry'             // Retry attempted after failure
  | 'skip';             // Work order skipped

/**
 * Decision result
 */
export type DecisionResult = 'success' | 'failure';

/**
 * Parameters for logging a decision
 */
export interface LogDecisionParams {
  work_order_id?: string;           // Work order this decision relates to (nullable for system-level decisions)
  decision_type: DecisionType;      // Type of decision made
  decision_context: any;            // Context and reasoning for the decision (JSONB)
  decision_result: DecisionResult;  // Whether the decision was successful
}

// ============================================================================
// Main Logging Function
// ============================================================================

/**
 * Log a decision to the database for pattern analysis
 *
 * @param params - Decision parameters
 * @returns Promise that resolves when logged (or rejects on error)
 *
 * **Important:** This function never throws. Logging failures are caught and logged
 * to console to prevent decision logging from crashing the main execution pipeline.
 *
 * @example
 * ```ts
 * // Manager routing decision
 * await logDecision({
 *   work_order_id: 'abc-123',
 *   decision_type: 'routing',
 *   decision_context: {
 *     complexity_score: 0.7,
 *     selected_proposer: 'claude-sonnet-4',
 *     reasoning: 'High complexity task requires advanced model'
 *   },
 *   decision_result: 'success'
 * });
 *
 * // Proposer refinement cycle
 * await logDecision({
 *   work_order_id: 'abc-123',
 *   decision_type: 'refinement_cycle',
 *   decision_context: {
 *     cycle_number: 2,
 *     failure_class: 'compile_error',
 *     error_message: 'Type error in component',
 *     retry_strategy: 'Add type annotations'
 *   },
 *   decision_result: 'success'
 * });
 *
 * // Error escalation
 * await logDecision({
 *   work_order_id: 'abc-123',
 *   decision_type: 'escalation',
 *   decision_context: {
 *     component: 'AiderExecutor',
 *     operation: 'executeAider',
 *     failure_class: 'orchestration_error',
 *     severity: 'critical'
 *   },
 *   decision_result: 'success'
 * });
 * ```
 */
export async function logDecision(params: LogDecisionParams): Promise<void> {
  try {
    const supabase = createSupabaseServiceClient();

    const { error } = await supabase
      .from('decision_logs')
      .insert({
        work_order_id: params.work_order_id || null,  // Added by Phase 2 migration
        agent_type: inferAgentType(params.decision_type),
        decision_type: params.decision_type,
        input_context: params.decision_context,
        decision_output: {
          result: params.decision_result,
          ...params.decision_context  // Include context in output for analysis
        }
      } as any);

    if (error) {
      console.error('[DecisionLogger] Failed to log decision:', error);
      console.error('[DecisionLogger] Decision was:', params);
      // Don't throw - logging failure shouldn't crash the pipeline
    }
  } catch (error) {
    console.error('[DecisionLogger] Unexpected error logging decision:', error);
    console.error('[DecisionLogger] Decision was:', params);
    // Don't throw - logging failure shouldn't crash the pipeline
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Infer agent_type from decision_type for existing schema compatibility
 */
function inferAgentType(decision_type: DecisionType): string {
  switch (decision_type) {
    case 'routing':
      return 'Manager';
    case 'refinement_cycle':
      return 'Proposer';
    case 'escalation':
      return 'ClientManager';
    case 'retry':
      return 'Orchestrator';
    case 'skip':
      return 'Orchestrator';
    default:
      return 'Unknown';
  }
}

// ============================================================================
// Convenience Functions for Common Decisions
// ============================================================================

/**
 * Log a manager routing decision
 */
export async function logRoutingDecision(params: {
  work_order_id: string;
  complexity_score: number;
  selected_proposer: string;
  reasoning: string;
  success: boolean;
}): Promise<void> {
  await logDecision({
    work_order_id: params.work_order_id,
    decision_type: 'routing',
    decision_context: {
      complexity_score: params.complexity_score,
      selected_proposer: params.selected_proposer,
      reasoning: params.reasoning
    },
    decision_result: params.success ? 'success' : 'failure'
  });
}

/**
 * Log a proposer refinement cycle
 */
export async function logRefinementCycle(params: {
  work_order_id: string;
  cycle_number: number;
  failure_class?: string;
  error_message?: string;
  retry_strategy?: string;
  success: boolean;
}): Promise<void> {
  await logDecision({
    work_order_id: params.work_order_id,
    decision_type: 'refinement_cycle',
    decision_context: {
      cycle_number: params.cycle_number,
      failure_class: params.failure_class,
      error_message: params.error_message,
      retry_strategy: params.retry_strategy
    },
    decision_result: params.success ? 'success' : 'failure'
  });
}

/**
 * Log an error escalation decision
 */
export async function logEscalationDecision(params: {
  work_order_id: string;
  component: string;
  operation: string;
  failure_class: string;
  severity: 'critical' | 'warning';
  success: boolean;
}): Promise<void> {
  await logDecision({
    work_order_id: params.work_order_id,
    decision_type: 'escalation',
    decision_context: {
      component: params.component,
      operation: params.operation,
      failure_class: params.failure_class,
      severity: params.severity
    },
    decision_result: params.success ? 'success' : 'failure'
  });
}

/**
 * Log a retry decision
 */
export async function logRetryDecision(params: {
  work_order_id: string;
  retry_count: number;
  reason: string;
  success: boolean;
}): Promise<void> {
  await logDecision({
    work_order_id: params.work_order_id,
    decision_type: 'retry',
    decision_context: {
      retry_count: params.retry_count,
      reason: params.reason
    },
    decision_result: params.success ? 'success' : 'failure'
  });
}

/**
 * Log a skip decision
 */
export async function logSkipDecision(params: {
  work_order_id: string;
  reason: string;
}): Promise<void> {
  await logDecision({
    work_order_id: params.work_order_id,
    decision_type: 'skip',
    decision_context: {
      reason: params.reason
    },
    decision_result: 'success' // Skipping is considered successful
  });
}

// ============================================================================
// Exports
// ============================================================================

export default logDecision;
