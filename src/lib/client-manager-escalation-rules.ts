// src/lib/client-manager-escalation-rules.ts
// Centralized Client Manager escalation detection and resolution generation logic

import {
  EscalationTrigger,
  ResolutionOption,
  ClientManagerRecommendation
} from '@/types/client-manager'
import { Tables } from '@/types/supabase'

/**
 * Detect if a Work Order should be escalated based on its current state
 */
export function shouldEscalate(workOrder: Tables<'work_orders'>): boolean {
  const metadata = workOrder.metadata as any

  // 1. Proposer exhausted retries (3+ attempts)
  if (metadata?.retry_count && metadata.retry_count >= 3) {
    return true
  }

  // 2. Work Order stuck in 'failed' status
  if (workOrder.status === 'failed' && !metadata?.escalation_triggered) {
    return true
  }

  // 3. Cost exceeds estimate by >200%
  if (workOrder.estimated_cost && workOrder.estimated_cost > 0 && workOrder.actual_cost) {
    const overrun = workOrder.actual_cost / workOrder.estimated_cost
    if (overrun > 2.0) {
      return true
    }
  }

  // 4. Work Order processing for >24 hours
  if (!workOrder.created_at) return false
  const createdAt = new Date(workOrder.created_at)
  const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)
  if (workOrder.status === 'processing' && hoursSinceCreation > 24) {
    return true
  }

  return false
}

/**
 * Classify the escalation trigger type based on Work Order state
 */
export function classifyEscalationTrigger(
  workOrder: Tables<'work_orders'>,
  costTracking: Tables<'cost_tracking'>[]
): EscalationTrigger {
  const metadata = workOrder.metadata as any
  const totalCost = costTracking.reduce((sum, ct) => sum + (ct.cost || 0), 0)

  // Extract attempts history
  const attemptsHistory = (metadata?.attempts || []).map((attempt: any, idx: number) => ({
    attempt_number: idx + 1,
    proposer_used: attempt.proposer_name,
    model_used: attempt.model_used,
    error_type: attempt.error_type,
    cost: attempt.cost || 0,
    timestamp: attempt.timestamp
  }))

  // Determine trigger type
  let triggerType: EscalationTrigger['trigger_type'] = 'proposer_exhausted'

  if (metadata?.sentinel_failures && metadata.sentinel_failures > 3) {
    triggerType = 'sentinel_hard_failure'
  } else if (totalCost > 50) {
    triggerType = 'budget_overrun'
  } else if (metadata?.error_type === 'contract_violation') {
    triggerType = 'contract_violation'
  } else if (metadata?.error_type === 'aider_conflict') {
    triggerType = 'aider_irreconcilable'
  }

  return {
    trigger_type: triggerType,
    work_order_id: workOrder.id,
    agent_name: metadata?.last_agent || 'proposer',
    failure_count: metadata?.retry_count || 1,
    context: {
      error_messages: metadata?.error_messages || ['Unknown error'],
      cost_spent_so_far: totalCost,
      attempts_history: attemptsHistory,
      current_state: workOrder.status,
      blocking_issue: metadata?.blocking_issue || 'Unknown blocking issue'
    }
  }
}

/**
 * Generate resolution options based on escalation trigger
 */
