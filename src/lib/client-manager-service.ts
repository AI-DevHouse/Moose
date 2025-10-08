// src/lib/client-manager-service.ts
// Client Manager service - orchestration layer for escalation handling

import { createSupabaseServiceClient } from '@/lib/supabase'
import { Tables, TablesInsert } from '@/types/supabase'
import {
  EscalationTrigger,
  ResolutionOption,
  ClientManagerRecommendation,
  EscalationDecision,
  EscalationResult
} from '@/types/client-manager'
import {
  shouldEscalate,
  classifyEscalationTrigger,
  generateResolutionOptions,
  generateRecommendation,
  checkBudgetEscalation
} from '@/lib/client-manager-escalation-rules'

export class ClientManagerService {
  private supabase = createSupabaseServiceClient()

  /**
   * Create escalation for a Work Order
   */
  async createEscalation(workOrderId: string): Promise<{
    escalation: Tables<'escalations'>
    recommendation: ClientManagerRecommendation
  }> {
    // 1. Fetch Work Order
    const { data: workOrder, error: woError } = await this.supabase
      .from('work_orders')
      .select('*')
      .eq('id', workOrderId)
      .single()

    if (woError || !workOrder) {
      throw new Error(`Work Order not found: ${workOrderId}`)
    }

    // 2. Check if should escalate
    if (!shouldEscalate(workOrder)) {
      throw new Error(`Work Order ${workOrderId} does not meet escalation criteria`)
    }

    // 3. Fetch cost tracking for this Work Order
    // Note: cost_tracking table doesn't have work_order_id column
    // We query outcome_vectors which tracks LLM costs per work order
    const { data: outcomeVectors, error: ctError } = await this.supabase
      .from('outcome_vectors')
      .select('cost')
      .eq('work_order_id', workOrderId)

    if (ctError) {
      throw new Error(`Failed to fetch cost tracking: ${ctError.message}`)
    }

    // Convert outcome_vectors to cost_tracking format
    const costTracking = (outcomeVectors || []).map(ov => ({
      cost: ov.cost || 0,
      created_at: new Date().toISOString(),
      id: '',
      metadata: {},
      service_name: 'proposer'
    }))

    // 4. Classify escalation trigger
    const trigger = classifyEscalationTrigger(workOrder, costTracking)

    // 5. Fetch historical data for resolution options
    const { data: similarEscalations } = await this.supabase
      .from('escalations')
      .select('*')
      .eq('status', 'resolved')
      .limit(50)

    const historicalData = this.analyzeHistoricalData(similarEscalations || [])

    // 6. Generate resolution options
    const options = generateResolutionOptions(trigger, workOrder, historicalData)

    // 7. Create escalation record
    const escalationData: TablesInsert<'escalations'> = {
      work_order_id: workOrderId,
      trigger_type: trigger.trigger_type,
      status: 'open',
      context: {
        trigger,
        options,
        created_by: 'client-manager-service'
      } as any
    }

    const { data: escalation, error: escalationError } = await this.supabase
      .from('escalations')
      .insert(escalationData)
      .select()
      .single()

    if (escalationError || !escalation) {
      throw new Error(`Failed to create escalation: ${escalationError?.message}`)
    }

    // 8. Generate recommendation
    const recommendation = generateRecommendation(trigger, options, workOrder, escalation.id)

    // 9. Update escalation with recommendation
    await this.supabase
      .from('escalations')
      .update({
        context: {
          trigger,
          options,
          recommendation,
          created_by: 'client-manager-service'
        } as any
      })
      .eq('id', escalation.id)

    // 10. Mark Work Order as escalated
    await this.supabase
      .from('work_orders')
      .update({
        metadata: {
          ...(workOrder.metadata as any),
          escalation_triggered: true,
          escalation_id: escalation.id
        } as any
      })
      .eq('id', workOrderId)

    return { escalation, recommendation }
  }

  /**
   * Get escalation with recommendation
   */
  async getEscalation(escalationId: string): Promise<{
    escalation: Tables<'escalations'>
    recommendation: ClientManagerRecommendation
  }> {
    const { data: escalation, error } = await this.supabase
      .from('escalations')
      .select('*')
      .eq('id', escalationId)
      .single()

    if (error || !escalation) {
      throw new Error(`Escalation not found: ${escalationId}`)
    }

    const escalationContext = escalation.context as any
    const recommendation = escalationContext.recommendation

    if (!recommendation) {
      throw new Error(`No recommendation found for escalation: ${escalationId}`)
    }

    return { escalation, recommendation }
  }

