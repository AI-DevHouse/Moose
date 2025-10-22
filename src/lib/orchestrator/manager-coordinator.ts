// Manager Coordinator - Calls Manager API for routing decisions

import type { WorkOrder } from './types';
import type { RoutingDecision } from '@/lib/manager-routing-rules';

/**
 * Transform Work Order to Manager routing request
 *
 * @param wo - Work Order from database
 * @returns Manager routing request payload
 */
export function transformWorkOrderToManagerRequest(wo: WorkOrder) {
  return {
    work_order_id: wo.id,
    task_description: wo.description,
    complexity_score: estimateComplexity(wo),
    context_requirements: wo.files_in_scope || [],
    approved_by_director: true
  };
}

/**
 * Estimate complexity score from Work Order
 *
 * Heuristic based on:
 * - Number of acceptance criteria (0.1 per criterion)
 * - Number of files in scope (0.05 per file)
 * - Context budget estimate (higher = more complex)
 *
 * @param wo - Work Order
 * @returns Complexity score between 0.0 and 1.0
 */
function estimateComplexity(wo: WorkOrder): number {
  const criteriaCount = wo.acceptance_criteria?.length || 1;
  const filesCount = wo.files_in_scope?.length || 1;
  const contextBudget = wo.context_budget_estimate || 2000;

  // Formula: 0.1 per criterion + 0.05 per file + context factor
  const criteriaScore = Math.min(criteriaCount * 0.1, 0.5);
  const filesScore = Math.min(filesCount * 0.05, 0.3);
  const contextScore = Math.min((contextBudget - 2000) / 8000, 0.2); // 2k-10k range

  return Math.min(criteriaScore + filesScore + contextScore, 1.0);
}

/**
 * Call Manager API to get routing decision
 *
 * @param wo - Work Order
 * @returns Routing decision with selected proposer
 * @throws Error if Manager API fails
 */
export async function getRoutingDecision(wo: WorkOrder): Promise<RoutingDecision> {
  const request = transformWorkOrderToManagerRequest(wo);

  console.log(`[ManagerCoordinator] Requesting routing decision for WO ${wo.id}`, {
    complexity_score: request.complexity_score,
    files_count: request.context_requirements.length
  });

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/manager`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Manager routing failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(`Manager returned error: ${data.error || 'Unknown error'}`);
    }

    console.log(`[ManagerCoordinator] Routing decision for WO ${wo.id}:`, {
      selected_proposer: data.routing_decision.selected_proposer,
      reason: data.routing_decision.reason
    });

    return data.routing_decision;
  } catch (error) {
    console.error('[ManagerCoordinator] Error getting routing decision:', error);
    throw error;
  }
}
