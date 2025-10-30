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
      "title": "Create OAuth provider config",
      "description": "Implement Google/GitHub OAuth configuration. Store credentials securely. Handle token refresh.",
      "acceptance_criteria": [
        "Config validates credentials",
        "Tokens refresh before expiry",
        "Invalid credentials rejected"
      ],
      "files_in_scope": ["config/oauth.ts", "types/auth.ts"],
      "context_budget_estimate": 800,
      "risk_level": "low",
      "dependencies": [],
      "technical_requirements": {
        "npm_dependencies": ["@auth/core@0.18.0"],
        "npm_dev_dependencies": ["@types/node@20.11.0", "typescript@5.2.2"],
        "environment_variables": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
        "external_services": [
          {
            "name": "Google OAuth",
            "env_vars": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
            "purpose": "OAuth authentication provider"
          }
        ]
      }
    },
    {
      "title": "Create session management",
      "description": "Implement Redis session storage. Handle user profile sync. Enable automatic expiration.",
      "acceptance_criteria": ["Sessions persist in Redis", "User data syncs", "Expired sessions cleared"],
      "files_in_scope": ["lib/session.ts", "lib/redis.ts"],
      "context_budget_estimate": 1500,
      "risk_level": "medium",
      "dependencies": ["0"],
      "technical_requirements": {
        "npm_dependencies": ["redis@4.6.0"],
        "npm_dev_dependencies": ["@types/redis@4.0.11", "typescript@5.2.2"],
        "environment_variables": ["REDIS_URL", "REDIS_PASSWORD", "SESSION_TTL"],
        "external_services": [
          {
            "name": "Redis",
            "env_vars": ["REDIS_URL", "REDIS_PASSWORD"],
            "purpose": "Session storage backend"
          }
        ]
      }
    }
  ],
  "decomposition_doc": "# Implementation Plan\\n\\nOAuth setup enables secure authentication. Session management provides stateful user tracking.\\n\\n## Dependencies\\nWO-0 (OAuth) → WO-1 (Sessions use OAuth tokens)",
  "total_estimated_cost": 2.30
}

CONCISENESS RULES (reduce token costs while maintaining clarity):

1. **Work Order Titles**: Maximum 8 words
   ✅ GOOD: "Create OAuth provider configuration"
   ❌ TOO LONG: "Create a comprehensive OAuth provider configuration system for Google and GitHub"

2. **Work Order Descriptions**: Maximum 3 sentences describing WHAT to do (not WHY or HOW)
   ✅ GOOD: "Implement JWT authentication. Handle login/logout endpoints. Store sessions in Redis."
   ❌ TOO VERBOSE: "We need to implement a comprehensive authentication service that will handle all user login and logout functionality. This service should use JSON Web Tokens for maintaining user sessions across multiple requests. The tokens should be stored in Redis for fast access and automatic expiration..."

3. **Acceptance Criteria**: Maximum 5 bullet points, each ≤10 words
   ✅ GOOD: ["Login returns valid JWT", "Logout clears session", "Invalid credentials return 401"]
   ❌ TOO VERBOSE: ["The login endpoint should successfully authenticate users and return a valid JWT token that contains the user's ID and role", ...]

4. **Files in Scope**: List file paths only, no explanations
   ✅ GOOD: ["src/auth/service.ts", "src/auth/types.ts"]
   ❌ WRONG: ["src/auth/service.ts (main authentication logic)", ...]

5. **Technical Requirements**: This section should be DETAILED and COMPLETE (exception to brevity rules)
   - List ALL dependencies with exact versions
   - List ALL environment variables
   - Include complete external service configurations
   - This is the ONE place where verbosity is required for validator accuracy

6. **Decomposition Doc**: Keep rationale brief (2-3 sentences per section)

7. **No Markdown in JSON**: Output ONLY valid JSON structure (no code blocks, no commentary)

**Balance:** Be concise in prose descriptions, but EXHAUSTIVE in technical_requirements.

