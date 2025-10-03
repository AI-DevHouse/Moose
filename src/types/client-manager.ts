// src/types/client-manager.ts
// Client Manager type definitions

export interface EscalationTrigger {
  trigger_type:
    | 'proposer_exhausted'      // Proposer failed after retries
    | 'sentinel_hard_failure'    // Sentinel detected repeated test failures
    | 'budget_overrun'           // Approaching emergency kill threshold
    | 'conflicting_requirements' // Requirements conflict discovered
    | 'technical_blocker'        // Unforeseen dependency/API issue
    | 'contract_violation'       // Contract violation can't auto-resolve
    | 'aider_irreconcilable'     // File conflicts, broken repo state
  work_order_id: string
  agent_name: string            // Which agent triggered escalation
  failure_count: number         // How many attempts failed
  context: {
    error_messages: string[]
    cost_spent_so_far: number
    attempts_history: Array<{
      attempt_number: number
      proposer_used?: string
      model_used?: string
      error_type?: string
      cost: number
      timestamp: string
    }>
    current_state: string       // Description of current Work Order state
    blocking_issue: string      // What specifically is blocking progress
  }
}

export interface ResolutionOption {
  option_id: string              // A, B, C, D
  strategy:
    | 'retry_different_approach' // Different model/strategy
    | 'pivot_solution'           // Alternative architecture
    | 'amend_upstream'           // Fix root cause in earlier WO
    | 'abort_redesign'           // Escalate to Architect re-decomposition
    | 'manual_intervention'      // Human must fix manually
  description: string            // What this option does
  estimated_cost: number         // Additional $ needed
  success_probability: number    // 0.0-1.0 based on historical data
  time_to_resolution: string     // Human-readable estimate
  risk_assessment: {
    risk_level: 'low' | 'medium' | 'high'
    compounding_risks: string[]  // Potential side effects
  }
  execution_steps: string[]      // What will happen if chosen
}

export interface ClientManagerRecommendation {
  escalation_id: string
  work_order_id: string
  recommended_option_id: string  // Which option is recommended
  reasoning: string              // Why this option is best
  confidence: number             // 0.0-1.0 confidence in recommendation
  trade_offs: {
    option_id: string
    pros: string[]
    cons: string[]
  }[]
  context_summary: {
    total_cost_spent: number
    total_attempts: number
    failure_pattern: string      // e.g., "TypeScript errors in complex refactoring"
    architect_original_scope: string // Link to original decomposition
  }
}

export interface EscalationDecision {
  escalation_id: string
  chosen_option_id: string
  human_notes?: string           // Optional notes from human
  decided_by: string             // User ID
  decided_at: string
}

export interface EscalationResult {
  escalation_id: string
  resolution_outcome: 'success' | 'failure' | 'partial'
  final_cost: number
  lessons_learned: string[]      // What to remember for future
  pattern_for_memory: string     // Store in escalation_scripts
}
