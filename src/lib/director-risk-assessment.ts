// src/lib/director-risk-assessment.ts
// Single source of truth for Director risk assessment logic

import { WorkOrder } from '@/types/architect';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskAssessment {
  work_order_id: string;
  risk_level: RiskLevel;
  risk_factors: string[];
  confidence_score: number;
  reasoning: string;
  requires_human_approval: boolean;
}

export interface ApprovalDecision {
  approved: boolean;
  risk_assessments: RiskAssessment[];
  aggregate_risk: RiskLevel;
  total_cost: number;
  requires_human_approval: boolean;
  reasoning: string;
  auto_approved: boolean;
}

// Risk assessment thresholds (easily modifiable)
const RISK_THRESHOLDS = {
  // Cost thresholds
  MAX_AUTO_APPROVE_COST: 50, // dollars

  // Confidence thresholds
  MIN_CONFIDENCE_FOR_AUTO_APPROVE: 0.95,

  // Risk level weights
  RISK_WEIGHTS: {
    low: 1,
    medium: 3,
    high: 10
  }
};

// Risk factor detection rules
const RISK_INDICATORS = {
  HIGH_RISK: [
    'breaking change',
    'schema migration',
    'authentication',
    'authorization',
    'security',
    'encryption',
    'API contract',
    'architectural decision',
    'database migration'
  ],
  MEDIUM_RISK: [
    'refactor',
    'new API',
    'schema change',
    'integration',
    'dependency',
    'performance',
    'caching'
  ],
  LOW_RISK: [
    'documentation',
    'config',
    'logging',
    'comments',
    'formatting',
    'typo'
  ]
};

/**
 * Assess risk for a single Work Order
 * This is the core risk evaluation logic - modify here to change risk rules
 */
export function assessWorkOrderRisk(
  workOrder: WorkOrder,
  index: number
): RiskAssessment {
  const risk_factors: string[] = [];
  let risk_score = 0;

  // Check title and description for risk indicators
  const searchText = `${workOrder.title} ${workOrder.description}`.toLowerCase();

  // High risk indicators
  for (const indicator of RISK_INDICATORS.HIGH_RISK) {
    if (searchText.includes(indicator.toLowerCase())) {
      risk_factors.push(`High risk: ${indicator}`);
      risk_score += 10;
    }
  }

  // Medium risk indicators
  for (const indicator of RISK_INDICATORS.MEDIUM_RISK) {
    if (searchText.includes(indicator.toLowerCase())) {
      risk_factors.push(`Medium risk: ${indicator}`);
      risk_score += 3;
    }
  }

  // Low risk indicators
  for (const indicator of RISK_INDICATORS.LOW_RISK) {
    if (searchText.includes(indicator.toLowerCase())) {
      risk_factors.push(`Low risk: ${indicator}`);
      risk_score += 1;
    }
  }

  // Use Architect's risk level if provided
  if (workOrder.risk_level === 'high') {
    risk_score += 10;
    risk_factors.push('Architect marked as high risk');
  } else if (workOrder.risk_level === 'medium') {
    risk_score += 3;
    risk_factors.push('Architect marked as medium risk');
  }

  // Determine final risk level based on score
  let risk_level: RiskLevel;
  if (risk_score >= 10) {
    risk_level = 'high';
  } else if (risk_score >= 3) {
    risk_level = 'medium';
  } else {
    risk_level = 'low';
  }

  // Calculate confidence score (simplified - can be enhanced)
  // Higher confidence when Architect and detected risk align
  const architect_risk_weight = workOrder.risk_level === risk_level ? 0.3 : 0;
  const factor_confidence = Math.min(risk_factors.length * 0.1, 0.7);
  const confidence_score = Math.min(architect_risk_weight + factor_confidence, 1.0);

  const reasoning = `Risk level: ${risk_level}. Factors: ${risk_factors.join(', ') || 'none detected'}. Score: ${risk_score}`;

  return {
    work_order_id: `WO-${index}`,
    risk_level,
    risk_factors,
    confidence_score,
    reasoning,
    requires_human_approval: risk_level === 'high' || risk_level === 'medium'
  };
}

/**
 * Calculate aggregate risk across all Work Orders
 */
function calculateAggregateRisk(assessments: RiskAssessment[]): RiskLevel {
  const risk_weights = assessments.map(a => RISK_THRESHOLDS.RISK_WEIGHTS[a.risk_level]);
  const total_weight = risk_weights.reduce((sum, w) => sum + w, 0);
  const avg_weight = total_weight / assessments.length;

  if (avg_weight >= 7) return 'high';
  if (avg_weight >= 2) return 'medium';
  return 'low';
}

/**
 * Make approval decision based on risk assessments
 * This is where auto-approve vs human review logic lives
 */
export function makeApprovalDecision(
  workOrders: WorkOrder[],
  totalCost: number
): ApprovalDecision {
  // Assess each work order
  const risk_assessments = workOrders.map((wo, index) =>
    assessWorkOrderRisk(wo, index)
  );

  // Calculate aggregate risk
  const aggregate_risk = calculateAggregateRisk(risk_assessments);

  // Determine if human approval required
  const has_high_risk = risk_assessments.some(a => a.risk_level === 'high');
  const exceeds_cost_threshold = totalCost > RISK_THRESHOLDS.MAX_AUTO_APPROVE_COST;
  const low_confidence = risk_assessments.some(
    a => a.confidence_score < RISK_THRESHOLDS.MIN_CONFIDENCE_FOR_AUTO_APPROVE
  );

  const requires_human_approval =
    has_high_risk ||
    exceeds_cost_threshold ||
    low_confidence;

  // Auto-approve if all criteria met
  const auto_approved =
    !requires_human_approval &&
    aggregate_risk === 'low' &&
    totalCost <= RISK_THRESHOLDS.MAX_AUTO_APPROVE_COST;

  // Build reasoning
  const reasoning_parts: string[] = [];
  if (has_high_risk) {
    reasoning_parts.push(`Contains ${risk_assessments.filter(a => a.risk_level === 'high').length} high-risk work orders`);
  }
  if (exceeds_cost_threshold) {
    reasoning_parts.push(`Cost $${totalCost.toFixed(2)} exceeds threshold $${RISK_THRESHOLDS.MAX_AUTO_APPROVE_COST}`);
  }
  if (low_confidence) {
    reasoning_parts.push('Low confidence in risk assessment');
  }
  if (auto_approved) {
    reasoning_parts.push('All criteria met for auto-approval');
  }

  const reasoning = reasoning_parts.join('. ') || 'Standard approval process';

  return {
    approved: auto_approved,
    risk_assessments,
    aggregate_risk,
    total_cost: totalCost,
    requires_human_approval,
    reasoning,
    auto_approved
  };
}

/**
 * Update risk thresholds (for future dynamic configuration)
 */
export function updateRiskThresholds(updates: Partial<typeof RISK_THRESHOLDS>) {
  Object.assign(RISK_THRESHOLDS, updates);
}

/**
 * Get current risk thresholds (for inspection/debugging)
 */
export function getRiskThresholds() {
  return { ...RISK_THRESHOLDS };
}
