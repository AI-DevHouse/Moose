// src/lib/architect-decomposition-rules.ts
// Single source of truth for Architect decomposition logic

import type { TechnicalSpec, WorkOrder } from '@/types/architect';

// Decomposition thresholds (easily modifiable)
export const DECOMPOSITION_THRESHOLDS = {
  MIN_WORK_ORDERS: 3,
  MAX_WORK_ORDERS: 20,  // Increased from 8 to support greenfield projects
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

SPECIFICATION STRUCTURE ANALYSIS (check FIRST):

Before standard decomposition, scan for existing structural indicators:
- Numbered section headers (## 4.1, ## 4.2, ### 4.1.1, etc.)
- "Component Specifications" or "Detailed Component Specifications" sections
- Clear module/service/component boundaries with descriptions
- Existing work breakdown structure

IF STRUCTURED DECOMPOSITION DETECTED:
1. EXTRACT sections as work units (preserve numbering and hierarchy)
2. USE existing titles as work order titles
3. USE existing descriptions as work order descriptions
4. INFER files_in_scope from section content (look for file paths, component names)
5. GENERATE acceptance_criteria from section requirements and constraints
6. MAP dependencies from cross-references between sections (e.g., "depends on 4.1", "uses API from 4.2")
7. AUGMENT with missing pieces:
   - Add integration contracts if components communicate
   - Add deployment configs if infrastructure mentioned
   - Add test fixture requirements if testing mentioned
8. OUTPUT with metadata in decomposition_doc:
   - Add "## Decomposition Metadata" section at top
   - decomposition_source: "extracted"
   - extraction_confidence: 0.0-1.0 (1.0 = perfect structure, 0.5 = partial)
   - original_structure: "section_based"
   - modifications_made: [list what was augmented]

IF NO CLEAR STRUCTURE:
- Proceed with standard decomposition (below)
- decomposition_source: "generated"

SPECIFICATION VALIDATION (check for blockers):

Scan specification for missing critical information:

UI-HEAVY PROJECTS (mentions: UI, views, screens, components, interface, frontend):
- CHECK FOR: Wireframes, mockups, Figma links, component hierarchy, design specs
- IF MISSING: Add to decomposition_doc:
  ## ⚠️ BLOCKERS - REQUIRES INPUT

  **UI Wireframes Missing:**
  Components requiring design: [list UI component names from spec]

  **Impact:** Moose will implement based on literal text descriptions only, which may not match intended design.

  **Recommendation:** Provide wireframes before executing work orders.

  **Auto-Resolution:** Enable wireframe generation with --generate-wireframes flag.

API/SERVICE PROJECTS (mentions: endpoints, API, routes, services, REST, GraphQL):
- CHECK FOR: API schemas, endpoint definitions, request/response formats, error codes
- IF MISSING: Flag as WARNING (can infer from context but may be incomplete)

DEPLOYMENT PROJECTS (mentions: production, deployment, infrastructure, Docker, CI/CD):
- CHECK FOR: Deployment platform, infrastructure requirements, environment variables
- IF MISSING: Flag as WARNING (can use defaults but may need customization)

DATABASE PROJECTS (mentions: database, persistence, storage, tables, collections):
- CHECK FOR: Database schemas, relationships, indexes, constraints
- IF MISSING: Flag as WARNING (can infer but may miss optimization opportunities)

CONTINUE with decomposition regardless of blockers (user decides whether to proceed).

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