export function generateResolutionOptions(
  trigger: EscalationTrigger,
  workOrder: Tables<'work_orders'>,
  historicalData: {
    similar_escalations: number
    success_rate_by_strategy: Record<string, number>
  }
): ResolutionOption[] {
  const options: ResolutionOption[] = []

  // Option A: Retry with different approach
  options.push({
    option_id: 'A',
    strategy: 'retry_different_approach',
    description: `Retry Work Order with Claude Sonnet 4.5 (highest capability model) and increased context budget (+50%)`,
    estimated_cost: (workOrder.estimated_cost || 0) * 1.5,
    success_probability: historicalData.success_rate_by_strategy['retry_different_approach'] || 0.65,
    time_to_resolution: '2-4 hours',
    risk_assessment: {
      risk_level: 'low',
      compounding_risks: ['May fail again if root issue is architectural']
    },
    execution_steps: [
      'Switch to claude-sonnet-4-5 proposer',
      'Increase context budget to 6000 tokens',
      'Add failure context from previous attempts',
      'Route through Manager with high-priority flag'
    ]
  })

  // Option B: Pivot technical solution (if applicable)
  if (trigger.trigger_type === 'proposer_exhausted' || trigger.trigger_type === 'contract_violation') {
    options.push({
      option_id: 'B',
      strategy: 'pivot_solution',
      description: `Pivot to alternative technical approach (e.g., use different library, simpler architecture)`,
      estimated_cost: (workOrder.estimated_cost || 0) * 2.0,
      success_probability: historicalData.success_rate_by_strategy['pivot_solution'] || 0.75,
      time_to_resolution: '4-8 hours',
      risk_assessment: {
        risk_level: 'medium',
        compounding_risks: [
          'May require updating contracts',
          'Could impact dependent Work Orders',
          'Additional testing required'
        ]
      },
      execution_steps: [
        'Human reviews Work Order requirements',
        'Architect generates alternative decomposition',
        'Update contracts if needed',
        'Create new Work Order with pivot approach'
      ]
    })
  }

  // Option C: Amend upstream Work Orders
  if (trigger.trigger_type === 'contract_violation' || trigger.trigger_type === 'conflicting_requirements') {
    options.push({
      option_id: 'C',
      strategy: 'amend_upstream',
      description: `Fix root cause in earlier Work Orders (likely dependency issue or incomplete foundation)`,
      estimated_cost: (workOrder.estimated_cost || 0) * 1.2,
      success_probability: historicalData.success_rate_by_strategy['amend_upstream'] || 0.80,
      time_to_resolution: '6-12 hours',
      risk_assessment: {
        risk_level: 'medium',
        compounding_risks: [
          'May require re-testing earlier Work Orders',
          'Could cascade to dependent Work Orders',
          'Rollback risk if changes conflict'
        ]
      },
      execution_steps: [
        'Identify which upstream Work Order needs amendment',
        'Create amendment Work Order',
        'Re-test affected Work Orders',
        'Retry current Work Order after fix'
      ]
    })
  }

  // Option D: Abort and redesign (high cost/risk scenarios)
  if (trigger.context.cost_spent_so_far > 20 || trigger.failure_count > 3) {
    options.push({
      option_id: 'D',
      strategy: 'abort_redesign',
      description: `Abort current approach and escalate to Architect for complete re-decomposition`,
      estimated_cost: (workOrder.estimated_cost || 0) * 3.0,
      success_probability: historicalData.success_rate_by_strategy['abort_redesign'] || 0.90,
      time_to_resolution: '1-2 days',
      risk_assessment: {
        risk_level: 'high',
        compounding_risks: [
          'Sunk cost from failed attempts',
          'Timeline delay for feature',
          'May impact other planned Work Orders'
        ]
      },
      execution_steps: [
        'Mark current Work Order as "aborted"',
        'Extract lessons learned from failures',
        'Submit revised spec to Architect',
        'Director reviews new decomposition',
        'Create fresh Work Orders with updated approach'
      ]
    })
  }

  return options
}

/**
 * Generate Client Manager recommendation based on options and context
 */
export function generateRecommendation(
  trigger: EscalationTrigger,
  options: ResolutionOption[],
  workOrder: Tables<'work_orders'>,
  escalationId: string
): ClientManagerRecommendation {
  // Select best option: highest success_probability * (1 / estimated_cost)
  const scoredOptions = options.map(opt => ({
    option: opt,
    score: opt.success_probability / Math.max(opt.estimated_cost, 1) // Cost-efficiency score
  }))

  scoredOptions.sort((a, b) => b.score - a.score)
  const recommended = scoredOptions[0].option

  // Generate trade-offs for all options
  const tradeOffs = options.map(opt => {
    const pros: string[] = []
    const cons: string[] = []

    if (opt.success_probability > 0.75) pros.push('High success probability')
    if (opt.estimated_cost < trigger.context.cost_spent_so_far) pros.push('Lower cost than spent so far')
    if (opt.risk_assessment.risk_level === 'low') pros.push('Low risk')
    if (opt.time_to_resolution.includes('2-4')) pros.push('Fast resolution')

    if (opt.success_probability < 0.70) cons.push('Lower success probability')
    if (opt.estimated_cost > trigger.context.cost_spent_so_far * 2) cons.push('High additional cost')
    if (opt.risk_assessment.risk_level === 'high') cons.push('High risk')
    if (opt.risk_assessment.compounding_risks.length > 2) cons.push('Multiple compounding risks')

    return {
      option_id: opt.option_id,
      pros,
      cons
    }
  })

  // Classify failure pattern
  const failurePattern = classifyFailurePattern(trigger)

  return {
    escalation_id: escalationId,
    work_order_id: workOrder.id,
    recommended_option_id: recommended.option_id,
    reasoning: generateRecommendationReasoning(recommended, trigger, scoredOptions),
    confidence: calculateRecommendationConfidence(recommended, trigger),
    trade_offs: tradeOffs,
    context_summary: {
      total_cost_spent: trigger.context.cost_spent_so_far,
      total_attempts: trigger.failure_count,
      failure_pattern: failurePattern,
      architect_original_scope: workOrder.description.substring(0, 200) + '...'
    }
  }
}

