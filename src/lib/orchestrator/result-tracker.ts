// Result Tracker - Updates database with execution results

import { createSupabaseServiceClient } from '@/lib/supabase';
import { handleCriticalError } from '@/lib/error-escalation';
import type { WorkOrder, AiderResult, GitHubPRResult } from './types';
import type { EnhancedProposerResponse } from '@/lib/enhanced-proposer-service';
import type { RoutingDecision } from '@/lib/manager-routing-rules';

/**
 * Track successful Work Order execution
 *
 * Updates:
 * - work_orders table (status, PR info, metadata)
 * - github_events table (PR created event)
 * - outcome_vectors table (success metrics)
 *
 * @param wo - Work Order
 * @param routingDecision - Manager routing decision
 * @param proposerResponse - Proposer code generation response
 * @param aiderResult - Aider execution result
 * @param prResult - GitHub PR creation result
 */
export async function trackSuccessfulExecution(
  wo: WorkOrder,
  routingDecision: RoutingDecision,
  proposerResponse: EnhancedProposerResponse,
  aiderResult: AiderResult,
  prResult: GitHubPRResult
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  console.log(`[ResultTracker] Tracking successful execution for WO ${wo.id}`);

  try {
    // 1. Update work_orders
    const { error: woError } = await supabase
      .from('work_orders')
      .update({
        status: 'in_progress', // PR created, awaiting review/merge
        github_pr_url: prResult.pr_url,
        github_pr_number: prResult.pr_number,
        github_branch: prResult.branch_name,
        metadata: {
          ...wo.metadata,
          routing_decision: {
            selected_proposer: routingDecision.selected_proposer,
            reason: routingDecision.reason,
            confidence: routingDecision.confidence,
            routing_metadata: routingDecision.routing_metadata
          },
          proposer_response: {
            proposer_used: proposerResponse.proposer_used,
            cost: proposerResponse.cost,
            token_usage: proposerResponse.token_usage,
            execution_time_ms: proposerResponse.execution_time_ms,
            refinement_cycles: proposerResponse.refinement_metadata?.refinement_count || 0
          },
          aider_execution: {
            branch_name: aiderResult.branch_name,
            success: aiderResult.success
          },
          orchestrator_execution_at: new Date().toISOString()
        }
      } as any)
      .eq('id', wo.id);

    if (woError) {
      console.error('[ResultTracker] Error updating work_orders:', woError);
      throw woError;
    }

    // 2. Write to github_events
    const { error: geError } = await supabase
      .from('github_events')
      .insert({
        event_type: 'pull_request',
        action: 'opened',
        pr_number: prResult.pr_number,
        branch_name: prResult.branch_name,
        metadata: {
          work_order_id: wo.id,
          pr_url: prResult.pr_url,
          risk_level: wo.risk_level,
          proposer_used: proposerResponse.proposer_used,
          cost: proposerResponse.cost
        }
      } as any);

    if (geError) {
      console.error('[ResultTracker] Error writing github_events:', geError);
      // Non-fatal, continue
    }

    // 3. Write to outcome_vectors (tracks LLM model performance)
    const { error: ovError } = await supabase
      .from('outcome_vectors')
      .insert({
        work_order_id: wo.id,
        model_used: proposerResponse.proposer_used,
        route_reason: routingDecision.reason,
        cost: proposerResponse.cost,
        execution_time_ms: proposerResponse.execution_time_ms,
        success: true,
        diff_size_lines: 0, // TODO: Parse from Aider output
        test_duration_ms: null, // TODO: Get from Sentinel
        failure_classes: null,
        metadata: {
          complexity_score: routingDecision.routing_metadata.complexity_score,
          hard_stop_required: routingDecision.routing_metadata.hard_stop_required,
          refinement_cycles: proposerResponse.refinement_metadata?.refinement_count || 0
        }
      } as any);

    if (ovError) {
      await handleCriticalError({
        component: 'ResultTracker',
        operation: 'writeOutcomeVectors',
        error: ovError as Error,
        workOrderId: wo.id,
        severity: 'critical',
        metadata: {
          proposer_used: proposerResponse.proposer_used,
          cost: proposerResponse.cost
        }
      });
      // Still continue execution - escalation notifies human but doesn't block
    }

    console.log(`[ResultTracker] Successfully tracked execution for WO ${wo.id}`);
  } catch (error) {
    console.error('[ResultTracker] Unexpected error:', error);
    throw error;
  }
}

/**
 * Track failed Work Order execution
 *
 * Updates:
 * - work_orders table (status=failed, error metadata)
 * - outcome_vectors table (failure metrics)
 *
 * @param wo - Work Order
 * @param error - Error that caused failure
 * @param stage - Stage where failure occurred
 */
export async function trackFailedExecution(
  wo: WorkOrder,
  error: Error,
  stage: 'routing' | 'proposer' | 'aider' | 'github'
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  console.error(`[ResultTracker] Tracking failed execution for WO ${wo.id} at stage ${stage}:`, error.message);

  try {
    // 1. Update work_orders
    const { error: woError } = await supabase
      .from('work_orders')
      .update({
        status: 'failed',
        metadata: {
          ...wo.metadata,
          orchestrator_error: {
            stage,
            message: error.message,
            timestamp: new Date().toISOString()
          }
        }
      } as any)
      .eq('id', wo.id);

    if (woError) {
      console.error('[ResultTracker] Error updating work_orders:', woError);
      // Continue to try outcome_vectors
    }

    // 2. Write to outcome_vectors ONLY if failure was at proposer stage
    // (outcome_vectors tracks LLM model performance, not infrastructure failures)
    if (stage === 'proposer' && wo.metadata?.routing_decision && wo.metadata?.proposer_response) {
      const routingDecision = wo.metadata.routing_decision;
      const proposerResponse = wo.metadata.proposer_response;

      const { error: ovError } = await supabase
        .from('outcome_vectors')
        .insert({
          work_order_id: wo.id,
          model_used: proposerResponse.proposer_used,
          route_reason: routingDecision.reason,
          cost: proposerResponse.cost || 0,
          execution_time_ms: proposerResponse.execution_time_ms || 0,
          success: false,
          diff_size_lines: 0,
          test_duration_ms: null,
          failure_classes: ['generation_failed'],
          metadata: {
            error_message: error.message,
            complexity_score: routingDecision.routing_metadata?.complexity_score,
            refinement_cycles: proposerResponse.refinement_cycles || 0
          }
        } as any);

      if (ovError) {
        await handleCriticalError({
          component: 'ResultTracker',
          operation: 'writeOutcomeVectorsFailure',
          error: ovError as Error,
          workOrderId: wo.id,
          severity: 'critical',
          metadata: {
            stage,
            proposer_used: proposerResponse.proposer_used
          }
        });
      }
    }

    console.log(`[ResultTracker] Tracked failure for WO ${wo.id}`);
  } catch (err) {
    console.error('[ResultTracker] Unexpected error tracking failure:', err);
    // Don't throw - we want to report the original error
  }
}
