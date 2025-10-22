// Proposer Executor - Calls Proposer API for code generation

import { handleCriticalError } from '@/lib/error-escalation';
import type { WorkOrder } from './types';
import type { EnhancedProposerResponse } from '@/lib/enhanced-proposer-service';

/**
 * Transform Work Order to Proposer request
 *
 * @param wo - Work Order from database
 * @returns Proposer request payload
 */
export function transformWorkOrderToProposerRequest(wo: WorkOrder) {
  return {
    task_description: buildEnhancedTaskDescription(wo),
    context: wo.files_in_scope || [],
    security_context: mapRiskToSecurityContext(wo.risk_level),
    expected_output_type: 'code' as const,
    priority: 'medium' as const,
    metadata: {
      work_order_id: wo.id
    }
  };
}

/**
 * Build enhanced task description from Work Order
 *
 * Includes title, description, acceptance criteria, and files in scope
 *
 * @param wo - Work Order
 * @returns Formatted task description
 */
function buildEnhancedTaskDescription(wo: WorkOrder): string {
  const parts = [];

  parts.push(`Work Order: ${wo.title}`);
  parts.push('');
  parts.push('Description:');
  parts.push(wo.description);
  parts.push('');

  if (wo.acceptance_criteria && wo.acceptance_criteria.length > 0) {
    parts.push('Acceptance Criteria:');
    wo.acceptance_criteria.forEach((ac, i) => {
      parts.push(`${i + 1}. ${ac}`);
    });
    parts.push('');
  }

  if (wo.files_in_scope && wo.files_in_scope.length > 0) {
    parts.push('Files to modify:');
    wo.files_in_scope.forEach(f => {
      parts.push(`- ${f}`);
    });
    parts.push('');
  }

  parts.push('Please generate complete, deployable code that satisfies all acceptance criteria.');

  return parts.join('\n').trim();
}

/**
 * Map Work Order risk level to security context
 *
 * @param risk_level - Work Order risk level
 * @returns Security context for Proposer
 */
function mapRiskToSecurityContext(risk_level: 'low' | 'medium' | 'high'): 'low' | 'medium' | 'high' {
  return risk_level;
}

/**
 * Call Proposer API to generate code
 *
 * @param wo - Work Order
 * @returns Enhanced proposer response with generated code
 * @throws Error if Proposer API fails
 */
export async function generateCode(wo: WorkOrder): Promise<EnhancedProposerResponse> {
  const request = transformWorkOrderToProposerRequest(wo);

  console.log(`[ProposerExecutor] Requesting code generation for WO ${wo.id}`, {
    files_count: request.context.length,
    security_context: request.security_context
  });

  try {
    // 15-minute timeout to accommodate self-refinement cycles
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 15 * 60 * 1000); // 15 minutes

    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/proposer-enhanced`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request),
      signal: abortController.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Proposer execution failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(`Proposer returned error: ${data.error || 'Unknown error'}`);
    }

    console.log(`[ProposerExecutor] Code generated for WO ${wo.id}:`, {
      proposer_used: data.data.proposer_used,
      cost: data.data.cost,
      refinement_cycles: data.data.refinement_metadata?.refinement_count || 0
    });

    return data.data;
  } catch (error) {
    await handleCriticalError({
      component: 'ProposerExecutor',
      operation: 'generateCode',
      error: error as Error,
      workOrderId: wo.id,
      severity: 'critical',
      metadata: { description: wo.description }
    });
    throw error;
  }
}