function classifyFailurePattern(trigger: EscalationTrigger): string {
  const errorMessages = trigger.context.error_messages.join(' ').toLowerCase()

  if (errorMessages.includes('typescript') || errorMessages.includes('ts2')) {
    return 'TypeScript compilation errors'
  } else if (errorMessages.includes('contract') || errorMessages.includes('breaking')) {
    return 'Contract violations'
  } else if (errorMessages.includes('test') || errorMessages.includes('assertion')) {
    return 'Test failures'
  } else if (errorMessages.includes('timeout') || errorMessages.includes('exceeded')) {
    return 'Resource/timeout issues'
  } else if (errorMessages.includes('conflict') || errorMessages.includes('merge')) {
    return 'Git merge conflicts'
  } else {
    return 'Unknown failure pattern'
  }
}

function generateRecommendationReasoning(
  recommended: ResolutionOption,
  trigger: EscalationTrigger,
  scoredOptions: Array<{ option: ResolutionOption; score: number }>
): string {
  const reasons: string[] = []

  reasons.push(
    `Option ${recommended.option_id} (${recommended.strategy}) is recommended based on cost-efficiency analysis.`
  )

  reasons.push(
    `Success probability: ${(recommended.success_probability * 100).toFixed(0)}%, ` +
    `estimated cost: $${recommended.estimated_cost.toFixed(2)}, ` +
    `time to resolution: ${recommended.time_to_resolution}.`
  )

  if (trigger.failure_count > 2) {
    reasons.push(
      `After ${trigger.failure_count} failed attempts, this approach offers the best balance of success likelihood and resource efficiency.`
    )
  }

  if (trigger.context.cost_spent_so_far > 10) {
    reasons.push(
      `Given $${trigger.context.cost_spent_so_far.toFixed(2)} already spent, minimizing additional cost while maximizing success is critical.`
    )
  }

  return reasons.join(' ')
}

function calculateRecommendationConfidence(
  recommended: ResolutionOption,
  trigger: EscalationTrigger
): number {
  let confidence = recommended.success_probability

  // Adjust based on failure count (more failures = less confidence)
  if (trigger.failure_count > 3) {
    confidence *= 0.8
  }

  // Adjust based on risk level
  if (recommended.risk_assessment.risk_level === 'high') {
    confidence *= 0.9
  } else if (recommended.risk_assessment.risk_level === 'low') {
    confidence *= 1.1
  }

  // Cap at 0.95
  return Math.min(confidence, 0.95)
}

/**
 * Check if budget threshold requires escalation
 */
export function checkBudgetEscalation(
  dailySpend: number,
  budgetConfig: { soft_cap: number; hard_cap: number; emergency_kill: number }
): { shouldEscalate: boolean; reason: string } {
  if (dailySpend >= budgetConfig.emergency_kill) {
    return {
      shouldEscalate: true,
      reason: `Emergency kill threshold reached: $${dailySpend.toFixed(2)} >= $${budgetConfig.emergency_kill}`
    }
  }

  if (dailySpend >= budgetConfig.hard_cap * 0.9) {
    return {
      shouldEscalate: true,
      reason: `Approaching hard cap (90%): $${dailySpend.toFixed(2)} of $${budgetConfig.hard_cap}`
    }
  }

  return { shouldEscalate: false, reason: '' }
}
