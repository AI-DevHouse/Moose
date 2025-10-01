// src/lib/architect-decomposition-rules.ts
// Single source of truth for Architect decomposition logic

import type { TechnicalSpec, WorkOrder } from '@/types/architect';

// Decomposition thresholds (easily modifiable)
export const DECOMPOSITION_THRESHOLDS = {
  MIN_WORK_ORDERS: 3,
  MAX_WORK_ORDERS: 8,
  MAX_TOKENS_PER_WO: 4000,
  COST_PER_1K_TOKENS: 0.001, // dollars
};

// Token estimation rules by complexity
export const TOKEN_ESTIMATION_RULES = {
  LOW_COMPLEXITY: { min: 500, max: 1000 },    // CRUD, config
  MEDIUM_COMPLEXITY: { min: 1000, max: 2000 }, // business logic, API
  HIGH_COMPLEXITY: { min: 2000, max: 4000 },   // architecture, security
};

/**
 * Build the Architect system prompt
 * This is the core instruction set for decomposition - modify here to change decomposition strategy
 */
export function buildArchitectPrompt(spec: TechnicalSpec): string {
  return `You are an expert technical architect decomposing specifications into Work Orders.

INPUT:
Feature: ${spec.feature_name}
Objectives:
${spec.objectives.map(o => `- ${o}`).join('\n')}

Constraints:
${spec.constraints.map(c => `- ${c}`).join('\n')}

Acceptance Criteria:
${spec.acceptance_criteria.map(a => `- ${a}`).join('\n')}

YOUR TASK:
1. Analyze complexity and scope
2. Decompose into ${DECOMPOSITION_THRESHOLDS.MIN_WORK_ORDERS}-${DECOMPOSITION_THRESHOLDS.MAX_WORK_ORDERS} Work Orders
3. Identify sequential dependencies (A must complete before B)
4. Estimate tokens per WO (warn if >${DECOMPOSITION_THRESHOLDS.MAX_TOKENS_PER_WO})
5. Assess risk level (low/medium/high) per WO
6. Generate decomposition documentation

OUTPUT FORMAT (valid JSON):
{
  "work_orders": [
    {
      "title": "Implement OAuth provider config",
      "description": "Create configuration for Google/GitHub OAuth providers",
      "acceptance_criteria": ["Config file created", "Provider credentials validated"],
      "files_in_scope": ["config/oauth.ts", "types/auth.ts"],
      "context_budget_estimate": 800,
      "risk_level": "low",
      "dependencies": []
    },
    {
      "title": "Create session management",
      "description": "Redis-backed session storage with user profile sync",
      "acceptance_criteria": ["Sessions persist", "User data syncs"],
      "files_in_scope": ["lib/session.ts", "lib/redis.ts"],
      "context_budget_estimate": 1500,
      "risk_level": "medium",
      "dependencies": ["0"]
    }
  ],
  "decomposition_doc": "# Implementation Plan\\n## Dependencies\\nWO-0 (OAuth config) → WO-1 (Sessions)\\n## Rationale\\n[Explain chunking strategy]",
  "total_estimated_cost": 25.50
}

ESTIMATION RULES:
- Low complexity (CRUD, config): ${TOKEN_ESTIMATION_RULES.LOW_COMPLEXITY.min}-${TOKEN_ESTIMATION_RULES.LOW_COMPLEXITY.max} tokens
- Medium complexity (business logic, API): ${TOKEN_ESTIMATION_RULES.MEDIUM_COMPLEXITY.min}-${TOKEN_ESTIMATION_RULES.MEDIUM_COMPLEXITY.max} tokens
- High complexity (architecture, security): ${TOKEN_ESTIMATION_RULES.HIGH_COMPLEXITY.min}-${TOKEN_ESTIMATION_RULES.HIGH_COMPLEXITY.max} tokens
- Flag if estimate >${DECOMPOSITION_THRESHOLDS.MAX_TOKENS_PER_WO} (suggest splitting)

COST CALCULATION:
- Sum all context_budget_estimate values from all work orders
- Divide by 1000 to get approximate dollar cost (assume $${DECOMPOSITION_THRESHOLDS.COST_PER_1K_TOKENS} per 1K tokens)
- Example: If work orders total 13000 tokens, cost = 13000 / 1000 = $13.00
- Return as number with 2 decimal places (13.00, not 13000)

DEPENDENCY RULES:
- Only sequential dependencies (A→B→C)
- No parallel work yet
- No circular dependencies
- Use array indices for dependencies (e.g., "0" for first WO)

Return ONLY valid JSON, no markdown, no explanation.`;
}