  /**
   * Execute human's decision on escalation
   */
  async executeDecision(decision: EscalationDecision): Promise<EscalationResult> {
    const { escalation, recommendation } = await this.getEscalation(decision.escalation_id)
    const escalationContext = escalation.context as any
    const options = escalationContext.options as ResolutionOption[]

    const chosenOption = options.find(opt => opt.option_id === decision.chosen_option_id)
    if (!chosenOption) {
      throw new Error(`Invalid option: ${decision.chosen_option_id}`)
    }

    if (!escalation.work_order_id) {
      throw new Error(`Escalation ${decision.escalation_id} has no associated work order`)
    }

    // Execute based on strategy
    let outcome: 'success' | 'failure' | 'partial' = 'success'
    const lessonsLearned: string[] = []

    switch (chosenOption.strategy) {
      case 'retry_different_approach':
        await this.executeRetryStrategy(escalation.work_order_id, chosenOption)
        lessonsLearned.push('Retry with higher capability model successful')
        break

      case 'pivot_solution':
        await this.executePivotStrategy(escalation.work_order_id, chosenOption)
        lessonsLearned.push('Technical pivot required human oversight')
        break

      case 'amend_upstream':
        await this.executeAmendStrategy(escalation.work_order_id, chosenOption)
        lessonsLearned.push('Upstream dependency issue identified and fixed')
        break

      case 'abort_redesign':
        await this.executeAbortStrategy(escalation.work_order_id, chosenOption)
        lessonsLearned.push('Complete redesign necessary after repeated failures')
        outcome = 'partial' // Mark as partial since redesign needed
        break

      case 'manual_intervention':
        lessonsLearned.push('Manual intervention required - automation limits reached')
        outcome = 'partial'
        break
    }

    // Update escalation as resolved
    await this.supabase
      .from('escalations')
      .update({
        status: 'resolved',
        resolution_notes: `Option ${decision.chosen_option_id} chosen: ${chosenOption.description}. ${decision.human_notes || ''}`,
        resolved_at: new Date().toISOString()
      })
      .eq('id', decision.escalation_id)

    // Store pattern in escalation_scripts (if table exists)
    const patternForMemory = `${escalationContext.trigger.trigger_type} → ${chosenOption.strategy} (success_rate: ${chosenOption.success_probability})`

    const result: EscalationResult = {
      escalation_id: decision.escalation_id,
      resolution_outcome: outcome,
      final_cost: chosenOption.estimated_cost,
      lessons_learned: lessonsLearned,
      pattern_for_memory: patternForMemory
    }

    return result
  }

  /**
   * Check for budget escalations (called periodically)
   */
  async checkBudgetThresholds(): Promise<Tables<'escalations'>[]> {
    // Get daily spend
    const today = new Date().toISOString().split('T')[0]
    const { data: costTracking } = await this.supabase
      .from('cost_tracking')
      .select('cost')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)

    const dailySpend = (costTracking || []).reduce((sum, ct) => sum + (ct.cost || 0), 0)

    // Get budget thresholds from system_config
    const { data: budgetConfigRow } = await this.supabase
      .from('system_config')
      .select('value')
      .eq('key', 'budget_thresholds')
      .single()

    const budgetConfig = budgetConfigRow?.value ? JSON.parse(budgetConfigRow.value) : {
      soft_cap: 20,
      hard_cap: 50,
      emergency_kill: 100
    }

    const budgetCheck = checkBudgetEscalation(dailySpend, budgetConfig)

    if (budgetCheck.shouldEscalate) {
      // Create budget escalation
      const escalationData: TablesInsert<'escalations'> = {
        work_order_id: '00000000-0000-0000-0000-000000000000', // System-level escalation
        trigger_type: 'budget_overrun',
        status: 'open',
        context: {
          trigger_type: 'budget_overrun',
          daily_spend: dailySpend,
          threshold_exceeded: budgetCheck.reason
        } as any
      }

      const { data: escalation } = await this.supabase
        .from('escalations')
        .insert(escalationData)
        .select()
        .single()

      return escalation ? [escalation] : []
    }

    return []
  }

  // Private helper methods for executing strategies

  private async executeRetryStrategy(workOrderId: string, option: ResolutionOption): Promise<void> {
    // Reset Work Order status to 'pending'
    await this.supabase
      .from('work_orders')
      .update({
        status: 'pending',
        metadata: {
          retry_with_escalation: true,
          force_model: 'claude-sonnet-4-5',
          context_budget_increase: 1.5
        } as any
      })
      .eq('id', workOrderId)
  }

  private async executePivotStrategy(workOrderId: string, option: ResolutionOption): Promise<void> {
    // Mark Work Order for human review
    await this.supabase
      .from('work_orders')
      .update({
        status: 'needs_review',
        metadata: {
          pivot_required: true,
          human_review_reason: 'Technical pivot needed based on escalation'
        } as any
      })
      .eq('id', workOrderId)
  }

  private async executeAmendStrategy(workOrderId: string, option: ResolutionOption): Promise<void> {
    // Mark Work Order as blocked, pending upstream fix
    await this.supabase
      .from('work_orders')
      .update({
        status: 'blocked',
        metadata: {
          blocked_reason: 'Upstream Work Order amendment required',
          pending_upstream_fix: true
        } as any
      })
      .eq('id', workOrderId)
  }

  private async executeAbortStrategy(workOrderId: string, option: ResolutionOption): Promise<void> {
    // Mark Work Order as aborted
    await this.supabase
      .from('work_orders')
      .update({
        status: 'failed',
        metadata: {
          aborted: true,
          redesign_required: true,
          escalate_to_architect: true
        } as any
      })
      .eq('id', workOrderId)
  }

  private analyzeHistoricalData(escalations: Tables<'escalations'>[]): {
    similar_escalations: number
    success_rate_by_strategy: Record<string, number>
  } {
    const strategySuccesses: Record<string, { success: number; total: number }> = {
      retry_different_approach: { success: 0, total: 0 },
      pivot_solution: { success: 0, total: 0 },
      amend_upstream: { success: 0, total: 0 },
      abort_redesign: { success: 0, total: 0 }
    }

    escalations.forEach(esc => {
      const data = esc.context as any
      if (data?.chosen_option?.strategy) {
        const strategy = data.chosen_option.strategy
        if (strategySuccesses[strategy]) {
          strategySuccesses[strategy].total++
          if (esc.status === 'resolved') {
            strategySuccesses[strategy].success++
          }
        }
      }
    })

    const successRates: Record<string, number> = {}
    Object.entries(strategySuccesses).forEach(([strategy, counts]) => {
      successRates[strategy] = counts.total > 0 ? counts.success / counts.total : 0.65 // Default 0.65
    })

    return {
      similar_escalations: escalations.length,
      success_rate_by_strategy: successRates
    }
  }
}

export const clientManagerService = new ClientManagerService()
