// src/lib/manager-routing-rules.ts
// Single source of truth for Manager routing and budget enforcement logic

import { ProposerConfig } from './proposer-registry';

export interface RoutingContext {
  task_description: string;
  complexity_score: number;
  context_requirements: string[];
  hard_stop_required: boolean;
  daily_spend: number;
}

export interface RoutingDecision {
  selected_proposer: string;
  reason: string;
  confidence: number;
  fallback_proposer?: string;
  routing_metadata: {
    complexity_score: number;
    hard_stop_required: boolean;
    daily_spend: number;
    budget_status: 'normal' | 'warning' | 'hard_cap_exceeded' | 'within_limits' | 'emergency_kill';
    available_proposers: number;
    candidates_count?: number;
    selection_timestamp: string;
    routing_strategy: string;
    budget_reservation_id?: string | null;
  };
}

export interface BudgetLimits {
  daily_soft_cap: number;
  daily_hard_cap: number;
  emergency_kill: number;
}

// Hard Stop keywords that force claude-sonnet-4-5 (20 total: 12 security + 8 architecture)
const HARD_STOP_KEYWORDS = {
  SECURITY: [
    'sql injection',
    'xss',
    'csrf',
    'authentication',
    'authorization',
    'encryption',
    'password hashing',
    'api keys',
    'secrets management',
    'access control',
    'input validation',
    'sanitization'
  ],
  ARCHITECTURE: [
    'api contract',
    'schema change',
    'breaking change',
    'database migration',
    'event schema',
    'integration contract',
    'system design',
    'architectural decision'
  ]
};

/**
 * Detect if Hard Stop is required based on keywords
 */
export function detectHardStop(description: string): boolean {
  const searchText = description.toLowerCase();

  const allKeywords = [
    ...HARD_STOP_KEYWORDS.SECURITY,
    ...HARD_STOP_KEYWORDS.ARCHITECTURE
  ];

  return allKeywords.some(keyword => searchText.includes(keyword.toLowerCase()));
}

/**
 * Check budget status and determine if operations should continue
 */
export function checkBudgetStatus(
  dailySpend: number,
  budgetLimits: BudgetLimits
): {
  can_proceed: boolean;
  status: 'normal' | 'warning' | 'hard_cap_exceeded' | 'emergency_kill';
  force_cheapest: boolean;
  error_message?: string;
} {
  // EMERGENCY_KILL: Stop all LLM calls
  if (dailySpend >= budgetLimits.emergency_kill) {
    return {
      can_proceed: false,
      status: 'emergency_kill',
      force_cheapest: false,
      error_message: `EMERGENCY_KILL triggered: Daily spend ${dailySpend.toFixed(2)} >= ${budgetLimits.emergency_kill}. Manual intervention required.`
    };
  }

  // DAILY_HARD_CAP: Force cheapest model
  if (dailySpend >= budgetLimits.daily_hard_cap) {
    return {
      can_proceed: true,
      status: 'hard_cap_exceeded',
      force_cheapest: true
    };
  }

  // DAILY_SOFT_CAP: Warning but continue normally
  if (dailySpend >= budgetLimits.daily_soft_cap) {
    return {
      can_proceed: true,
      status: 'warning',
      force_cheapest: false
    };
  }

  // Normal operation
  return {
    can_proceed: true,
    status: 'normal',
    force_cheapest: false
  };
}

/**
 * Select proposer based on complexity and cost optimization
 * This is the core routing logic - modify here to change routing rules
 */
export function selectProposerByComplexity(
  activeProposers: ProposerConfig[],
  complexityScore: number
): { proposer: ProposerConfig; reason: string; candidates: ProposerConfig[] } {
  // Filter candidates that can handle this complexity (max_complexity ceiling)
  const candidates = activeProposers.filter(proposer => {
    // Treat complexity_threshold as max_complexity ceiling
    return complexityScore <= proposer.complexity_threshold;
  });

  let selectedProposer: ProposerConfig;
  let reason: string;

  if (candidates.length === 0) {
    // No proposer can handle this complexity - use highest capability
    selectedProposer = activeProposers.reduce((max, proposer) =>
      proposer.complexity_threshold > max.complexity_threshold ? proposer : max
    );
    reason = `Complexity ${complexityScore} exceeds all thresholds - using highest capability: ${selectedProposer.name}`;
  } else if (candidates.length === 1) {
    // Only one candidate
    selectedProposer = candidates[0];
    reason = `Single candidate for complexity ${complexityScore}: ${selectedProposer.name}`;
  } else {
    // Among candidates, select by lowest cost
    selectedProposer = candidates.reduce((cheapest, candidate) => {
      const cheapestCost = cheapest.cost_profile.input_cost_per_token;
      const candidateCost = candidate.cost_profile.input_cost_per_token;
      return candidateCost < cheapestCost ? candidate : cheapest;
    });
    reason = `Complexity ${complexityScore} - selected cheapest among ${candidates.length} candidates: ${selectedProposer.name}`;
  }

  return { proposer: selectedProposer, reason, candidates };
}

/**
 * Make routing decision with budget enforcement
 * This is the main entry point for Manager routing logic
 */
