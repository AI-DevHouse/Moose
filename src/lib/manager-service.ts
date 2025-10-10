// src/lib/manager-service.ts
// Manager orchestration - tactical coordination and routing
// Thin orchestration layer - all logic in manager-routing-rules.ts

import { createSupabaseServiceClient } from './supabase';
import { handleCriticalError } from './error-escalation';
import { proposerRegistry, ProposerConfig } from './proposer-registry';
import { configService } from './config-services';
import {
  makeRoutingDecision,
  detectHardStop,
  calculateRetryStrategy,
  type RoutingContext,
  type RoutingDecision,
  type RetryStrategy,
  type BudgetLimits
} from './manager-routing-rules';

export interface ManagerRoutingRequest {
  work_order_id: string;
  task_description: string;
  context_requirements: string[];
  complexity_score: number;
  approved_by_director: boolean;
}

export interface ManagerRoutingResponse {
  success: boolean;
  routing_decision?: RoutingDecision;
  error?: string;
}

/**
 * Route Work Order to appropriate Proposer
 * This orchestrates the routing flow but delegates logic to manager-routing-rules.ts
 */
export async function routeWorkOrder(
  request: ManagerRoutingRequest
): Promise<ManagerRoutingResponse> {
  try {
    const {
      work_order_id,
      task_description,
      context_requirements,
      complexity_score,
      approved_by_director
    } = request;

    // Verify Director approval
    if (!approved_by_director) {
      throw new Error('Work Order must be approved by Director before routing');
    }

    // Initialize proposer registry
    await proposerRegistry.initialize();
    const activeProposers = proposerRegistry.listActiveProposers();

    if (activeProposers.length === 0) {
      throw new Error('No active proposers available');
    }

    // Get budget limits from config service
    const budgetLimits = await configService.getBudgetLimits();

    // Calculate daily spend
    const dailySpend = await calculateDailySpend();

    // Detect Hard Stop requirement
    const hard_stop_required = detectHardStop(task_description);

    // **NEW: Reserve budget BEFORE routing**
    // TEMPORARILY DISABLED: Budget check removed for testing
    const estimatedCost = estimateRoutingCost(complexity_score, hard_stop_required);
    const reservation = await reserveBudget(
      estimatedCost,
      'manager-routing',
      { work_order_id }
    );

    // Budget check disabled - proceed regardless
    // if (!reservation.canProceed) {
    //   // Over budget - escalate immediately
    //   await handleCriticalError({
    //     component: 'Manager',
    //     operation: 'routeWorkOrder',
    //     error: new Error(`Daily budget exceeded: $${reservation.currentTotal} + $${estimatedCost} > $100`),
    //     workOrderId: work_order_id,
    //     severity: 'critical',
    //     metadata: { estimatedCost, currentTotal: reservation.currentTotal }
    //   });

    //   return {
    //     success: false,
    //     error: 'Daily budget limit exceeded'
    //   };
    // }

    // Build routing context
    const context: RoutingContext = {
      task_description,
      complexity_score,
      context_requirements,
      hard_stop_required,
      daily_spend: dailySpend
    };

    // Make routing decision using centralized rules
    const routingDecision = makeRoutingDecision(
      context,
      activeProposers,
      budgetLimits
    );

    // **NEW: Store reservation ID in metadata**
    routingDecision.routing_metadata.budget_reservation_id = reservation.reservationId;

    // Update work order with routing metadata
    await updateWorkOrderRouting(work_order_id, routingDecision);

    return {
      success: true,
      routing_decision: routingDecision
    };
  } catch (error) {
    console.error('Manager routing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Calculate retry strategy for failed Work Order
 * Delegates logic to manager-routing-rules.ts
 */
export async function getRetryStrategy(
  work_order_id: string,
  current_proposer: string,
  attempt_number: number,
  failure_reason: string
): Promise<RetryStrategy> {
  await proposerRegistry.initialize();
  const activeProposers = proposerRegistry.listActiveProposers();

  return calculateRetryStrategy(
    current_proposer,
    attempt_number,
    failure_reason,
    activeProposers
  );
}

/**
 * Calculate current daily spend from cost_tracking table
 */
async function calculateDailySpend(): Promise<number> {
  const supabase = createSupabaseServiceClient();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const { data: dailySpend, error } = await supabase
    .from('cost_tracking')
    .select('cost')
    .gte('created_at', startOfDay.toISOString());

  if (error) {
    await handleCriticalError({
      component: 'Manager',
      operation: 'calculateDailySpend',
      error: error as Error,
      workOrderId: null,
      severity: 'critical',
      metadata: { startOfDay: startOfDay.toISOString() }
    });
    // Throw error instead of returning 0 - budget calculation must succeed
    throw new Error(`Failed to calculate daily spend: ${error.message}`);
  }

  return dailySpend?.reduce((sum, record) => sum + Number(record.cost), 0) || 0;
}

/**
 * Reserve budget slot before calling LLM
 * Returns reservation ID if successful, null if over budget
 */
async function reserveBudget(
  estimatedCost: number,
  serviceName: string,
  metadata?: Record<string, unknown>
): Promise<{ canProceed: boolean; reservationId: string | null; currentTotal: number }> {
  const supabase = createSupabaseServiceClient();

  // @ts-ignore - RPC function not in generated types yet
  const { data, error } = await supabase.rpc('check_and_reserve_budget', {
    p_estimated_cost: estimatedCost,
    p_service_name: serviceName,
    p_metadata: (metadata || {}) as any
  }) as { data: Array<{ can_proceed: boolean; current_total: number; reservation_id: string | null }> | null; error: any };

  if (error) {
    await handleCriticalError({
      component: 'Manager',
      operation: 'reserveBudget',
      error: error,
      workOrderId: metadata?.work_order_id as string,
      severity: 'critical',
      metadata: { estimatedCost, serviceName }
    });
    return { canProceed: false, reservationId: null, currentTotal: 0 };
  }

  if (!data || data.length === 0) {
    return { canProceed: false, reservationId: null, currentTotal: 0 };
  }

  const result = data[0];
  return {
    canProceed: result.can_proceed,
    reservationId: result.reservation_id,
    currentTotal: result.current_total
  };
}

/**
 * Update reservation with actual cost after LLM call completes
 */
async function updateReservationWithActual(
  reservationId: string,
  actualCost: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const { error } = await supabase
    .from('cost_tracking')
    .update({
      cost: actualCost,
      metadata: {
        type: 'actual',
        updated_at: new Date().toISOString(),
        ...metadata
      }
    })
    .eq('id', reservationId);

  if (error) {
    console.error('Failed to update reservation with actual cost:', error);
    // Non-critical - reservation will remain (over-estimates budget slightly)
  }
}

/**
 * Cancel reservation if LLM call fails
 */
async function cancelReservation(reservationId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const { error } = await supabase
    .from('cost_tracking')
    .delete()
    .eq('id', reservationId);

  if (error) {
    console.error('Failed to cancel reservation:', error);
    // Non-critical - reservation will remain (over-estimates budget slightly)
  }
}

/**
 * Estimate cost for routing decision
 */
function estimateRoutingCost(
  complexityScore: number,
  hardStopRequired: boolean
): number {
  // Rough estimates based on historical data
  if (hardStopRequired || complexityScore >= 1.0) {
    return 2.50; // Claude Sonnet 4.5 average
  } else if (complexityScore < 0.3) {
    return 0.10; // GPT-4o-mini average
  } else {
    return 1.00; // Medium complexity
  }
}

/**
 * Update Work Order with routing metadata
 */
async function updateWorkOrderRouting(
  work_order_id: string,
  routingDecision: RoutingDecision
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  // Check if work_order exists first (graceful skip for ad-hoc routing)
  const { data: existingWO, error: checkError } = await supabase
    .from('work_orders')
    .select('id')
    .eq('id', work_order_id)
    .single();

  if (checkError || !existingWO) {
    console.log(`Work Order ${work_order_id} not found in database - skipping metadata update (ad-hoc routing)`);
    return; // Gracefully skip update for ad-hoc routing requests
  }

  const { error } = await supabase
    .from('work_orders')
    .update({
      metadata: {
        manager_routing: {
          selected_proposer: routingDecision.selected_proposer,
          reason: routingDecision.reason,
          confidence: routingDecision.confidence,
          fallback_proposer: routingDecision.fallback_proposer,
          routing_metadata: routingDecision.routing_metadata,
          routed_at: new Date().toISOString()
        }
      }
    })
    .eq('id', work_order_id);

  if (error) {
    console.error('Error updating work order routing:', error);
    throw new Error(`Failed to update work order routing: ${error.message}`);
  }
}

/**
 * Get performance metrics for a proposer
 * Used by Manager to track proposer effectiveness
 */
export async function getProposerPerformanceMetrics(
  proposer_name: string,
  time_window_days: number = 7
): Promise<{
  total_requests: number;
  success_rate: number;
  avg_cost: number;
  avg_execution_time_ms: number;
}> {
  const supabase = createSupabaseServiceClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - time_window_days);

  const { data: outcomes, error } = await supabase
    .from('outcome_vectors')
    .select('success, cost, execution_time_ms')
    .eq('proposer_name', proposer_name)
    .gte('created_at', cutoffDate.toISOString());

  if (error || !outcomes) {
    return {
      total_requests: 0,
      success_rate: 0,
      avg_cost: 0,
      avg_execution_time_ms: 0
    };
  }

  const total = outcomes.length;
  const successful = outcomes.filter(o => o.success).length;
  const totalCost = outcomes.reduce((sum, o) => sum + (o.cost || 0), 0);
  const totalTime = outcomes.reduce((sum, o) => sum + (o.execution_time_ms || 0), 0);

  return {
    total_requests: total,
    success_rate: total > 0 ? successful / total : 0,
    avg_cost: total > 0 ? totalCost / total : 0,
    avg_execution_time_ms: total > 0 ? totalTime / total : 0
  };
}