/**
 * Validate work order count is within acceptable range
 */
export function validateWorkOrderCount(count: number): void {
  if (count < DECOMPOSITION_THRESHOLDS.MIN_WORK_ORDERS) {
    throw new Error(
      `Too few work orders (${count}). Minimum is ${DECOMPOSITION_THRESHOLDS.MIN_WORK_ORDERS}. ` +
      `Spec is not sufficiently decomposed.`
    );
  }

  if (count > DECOMPOSITION_THRESHOLDS.MAX_WORK_ORDERS) {
    throw new Error(
      `Too many work orders (${count}). Maximum is ${DECOMPOSITION_THRESHOLDS.MAX_WORK_ORDERS}. ` +
      `Spec is too granular - combine related tasks.`
    );
  }
}

/**
 * Validate dependencies for circular references
 * Uses depth-first search to detect cycles
 */
export function validateDependencies(workOrders: WorkOrder[]): void {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (index: string): boolean => {
    if (recursionStack.has(index)) return true;
    if (visited.has(index)) return false;

    visited.add(index);
    recursionStack.add(index);

    const wo = workOrders[parseInt(index)];
    for (const dep of wo.dependencies || []) {
      if (hasCycle(dep)) return true;
    }

    recursionStack.delete(index);
    return false;
  };

  for (let i = 0; i < workOrders.length; i++) {
    if (hasCycle(i.toString())) {
      throw new Error(
        `Circular dependency detected in work orders. ` +
        `Check WO-${i} and its dependencies for cycles.`
      );
    }
  }
}

/**
 * Validate token budget per work order
 * Warn but don't fail for estimates over threshold
 */
export function validateTokenBudgets(workOrders: WorkOrder[]): string[] {
  const warnings: string[] = [];

  workOrders.forEach((wo, index) => {
    if (wo.context_budget_estimate > DECOMPOSITION_THRESHOLDS.MAX_TOKENS_PER_WO) {
      warnings.push(
        `WO-${index} (${wo.title}): Estimated ${wo.context_budget_estimate} tokens ` +
        `exceeds threshold of ${DECOMPOSITION_THRESHOLDS.MAX_TOKENS_PER_WO}. ` +
        `Consider splitting into smaller work orders.`
      );
    }
  });

  return warnings;
}

/**
 * Validate cost estimate is reasonable
 */
export function validateCostEstimate(
  totalCost: number,
  workOrders: WorkOrder[]
): string[] {
  const warnings: string[] = [];

  // Calculate expected cost from token estimates
  const totalTokens = workOrders.reduce((sum, wo) => sum + wo.context_budget_estimate, 0);
  const expectedCost = (totalTokens / 1000) * DECOMPOSITION_THRESHOLDS.COST_PER_1K_TOKENS;

  // Allow 50% variance (Claude might estimate differently)
  const variance = Math.abs(totalCost - expectedCost) / expectedCost;
  if (variance > 0.5) {
    warnings.push(
      `Cost estimate variance: Reported $${totalCost.toFixed(2)} vs ` +
      `expected $${expectedCost.toFixed(2)} (${(variance * 100).toFixed(0)}% difference). ` +
      `Review token estimates or cost calculation.`
    );
  }

  return warnings;
}

/**
 * Strip markdown code blocks from Claude's response
 * Claude often wraps JSON in ```json despite instructions
 */
export function stripMarkdownCodeBlocks(content: string): string {
  return content
    .replace(/^```json\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

/**
 * Update decomposition thresholds (for future dynamic configuration)
 */
export function updateDecompositionThresholds(
  updates: Partial<typeof DECOMPOSITION_THRESHOLDS>
): void {
  Object.assign(DECOMPOSITION_THRESHOLDS, updates);
}

/**
 * Get current thresholds (for inspection/debugging)
 */
export function getDecompositionThresholds() {
  return { ...DECOMPOSITION_THRESHOLDS };
}