export function makeRoutingDecision(
  context: RoutingContext,
  activeProposers: ProposerConfig[],
  budgetLimits: BudgetLimits
): RoutingDecision {
  const {
    complexity_score,
    hard_stop_required,
    daily_spend
  } = context;

  if (activeProposers.length === 0) {
    throw new Error('No active proposers available');
  }

  // Check budget status
  const budgetStatus = checkBudgetStatus(daily_spend, budgetLimits);

  if (!budgetStatus.can_proceed) {
    throw new Error(budgetStatus.error_message || 'Budget limit exceeded');
  }

  // HARD STOP: Force claude-sonnet-4-5 for security/architecture (if budget allows)
  if (hard_stop_required && !budgetStatus.force_cheapest) {
    const claudeSonnet = activeProposers.find(p => p.name === 'claude-sonnet-4-5');
    if (claudeSonnet) {
      return {
        selected_proposer: claudeSonnet.name,
        reason: `Hard Stop enforced for security/architecture task (budget allows)`,
        confidence: 1.0,
        fallback_proposer: activeProposers.find(p => p.name !== claudeSonnet.name)?.name,
        routing_metadata: {
          complexity_score,
          hard_stop_required: true,
          daily_spend,
          budget_status: 'within_limits',
          available_proposers: activeProposers.length,
          selection_timestamp: new Date().toISOString(),
          routing_strategy: 'hard_stop_override'
        }
      };
    }
  }

  // BUDGET ENFORCEMENT: Force cheapest model if hard cap exceeded
  if (budgetStatus.force_cheapest) {
    const cheapest = activeProposers.reduce((min, proposer) =>
      proposer.cost_profile.input_cost_per_token < min.cost_profile.input_cost_per_token ? proposer : min
    );
    return {
      selected_proposer: cheapest.name,
      reason: `Daily hard cap exceeded (${daily_spend.toFixed(2)} >= ${budgetLimits.daily_hard_cap}) - forcing cost optimization`,
      confidence: 0.8,
      fallback_proposer: undefined,
      routing_metadata: {
        complexity_score,
        hard_stop_required,
        daily_spend,
        budget_status: 'hard_cap_exceeded',
        available_proposers: activeProposers.length,
        selection_timestamp: new Date().toISOString(),
        routing_strategy: 'budget_forced_optimization'
      }
    };
  }

  // COMPLEXITY-BASED ROUTING: Select best proposer for complexity + cost
  const { proposer: selectedProposer, reason, candidates } = selectProposerByComplexity(
    activeProposers,
    complexity_score
  );

  console.log('🎯 Manager Routing Decision:', {
    complexity_score,
    all_proposers: activeProposers.map(p => ({
      name: p.name,
      max_complexity: p.complexity_threshold,
      can_handle: complexity_score <= p.complexity_threshold
    })),
    candidates: candidates.map(p => p.name),
    selected: selectedProposer.name,
    reason,
    routing_strategy: 'max_complexity_ceiling_with_cost_optimization'
  });

  return {
    selected_proposer: selectedProposer.name,
    reason,
    confidence: 0.95,
    fallback_proposer: activeProposers.find(p => p.name !== selectedProposer.name)?.name,
    routing_metadata: {
      complexity_score,
      hard_stop_required,
      daily_spend,
      budget_status: budgetStatus.status,
      available_proposers: activeProposers.length,
      candidates_count: candidates.length,
      selection_timestamp: new Date().toISOString(),
      routing_strategy: 'max_complexity_ceiling_with_cost_optimization'
    }
  };
}

/**
 * Calculate retry strategy based on failure patterns
 * Called by Manager when a Proposer fails
 */
export interface RetryStrategy {
  should_retry: boolean;
  attempt_number: number;
  max_attempts: number;
  next_proposer?: string;
  strategy: 'same_model' | 'switch_model' | 'escalate';
  reasoning: string;
}

export function calculateRetryStrategy(
  currentProposer: string,
  attemptNumber: number,
  failureReason: string,
  activeProposers: ProposerConfig[]
): RetryStrategy {
  const MAX_ATTEMPTS = 3;

  if (attemptNumber >= MAX_ATTEMPTS) {
    return {
      should_retry: false,
      attempt_number: attemptNumber,
      max_attempts: MAX_ATTEMPTS,
      strategy: 'escalate',
      reasoning: `Maximum retry attempts (${MAX_ATTEMPTS}) reached`
    };
  }

  // Attempt 1 → Attempt 2: Same model with failure context
  if (attemptNumber === 1) {
    return {
      should_retry: true,
      attempt_number: attemptNumber + 1,
      max_attempts: MAX_ATTEMPTS,
      next_proposer: currentProposer,
      strategy: 'same_model',
      reasoning: 'First retry: Same model with failure context added'
    };
  }

  // Attempt 2 → Attempt 3: Switch to higher capability model or escalate
  if (attemptNumber === 2) {
    const current = activeProposers.find(p => p.name === currentProposer);
    const higherCapability = activeProposers.find(
      p => p.complexity_threshold > (current?.complexity_threshold || 0)
    );

    if (higherCapability) {
      return {
        should_retry: true,
        attempt_number: attemptNumber + 1,
        max_attempts: MAX_ATTEMPTS,
        next_proposer: higherCapability.name,
        strategy: 'switch_model',
        reasoning: `Switching to higher capability model: ${higherCapability.name}`
      };
    }

    return {
      should_retry: false,
      attempt_number: attemptNumber,
      max_attempts: MAX_ATTEMPTS,
      strategy: 'escalate',
      reasoning: 'No higher capability model available - escalating'
    };
  }

  // Fallback: Don't retry
  return {
    should_retry: false,
    attempt_number: attemptNumber,
    max_attempts: MAX_ATTEMPTS,
    strategy: 'escalate',
    reasoning: 'Unknown attempt number - escalating'
  };
}

/**
 * Get Hard Stop keywords (for inspection/debugging)
 */
export function getHardStopKeywords() {
  return { ...HARD_STOP_KEYWORDS };
}
