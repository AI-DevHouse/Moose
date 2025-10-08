// src/lib/director-service.ts
// Director orchestration - governance and approval authority

import { WorkOrder, DecompositionOutput } from '@/types/architect';
import { makeApprovalDecision, ApprovalDecision } from './director-risk-assessment';
import { createSupabaseServiceClient } from './supabase';

export interface DirectorApprovalRequest {
  decomposition: DecompositionOutput;
  feature_name: string;
}

export interface DirectorApprovalResponse {
  success: boolean;
  decision: ApprovalDecision;
  work_order_ids?: string[];
  error?: string;
}

/**
 * Process approval request for decomposed Work Orders
 * This orchestrates the approval flow but delegates risk logic to director-risk-assessment.ts
 */
export async function processApprovalRequest(
  request: DirectorApprovalRequest
): Promise<DirectorApprovalResponse> {
  try {
    const { decomposition, feature_name } = request;

    // Make approval decision using centralized risk assessment
    const decision = makeApprovalDecision(
      decomposition.work_orders,
      decomposition.total_estimated_cost
    );

    // If auto-approved, create work orders in database
    if (decision.auto_approved) {
      const work_order_ids = await createWorkOrdersInDatabase(
        decomposition,
        feature_name,
        decision
      );

      return {
        success: true,
        decision,
        work_order_ids
      };
    }

    // If human approval required, return decision without creating WOs
    return {
      success: true,
      decision
    };
  } catch (error) {
    console.error('Director approval error:', error);
    return {
      success: false,
      decision: {
        approved: false,
        risk_assessments: [],
        aggregate_risk: 'high',
        total_cost: 0,
        requires_human_approval: true,
        reasoning: `Error processing approval: ${error instanceof Error ? error.message : 'Unknown error'}`,
        auto_approved: false
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Create Work Orders in database after approval
 */
async function createWorkOrdersInDatabase(
  decomposition: DecompositionOutput,
  feature_name: string,
  decision: ApprovalDecision
): Promise<string[]> {
  const supabase = createSupabaseServiceClient();
  const work_order_ids: string[] = [];

  for (let i = 0; i < decomposition.work_orders.length; i++) {
    const wo = decomposition.work_orders[i];
    const risk_assessment = decision.risk_assessments[i];

    const { data, error } = await supabase
      .from('work_orders')
      .insert({
        title: wo.title,
        description: wo.description,
        status: 'pending',
        risk_level: wo.risk_level,
        estimated_cost: decomposition.total_estimated_cost / decomposition.work_orders.length,
        pattern_confidence: risk_assessment.confidence_score,
        proposer_id: null as any, // Will be assigned by Manager when routed
        // New Architect fields
        acceptance_criteria: wo.acceptance_criteria,
        files_in_scope: wo.files_in_scope,
        context_budget_estimate: wo.context_budget_estimate,
        decomposition_doc: decomposition.decomposition_doc,
        architect_version: 'v1',
        // Metadata
        metadata: {
          feature_name,
          dependencies: wo.dependencies,
          risk_factors: risk_assessment.risk_factors,
          director_reasoning: risk_assessment.reasoning,
          auto_approved: true,
          approved_at: new Date().toISOString()
        }
      } as any)
      .select('id')
      .single();

    if (error) {
      console.error('Error creating work order:', error);
      throw new Error(`Failed to create work order: ${error.message}`);
    }

    if (data) {
      work_order_ids.push(data.id);
    }
  }

  // Log approval decision
  await logApprovalDecision(feature_name, decision, work_order_ids);

  return work_order_ids;
}

/**
 * Log approval decision for audit trail
 */
async function logApprovalDecision(
  feature_name: string,
  decision: ApprovalDecision,
  work_order_ids: string[]
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  // Note: decision_logs table may need to be created
  // For now, we'll log to console and skip DB insert if table doesn't exist
  try {
    await supabase.from('decision_logs').insert({
      decision_type: 'director_approval',
      agent_type: 'director',
      input_context: {
        feature_name,
        work_order_ids,
        aggregate_risk: decision.aggregate_risk,
        total_cost: decision.total_cost
      } as any,
      decision_output: {
        approved: decision.approved,
        reasoning: decision.reasoning,
        auto_approved: decision.auto_approved,
        risk_assessments: decision.risk_assessments
      } as any
    });
  } catch (error) {
    // decision_logs table might not exist yet - log to console
    console.log('Director approval decision:', {
      feature_name,
      decision,
      work_order_ids
    });
  }
}

/**
 * Manually approve Work Orders (human override)
 * Called when human reviews and approves high-risk decomposition
 */
export async function manualApprove(
  decomposition: DecompositionOutput,
  feature_name: string,
  human_reasoning: string
): Promise<DirectorApprovalResponse> {
  try {
    // Get risk assessment but override approval
    const decision = makeApprovalDecision(
      decomposition.work_orders,
      decomposition.total_estimated_cost
    );

    // Force approval with human reasoning
    decision.approved = true;
    decision.auto_approved = false;
    decision.reasoning = `Human override: ${human_reasoning}. Original reasoning: ${decision.reasoning}`;

    const work_order_ids = await createWorkOrdersInDatabase(
      decomposition,
      feature_name,
      decision
    );

    return {
      success: true,
      decision,
      work_order_ids
    };
  } catch (error) {
    console.error('Manual approval error:', error);
    return {
      success: false,
      decision: {
        approved: false,
        risk_assessments: [],
        aggregate_risk: 'high',
        total_cost: 0,
        requires_human_approval: true,
        reasoning: `Error in manual approval: ${error instanceof Error ? error.message : 'Unknown error'}`,
        auto_approved: false
      },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