TECHNICAL REQUIREMENTS (CRITICAL - MUST INCLUDE FOR EVERY WORK ORDER):

For EACH work order, you MUST include a "technical_requirements" object specifying:

1. **npm_dependencies**: Production packages this specific WO needs (with versions when critical)
   - Include ONLY packages THIS WO directly imports/uses
   - Specify exact versions for frameworks and major libraries (e.g., "react@18.2.0")
   - **CRITICAL**: All package versions MUST exist in npm registry
   - Verify package versions before specifying them:
     * Check https://www.npmjs.com/package/{package-name} for valid versions
     * Use exact versions that exist (e.g., "typescript@5.2.2" NOT "typescript@5.3.0")
     * **SCOPED PACKAGE FORMAT**: Always use full package name before version
       ❌ WRONG: "@@20.8.0" (missing package name)
       ✅ CORRECT: "@types/node@20.8.0" (complete scoped package)
       ❌ WRONG: "@@9.0.7" (missing package name)
       ✅ CORRECT: "@types/uuid@9.0.7" (complete scoped package)
     * Common mistakes to avoid:
       - typescript@5.3.0 (doesn't exist, latest is 5.2.2)
       - jest-coverage-threshold (package doesn't exist)
       - @types/electron (deprecated, types now built into electron package)
       - @@20.8.0 (CRITICAL: missing package name, must be @types/node@20.8.0)
   - If unsure of exact version, use "latest" or omit @version (bootstrap will resolve)
   - Use latest stable versions unless spec requires specific version
   - If no production deps needed for this WO, use empty array []

2. **npm_dev_dependencies**: Development packages (types, testing tools, linters)
   - Include type definitions for all production packages (e.g., "@types/react@18.2.0")
   - Include build tools if this WO creates configuration (e.g., "typescript@5.2.2")
   - **NOTE**: A package validator will run after decomposition to check all versions.
     Invalid packages will be auto-corrected, but this adds processing time and may
     change your specifications. It's better to specify valid packages from the start.
   - If no dev deps needed, use empty array []

3. **environment_variables**: ALL environment variables this WO's code will reference
   - Scan description and files_in_scope for process.env.XXX references
   - Include API keys, URLs, secrets, config values
   - Use SCREAMING_SNAKE_CASE naming
   - If no env vars needed, use empty array []

4. **external_services**: Third-party services/APIs this WO integrates with
   - Include name, required env_vars array, and purpose string
   - Examples: APIs, databases, auth providers, payment processors
   - If no external services, use empty array []

5. **tsconfig_requirements**: TypeScript configuration needs (ONLY if this WO has specific needs)
   - "jsx": ONLY specify if this WO creates .tsx files or React components
     Valid values: "react" | "react-jsx" | "preserve"
   - "target": ONLY if non-standard (default is ES2020)
   - "lib": ONLY if needs DOM types or specific ES features
   - "module": ONLY if needs specific module system
   - If standard TypeScript, use empty object {}

CRITICAL CONSISTENCY RULES:

1. **Version Consistency**: If multiple WOs use the same package, they MUST specify the SAME version
   ❌ WRONG: WO-1 has "react@18.2.0", WO-3 has "react@19.0.0"
   ✅ CORRECT: All WOs using React specify "react@18.2.0"

2. **JSX Consistency**: If multiple WOs need JSX, they MUST use the SAME jsx setting
   ❌ WRONG: WO-1 has jsx: "react", WO-2 has jsx: "react-jsx"
   ✅ CORRECT: All WOs with JSX use jsx: "react-jsx"

3. **Framework Consistency**: Do NOT specify conflicting primary frameworks
   ❌ WRONG: WO-1 uses "next@14.0.0", WO-5 uses "express@4.18.0" (conflicting web frameworks)
   ✅ CORRECT: Choose ONE primary framework for the entire project

4. **Transitive Dependencies**: If you import from a package, list it
   ❌ WRONG: Import ReactDOM.render but only list "react" in dependencies
   ✅ CORRECT: List both "react@18.2.0" and "react-dom@18.2.0"

5. **Completeness**: Include ALL dependencies each WO needs (aggregation will deduplicate)
   ❌ WRONG: WO-3 uses React but doesn't list it (assuming WO-1 already did)
   ✅ CORRECT: WO-3 lists "react@18.2.0" even though WO-1 also uses it

6. **Package Validity**: ALL packages and versions MUST exist in npm registry
   ❌ WRONG: "typescript@5.3.0" (version doesn't exist)
   ✅ CORRECT: "typescript@5.2.2" (latest stable version)
   ❌ WRONG: "jest-coverage-threshold@1.0.0" (package doesn't exist)
   ✅ CORRECT: Configure in jest.config.js instead, no package needed

   **How to verify:**
   - Visit https://www.npmjs.com/package/{package-name}
   - Check "Versions" tab for available versions
   - Use latest stable unless spec requires specific version

PRE-SUBMISSION QUALITY VALIDATION (CRITICAL - CHECK BEFORE RETURNING):

Perform these checks on your output BEFORE returning JSON:

1. **Package Validation**:
   - [ ] All npm_dependencies use packages that exist in npm registry
   - [ ] All versions specified are real versions (not made-up)
   - [ ] TypeScript version is valid (current: 5.2.2, NOT 5.3.0)
   - [ ] No non-existent packages (e.g., jest-coverage-threshold)
   - [ ] @types packages verified (some are deprecated, e.g., @types/electron)
   - [ ] No malformed scoped packages (e.g., "@@20.8.0" must be "@types/node@20.8.0")

2. **Version Consistency**:
   - [ ] Same package = same version across ALL work orders
   - [ ] No major version conflicts (react@18 vs react@19)
   - [ ] Framework versions aligned (all Next.js WOs use same version)

3. **JSX Consistency**:
   - [ ] If multiple WOs use JSX, all specify SAME jsx setting
   - [ ] Only one jsx value used: "react-jsx" OR "react" OR "preserve"

4. **Framework Coherence**:
   - [ ] Only ONE primary UI framework (React OR Vue OR Angular, not multiple)
   - [ ] Backend framework choice is consistent
   - [ ] No conflicting build tools (webpack OR vite, not both)

5. **Dependency Completeness**:
   - [ ] Each WO lists ALL packages it directly imports
   - [ ] Transitive dependencies included (react + react-dom, not just react)
   - [ ] Type definitions included for all production packages
   - [ ] No assumptions that earlier WOs "already listed it"

6. **Circular Dependencies**:
   - [ ] No WO depends on itself
   - [ ] No circular chains (WO-1→WO-2→WO-3→WO-1)
   - [ ] Dependency indices are valid (0 to N-1)

7. **Conciseness Check**:
   - [ ] All titles ≤8 words
   - [ ] All descriptions ≤3 sentences
   - [ ] All acceptance criteria ≤5 items, each ≤10 words
   - [ ] No prose explanations in files_in_scope
   - [ ] Technical_requirements is detailed (exception to brevity)

8. **Completeness Check**:
   - [ ] Every WO has non-empty acceptance_criteria
   - [ ] Every WO has risk_level (low/medium/high)
   - [ ] Every WO has context_budget_estimate
   - [ ] Every WO has technical_requirements (even if empty arrays)
   - [ ] Files_in_scope lists actual file paths

9. **Clarity Check**:
   - [ ] Each WO description clearly states WHAT to implement
   - [ ] No ambiguous acceptance criteria ("should work well" ❌, "returns 200 OK" ✅)
   - [ ] Dependencies are clear and justified

10. **JSON Validity**:
    - [ ] Output is valid JSON (no trailing commas, proper quotes)
    - [ ] No markdown formatting (no code blocks)
    - [ ] No explanatory text outside JSON structure

**If ANY checks fail, FIX THE ISSUES before returning your output.**

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
