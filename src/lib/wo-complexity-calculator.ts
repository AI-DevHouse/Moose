// src/lib/wo-complexity-calculator.ts
// Work Order Complexity Assessment Calculator
// Predicts if a WO is too large/complex and likely to fail

export interface WOComplexitySignal {
  score: number; // 0.0-1.0 (higher = more complex/risky)
  signal: 'healthy' | 'review_recommended' | 'likely_oversized';
  guidance: string;
  factors: {
    fileCount: number;
    criteriaCount: number;
    dependencyCount: number;
    estimatedTokens: number;
    riskLevel: number;
  };
}

export interface WorkOrderInput {
  files_in_scope: any; // Json type from database (array or object)
  acceptance_criteria: any; // Json type from database (array or object)
  metadata: any; // Json type containing dependencies
  context_budget_estimate: number | null;
  risk_level: string;
}

/**
 * Assesses the complexity/scope of a work order
 *
 * Formula (validated r=-0.97 correlation with acceptance scores):
 * - File count: 35% weight (normalized by /6)
 * - Criteria count: 25% weight (normalized by /8)
 * - Dependencies: 15% weight (normalized by /4)
 * - Token estimate: 15% weight (normalized by /4000)
 * - Risk level: 10% weight (high=1.0, medium=0.6, low=0.3)
 *
 * Thresholds:
 * - <0.55: Healthy (likely to succeed)
 * - 0.55-0.70: Review recommended (moderate risk)
 * - >0.70: Likely oversized (high failure risk)
 */
export function assessWOScope(wo: WorkOrderInput): WOComplexitySignal {
  // Extract file count (handle Json type - could be array or object)
  let fileCount = 0;
  if (wo.files_in_scope !== null && wo.files_in_scope !== undefined) {
    if (Array.isArray(wo.files_in_scope)) {
      fileCount = wo.files_in_scope.length;
    } else if (typeof wo.files_in_scope === 'object') {
      // If it's an object, try to get length property or count keys
      fileCount = (wo.files_in_scope as any).length ||
                  Object.keys(wo.files_in_scope).length;
    }
  }

  // Extract criteria count (handle Json type)
  let criteriaCount = 0;
  if (wo.acceptance_criteria !== null && wo.acceptance_criteria !== undefined) {
    if (Array.isArray(wo.acceptance_criteria)) {
      criteriaCount = wo.acceptance_criteria.length;
    } else if (typeof wo.acceptance_criteria === 'object') {
      criteriaCount = (wo.acceptance_criteria as any).length ||
                      Object.keys(wo.acceptance_criteria).length;
    }
  }

  // Extract dependency count from metadata
  let dependencyCount = 0;
  if (wo.metadata !== null && wo.metadata !== undefined) {
    const metadata = wo.metadata as any;
    if (Array.isArray(metadata.dependencies)) {
      dependencyCount = metadata.dependencies.length;
    } else if (Array.isArray(metadata.dependency_ids)) {
      dependencyCount = metadata.dependency_ids.length;
    }
  }

  // Token estimate (default to 1000 if not set)
  const tokenEstimate = wo.context_budget_estimate || 1000;

  // Risk level multiplier
  const riskMultiplier =
    wo.risk_level === 'high' ? 1.0 :
    wo.risk_level === 'medium' ? 0.6 : 0.3;

  // Calculate complexity score (0.0-1.0+)
  const score = (
    (fileCount / 6) * 0.35 +           // Increased from 0.30
    (criteriaCount / 8) * 0.25 +
    (dependencyCount / 4) * 0.15 +
    (tokenEstimate / 4000) * 0.15 +    // Decreased from 0.20
    riskMultiplier * 0.10
  );

  // Categorize based on thresholds
  const signal: WOComplexitySignal['signal'] =
    score < 0.55 ? 'healthy' :
    score < 0.70 ? 'review_recommended' : 'likely_oversized';

  // Generate guidance
  const guidance =
    signal === 'healthy' ? 'WO scope is appropriate - proceed with confidence' :
    signal === 'review_recommended' ? 'Consider simplifying this WO or adding more specific acceptance criteria' :
    'WO is likely too large - strong candidate for splitting into smaller WOs';

  return {
    score: parseFloat(score.toFixed(2)), // Round to 2 decimals
    signal,
    guidance,
    factors: {
      fileCount,
      criteriaCount,
      dependencyCount,
      estimatedTokens: tokenEstimate,
      riskLevel: riskMultiplier
    }
  };
}

/**
 * Convenience function to check if a WO is healthy
 */
export function isHealthyWO(wo: WorkOrderInput): boolean {
  const assessment = assessWOScope(wo);
  return assessment.signal === 'healthy';
}

/**
 * Convenience function to check if a WO is oversized
 */
export function isOversizedWO(wo: WorkOrderInput): boolean {
  const assessment = assessWOScope(wo);
  return assessment.signal === 'likely_oversized';
}

/**
 * Batch assessment for multiple WOs
 */
export function assessMultipleWOs(wos: WorkOrderInput[]): WOComplexitySignal[] {
  return wos.map(wo => assessWOScope(wo));
}
