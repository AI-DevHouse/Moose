# Architecture Decisions

**Master reference.** Aligned with "Basic Agent Architecture(2).txt".

---

## Agent Hierarchy

```
HUMAN
  ↓ uploads spec, reviews escalations, approves high-risk
ARCHITECT (Phase 2.0 - ✅ Complete)
  ↓ decompose spec → Work Orders
DIRECTOR (Phase 2.1 - rename from "Manager LLM")
  ↓ governance, risk assessment, approval
MANAGER (Phase 4.1 - rename from "Director")
  ↓ routing, budget, coordination
PROPOSERS (Phase 2.2 - operational + self-refinement next)
  ↓ code generation
ORCHESTRATOR (Phase 2.3/3.2 - Aider infrastructure, NOT agent)
  ↓ apply code, branch, PR, test trigger
SENTINEL (Phase 3.1 - planned)
  ↓ adaptive quality gates
CLIENT MANAGER (Phase 2.5 - planned)
  ↓ escalation → human with options
```

---

## Agent Responsibilities

### ARCHITECT (Phase 2.0 - ✅ Complete)

**Purpose:** Strategic decomposition of specs → Work Orders

**Responsibilities:**
- Receive technical spec from human (Mission Control upload)
- Analyze complexity, scope, context requirements
- Estimate token/context limits per chunk
- Map dependencies (sequential vs parallelizable)
- Define WO boundaries (feature/file/risk isolation)
- Create decomposition doc (dependency graph, integration points, sequencing)
- Output structured WOs with clear acceptance criteria
- Provide shared reference documentation to prevent context drift

**Model:** Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

**Key Outputs:**
- Work Order queue with dependencies mapped
- Decomposition documentation accessible to all agents
- Context budget allocation per Work Order
- Integration contract specifications

**Does NOT:**
- Approve or assess risk (Director's job)
- Execute code generation (Proposer's job)
- Handle runtime coordination (Manager's job)
- Make escalation decisions (Client Manager's job)
- Apply code to repository (Orchestrator's job)

**Status:**
- ✅ API complete (`/api/architect/decompose`)
- ✅ Tested: OAuth spec → 8 WOs, $11.30
- ✅ Database migration (5 new work_orders columns)
- ✅ UI integration (Upload Spec tab)
- ✅ Director approval flow

**Cost:** $11.30/decomposition, $226-$452/month at 1-2 calls/day (75-150% of £300 LLM budget) - acceptable for low-frequency high-stakes decisions

**Constraints:**
- 3-8 WOs (too few=not decomposed, too many=overwhelming)
- <4000 tokens per WO context budget
- Sequential dependencies (temporarily relaxed for multi-parent patterns)
- JSON markdown stripping required (Claude wraps despite prompts)

**Database Tables:**
- Writes to: work_orders (creates initial records)
- References: contracts (for boundary validation)

**Files:**
- `src/lib/architect-decomposition-rules.ts` (7535 lines) - Centralized decomposition logic
- `src/lib/architect-service.ts` (2511 lines) - Orchestration layer
- `src/types/architect.ts` (737 lines) - Type definitions
- `src/app/api/architect/decompose/route.ts` - API endpoint

---

### DIRECTOR (Phase 2.1 - Implemented as "Manager LLM")

**Purpose:** Senior governance, risk assessment, approval authority

**Responsibilities:**
- Receive Work Orders from Architect
- Validate against contracts using contract-validator.ts:
  - Detect breaking changes
  - Verify API compatibility
  - Check domain model consistency
- Risk assessment per Work Order:
  - Low: Config changes, documentation, non-breaking additions
  - Medium: Schema changes, new APIs, refactoring
  - High: Breaking changes, architecture modifications, security changes
- Decision logging with reasoning (full audit trail)
- Progressive trust system:
  - Track pattern confidence scores
  - Auto-approve low-risk orders when confidence >0.95
  - Require human approval for medium/high risk
- Route high-risk Work Orders to human approval queue in Mission Control
- Hand approved Work Orders to Manager for execution coordination
- Monitor approval patterns to adjust trust thresholds

**Key Outputs:**
- Approved/rejected Work Orders with justification
- Risk classifications (Low/Medium/High)
- Decision audit trail with reasoning
- Approval workflow state changes

**Does NOT:**
- Decompose technical specs (Architect's job)
- Generate code (Proposer's job)
- Handle escalations (Client Manager's job)
- Coordinate runtime execution (Manager's job)
- Route to specific Proposers (Manager's job)
- Apply code changes (Orchestrator's job)

**Database Tables:**
- Reads: work_orders, contracts, pattern_confidence_scores
- Writes: decision_logs, updates work_orders.status
- References: playbook_memory for trust patterns

**Files:**
- `src/lib/director-risk-assessment.ts` - Centralized risk assessment logic
- `src/lib/director-service.ts` (216 lines) - Director approval orchestration
- `src/lib/llm-service.ts` (615 lines) - LEGACY, still used by `/api/llm/*` endpoints
- `src/lib/contract-validator.ts` - Contract validation
- `src/app/api/director/approve/route.ts` - Approval endpoint

**Current Status:** ✅ Complete - Director service implemented with centralized risk assessment

---

### MANAGER (Phase 4.1 - ✅ Complete)

**Purpose:** Tactical runtime coordination and resource management

**Responsibilities:**
- Receive approved Work Orders from Director
- Context-aware routing to appropriate Proposer based on:
  - Complexity analysis (7 factors) - max complexity ceiling approach
  - Cost optimization (select cheapest among candidates)
  - Current budget constraints (system_config)
  - Proposer availability and capability (proposer_configs)
  - Hard Stop keyword detection (20 keywords: 12 security + 8 architecture)
- Budget enforcement (three-tier system):
  - Soft cap ($20 daily): Warning status, continue normally
  - Hard cap ($50 daily): Force cheapest model (gpt-4o-mini)
  - Emergency kill ($100 daily): Stop all operations, escalate
  - Hard Stop override: security/architecture forces claude-sonnet-4-5 unless over budget
- Retry ladder with pattern-aware model switching:
  - Attempt 1 → 2: Same model with failure context added
  - Attempt 2 → 3: Switch to higher capability model (gpt-4o-mini → claude-sonnet-4-5)
  - Attempt 3+: Escalate to Client Manager
- Track performance metrics per Proposer (success rate, avg cost, execution time)

**Hard Stop Keywords (20 total):**
- Security (12): SQL injection, XSS, CSRF, authentication, authorization, encryption, password hashing, API keys, secrets management, access control, input validation, sanitization
- Architecture (8): API contract, schema change, breaking change, database migration, event schema, integration contract, system design, architectural decision

**Key Outputs:**
- Routing decisions to Proposers (stored in work_orders.metadata)
- Retry strategies based on failure patterns
- Budget enforcement actions
- Performance analytics per proposer

**Does NOT:**
- Create or decompose Work Orders (Architect's job)
- Approve Work Orders (Director's job)
- Generate code (Proposer's job)
- Escalate to humans (Client Manager's job)
- Make risk assessments (Director's job)
- Apply code to repository (Orchestrator's job)

**Database Tables:**
- Reads: work_orders, proposer_configs, system_config, cost_tracking, outcome_vectors
- Writes: work_orders.metadata (routing_metadata)
- Queries: Daily cost totals from cost_tracking for budget enforcement

**API Endpoints:**
- POST `/api/manager` - Route Work Order to Proposer
- GET `/api/manager?work_order_id=xxx&current_proposer=xxx&attempt=N` - Get retry strategy

**Files:**
- `src/lib/manager-routing-rules.ts` - Centralized routing logic (371 lines)
- `src/lib/manager-service.ts` - Orchestration only (202 lines)
- `src/app/api/manager/route.ts` - API endpoints (95 lines)

**Status:** ✅ Complete with 100% test coverage (7/7 custom tests + 18/18 integration tests passing)

**Note:** `proposer-registry.ts` still contains old routing logic (lines 110-245). Future refactor will migrate `enhanced-proposer-service.ts` to call Manager instead.

---

### PROPOSERS (Phase 2.2 - Operational)

**Purpose:** Code generation with quality self-refinement

**Models in Registry:**

**Claude Sonnet 4.5 (Primary)**
- Complexity threshold: 1.0 (handles all complexity levels)
- Cost: $3.00/1M input tokens, $15.00/1M output tokens
- Strengths: Complex logic, architecture, security, multi-step reasoning
- Use cases: Architecture changes, security fixes, complex integrations
- Hard Stop enforcement: Forced for security + architecture keywords

**GPT-4o-mini (Fallback)**
- Complexity threshold: 0.3 (simple tasks only)
- Cost: $0.15/1M input tokens, $0.60/1M output tokens
- Strengths: Simple CRUD, config changes, documentation, cost optimization
- Use cases: Low-complexity work, budget-constrained operations

**Complexity Analysis (7 factors):**
1. Architectural impact: Changes to system structure
2. Integration points: Number of systems/APIs affected
3. Data transformations: Complex data manipulation required
4. Error handling requirements: Exception scenarios to cover
5. Testing complexity: Test cases needed
6. Security implications: Auth, encryption, input validation
7. Performance considerations: Scalability, optimization needs

**Responsibilities:**
- Receive routed Work Orders from Manager
- Perform complexity analysis using 7 factors
- Generate complete, deployable code (not instructions - actual code)
- Self-refinement (Phase 2.2.6 - ✅ Complete):
  - Detect quality issues: TS compilation errors, contract violations, logic inconsistencies
  - Regenerate with learned context from failures
  - 3-cycle adaptive prompting with early abort on zero progress
  - Feed successful refinement patterns to playbook_memory
  - Cost tracking per refinement cycle
- Cost tracking per generation + refinement attempts

**Hard Stop Enforcement (20 keywords force claude-sonnet-4-5):**
- **Security (12):** SQL injection, XSS, CSRF, authentication, authorization, encryption, password hashing, API keys, secrets management, access control, input validation, sanitization
- **Architecture (8):** API contract, schema change, breaking change, database migration, event schema, integration contract, system design, architectural decision

**Key Outputs:**
- Complete code with file paths and diffs
- Complexity analysis metadata (ComplexityAnalysis interface)
- Cost breakdown (per-token pricing)
- Refinement history (attempts, issues found, fixes applied)
- Routing justification (why this model was selected)

**Does NOT:**
- Decide routing (Manager's job)
- Apply code to repo (Orchestrator's job)
- Validate execution results (Sentinel's job via Orchestrator)
- Approve Work Orders (Director's job)
- Handle escalations (Client Manager's job)

**Database Tables:**
- Reads: work_orders, proposer_configs, playbook_memory
- Writes: cost_tracking, outcome_vectors, updates to work_orders.metadata
- Updates: pattern_confidence_scores after successful patterns

**Files:**
- `src/lib/proposer-refinement-rules.ts` - Centralized 3-cycle refinement logic
- `src/lib/enhanced-proposer-service.ts` (467 lines) - Orchestration layer
- `src/lib/complexity-analyzer.ts` - 7-factor complexity analysis
- `src/lib/claude-sonnet-proposer.ts` - Claude proposer implementation
- `src/app/api/proposer-enhanced/route.ts` - Enhanced API endpoint

**Current Status:** ✅ Complete - Operational with complexity routing, Hard Stops, budget gates, and 3-cycle self-refinement

---

### ORCHESTRATOR (Phase 2.3/3.2 - NOT agent, Aider infrastructure)

**Purpose:** Aider-based execution infrastructure that applies Proposer code to repository

**NOT AN AGENT** - This is infrastructure/tooling built on Aider CLI

**Components:**
1. GitHub Actions workflows (CI/CD orchestration)
2. Aider CLI (git-aware code application engine)
3. PR management scripts (metadata, auto-merge logic)
4. Container infrastructure (ephemeral execution environments)

**Responsibilities:**
- Receive generated code from Proposers
- Spin up ephemeral Aider instances in containers:
  - Isolated git environment per Work Order
  - Clean state (no cross-contamination)
  - Resource limits (CPU, memory, timeout)
- Apply code via Aider CLI:
  - Aider receives Proposer's code/instructions
  - Makes git-aware edits to repository files
  - Validates changes can be applied cleanly
  - Reports conflicts or issues
- Live environment feedback via Aider:
  - Check current file structure (what actually exists)
  - Verify imports resolve (dependencies available)
  - Test if code compiles (TypeScript/language checks)
  - Query actual state vs Proposer assumptions
  - Feed discrepancies back to Proposer for refinement
- Branch management:
  - Create feature branches: `feature/wo-[id]-[description]`
  - Apply commits with descriptive messages
  - Push to remote repository
- Pull Request creation with enhanced metadata:
  - Risk level (from Director)
  - Proposer used (model name)
  - Complexity score (0.0-1.0)
  - Work Order ID (traceability)
  - Cost tracking (dollars spent)
  - Hard Stop flag (if applicable)
- Trigger GitHub Actions workflows:
  - Unit tests
  - Integration tests
  - Build validation
  - Linting/formatting checks
- Auto-merge logic for low-risk PRs:
  - Wait for Sentinel approval (all checks pass)
  - Verify risk_level = "low"
  - Check pattern confidence >0.95
  - Execute merge if conditions met
- Rollback capability:
  - Revert bundled changes on failure
  - Clean rollback without conflicts
  - Notify affected agents
- Collect and report execution results:
  - Success/failure status
  - Test results
  - Build logs
  - Performance metrics
- Teardown ephemeral environments after completion

**Aider-Specific Capabilities:**
- Git-aware editing: Understands repo structure, makes targeted changes
- Live state queries: Can check what files exist, what imports are available
- Conflict detection: Identifies merge conflicts before they reach GitHub
- Atomic operations: Changes applied as coherent units
- Rollback support: Clean undo of changes if needed

**Key Outputs:**
- Feature branches (tracked in github_events)
- Pull requests with metadata (work_orders.github_pr_url)
- GitHub Actions triggers
- Deployment logs
- Test results for Sentinel
- Live environment reports (current state vs assumptions)
- Rollback operations when needed

**Does NOT:**
- Make approval decisions (Director's job)
- Generate code (Proposer's job)
- Evaluate quality (Sentinel's job - though Sentinel analyzes Orchestrator outputs)
- Route Work Orders (Manager's job)
- Handle escalations (Client Manager's job)

**Database Tables:**
- Reads: work_orders
- Writes: github_events, updates work_orders (github_pr_number, github_pr_url, github_branch)
- Writes: outcome_vectors (execution metrics)

**Integration Points:**
- Receives code from Proposers
- Spins up Aider CLI in containers
- Aider provides live feedback to Proposers (for refinement)
- Triggers GitHub Actions
- Reports results to Sentinel (via Actions outcomes)
- Notifies Client Manager on failures

**Phase Consolidation:** Combines Phase 2.3 (Basic Orchestrator) and Phase 3.2 (Aider Integration) into single unified execution infrastructure

**Prerequisites:** ✅ Complete - Database migration finished, all Architect columns available

**Implementation Plan:** See `docs/Technical Specification - Orchestrator.txt` for detailed 4-phase implementation guide (estimated 5-7 hours)

**Current Status:** Ready to implement - All prerequisites met, technical specification complete

---

### SENTINEL (Phase 3.1 - Planned)

**Purpose:** Adaptive quality gates with false-positive learning

**Responsibilities:**
- Parse GitHub Actions results from Orchestrator executions
- Interpret test outcomes (not just pass/fail binary):
  - Pass: All tests passed
  - Fail: Real failures requiring attention
  - Flaky: Known intermittent failures (false positives)
- Adaptive thresholds based on historical baselines:
  - Calculate ±5% variance from outcome_vectors
  - Adjust pass thresholds per test suite
  - Account for environmental fluctuations
- False-positive pattern learning:
  - Track tests with high flake rates (>10%)
  - Identify environmental issues (timeouts, race conditions)
  - Build ignore patterns for known false positives
  - Store patterns in pattern_confidence_scores
- Custom rule synthesis (project-specific quality rules):
  - Learn from repeated failure patterns
  - Generate custom validation rules
  - Store in playbook_memory for reuse
- Severity drift detection:
  - Monitor quality trends over time
  - Alert when quality degrades >10% from baseline
  - Trigger preventive escalations
- Concurrent validation streams:
  - Handle multiple PRs in parallel
  - Isolate results per Work Order
  - Prevent cross-contamination
- Hard fail detection → trigger Client Manager escalation:
  - Repeated failures after retries
  - Critical test failures
  - Security/compliance violations
- Learn from human override decisions:
  - Track when humans merge despite warnings
  - Adjust thresholds based on overrides
  - Reduce false-positive rate over time

**Key Outputs:**
- Pass/fail decisions per Work Order
- Quality metrics (test coverage, performance, security)
- False-positive patterns (stored for future reference)
- Escalation triggers to Client Manager
- Custom validation rules
- Quality trend reports

**Does NOT:**
- Generate code (Proposer's job)
- Create escalation options (Client Manager's job)
- Apply fixes (Orchestrator's job)
- Make approval decisions (Director's job)
- Route Work Orders (Manager's job)

**Database Tables:**
- Reads: github_events (Actions results), outcome_vectors (historical baselines)
- Writes: outcome_vectors (new execution results)
- Writes: pattern_confidence_scores (false-positive patterns)
- Writes: playbook_memory (custom rules)
- Triggers: escalations (on hard fails)

**Integration Points:**
- Receives GitHub Actions results via Orchestrator
- Analyzes test outcomes
- Notifies Orchestrator: approve auto-merge or block
- Escalates to Client Manager on hard failures
- Feeds learning patterns to playbook_memory

---

### CLIENT MANAGER (Phase 2.5 - Planned)

**Purpose:** Human interface for exception handling and escalations

**Responsibilities:**
- Monitor all agent execution states across the system:
  - Watch work_orders table for stuck/failed states
  - Track escalations table for new entries
  - Monitor cost_tracking for budget anomalies
  - Observe pattern_confidence_scores for quality degradation
- Detect unresolvable issues:
  - Proposer exhausts retries after self-refinement (2+ attempts failed)
  - Sentinel hard failures (repeated test failures, >3 cycles)
  - Budget overruns beyond delegated authority (approaching emergency_kill)
  - Conflicting requirements discovered mid-execution
  - Unforeseen technical blockers (dependencies unavailable, API changes)
  - Contract violations that can't be auto-resolved
  - Aider reports irreconcilable state (file conflicts, broken repo)
- Formulate resolution options (typically 2-4 alternatives):
  - Option A: Retry with different approach (different model, different strategy)
  - Option B: Pivot technical solution (alternative architecture)
  - Option C: Amend earlier Work Orders (fix root cause upstream)
  - Option D: Abort and redesign (escalate to Architect for re-decomposition)
- Cost/risk/timeline analysis per option:
  - Estimated additional cost
  - Success probability based on historical data
  - Time to resolution
  - Risk of compounding issues
- Generate recommendation with clear reasoning:
  - Preferred option with justification
  - Trade-offs of each alternative
  - Confidence level in recommendation
- Present to human via Mission Control with full context:
  - Failure history (all attempts + results)
  - Cost spent so far
  - Architect's original decomposition (for context)
  - Relevant logs and metrics
  - Visual timeline of escalation
- Execute human's decision:
  - Amend Work Orders (update work_orders table)
  - Reallocate resources (change proposer_configs)
  - Trigger rollbacks (via Orchestrator)
  - Abort operations (mark work_orders as failed)
  - Request Architect re-decomposition
- Learn from human decisions:
  - Store resolution patterns in escalation_scripts
  - Track which options humans prefer
  - Improve future recommendations
  - Identify automation opportunities (repeated manual interventions)
- Track intervention patterns:
  - What categories of issues escalate most?
  - Which agents trigger escalations?
  - What resolution patterns succeed?
  - Where can automation reduce escalations?

**Key Outputs:**
- Escalation summaries with full context
- Option analysis (2-4 alternatives with cost/risk/time)
- Recommendations with reasoning and confidence level
- Decision execution confirmations
- Learning patterns for future escalations
- Intervention trend reports

**Does NOT:**
- Make final decisions on escalated issues (human's job - Client Manager only recommends)
- Generate code (Proposer's job)
- Decompose specs (Architect's job)
- Approve Work Orders (Director's job)
- Execute deployments (Orchestrator infrastructure)
- Evaluate test results (Sentinel's job)

**Database Tables:**
- Reads: All tables (needs full system visibility)
- Writes: escalations (creates escalation records)
- Writes: escalation_scripts (stores learned resolution patterns)
- Updates: work_orders.status when executing human decisions
- References: decision_logs, outcome_vectors, cost_tracking for context

**User Interface:**
- Mission Control escalation queue
- Real-time alerts for critical issues
- Option presentation with visual decision tree
- One-click decision execution
- Escalation history view

---

## TypeScript Interfaces

### Architect (Phase 2.1)

```typescript
export interface TechnicalSpec {
  feature_name: string;
  objectives: string[];
  constraints: string[];
  acceptance_criteria: string[];
  budget_estimate?: number;    // dollars
  time_estimate?: string;      // e.g., "3 days"
}

export interface WorkOrder {
  title: string;
  description: string;
  acceptance_criteria: string[];
  files_in_scope: string[];
  context_budget_estimate: number;  // tokens
  risk_level: "low" | "medium" | "high";
  dependencies: string[];           // WO indices (e.g., ["0", "1"])
}

export interface DecompositionOutput {
  work_orders: WorkOrder[];         // 3-8 work orders
  decomposition_doc: string;        // markdown explanation
  total_estimated_cost: number;     // dollars
}
```

### Self-Refinement (Phase 2.2.6)

```typescript
export interface TypeScriptError {
  file: string;
  line: number;
  column: number;
  code: string;          // e.g., "TS2304"
  message: string;
  fullText: string;
}

export interface EnhancedProposerResponse {
  // ... existing fields ...
  refinement_metadata?: {
    refinement_count: number;
    initial_errors: number;
    final_errors: number;
    refinement_success: boolean;
    error_details: TypeScriptError[];
  };
}
```

### Orchestrator (Phase 2.3 - Contract)

```typescript
export interface ProposerOutputV1 {
  workOrderId: string;
  branchName: string;
  commitMessage: string;
  edits: Array<{
    path: string;
    mode: "add"|"modify"|"delete";
    content?: string;
    patch?: string;
  }>;
  acceptanceChecks: string[];
  metadata: {
    model: "claude-sonnet-4-5"|"gpt-4o-mini";
    complexity: number;
    refinementCount: number;
    handoffVersion: "v1";
  };
}
```

---

## Architectural Lock-ins

**DO NOT change these without explicit discussion:**

- **Agent hierarchy order:** Architect→Director→Manager→Proposers→Orchestrator→Sentinel→Client Manager
- **Orchestrator = tooling, not agent:** GitHub Actions + Aider CLI + PR automation
- **Director vs Manager distinction:** Director = governance (approve/reject/risk), Manager = coordination (route/retry/budget)
- **Architect model:** Claude Sonnet 4.5 (low frequency, high stakes = cost acceptable)
- **Proposer models:** Claude Sonnet 4.5 (complex, 1.0 threshold) + GPT-4o-mini (simple, 0.3 threshold)
- **Self-refinement gates:** TS check (v24) → contracts (Wk4 D4) → smoke tests (post-Orchestrator)
- **Architect constraints:** 3-8 WOs, <4000 tokens/WO, sequential dependencies (temporarily relaxed)
- **Architect input:** Structured markdown (objectives/constraints/criteria), human-provided
- **Hard Stops:** Force claude-sonnet-4-5 when security_context=high OR keywords detected
- **Budget gates:** Daily spend calculated per-request via Supabase (not cached)
- **Type safety:** Regen Supabase types each session from live schema (project: qclxdnbvoruvqnhsshjr)
- **JSON handling:** Always strip markdown (```json) before parsing Claude responses
- **Dependency validation:** Warn but don't block on complex patterns (temporary)
- **Progressive autonomy:** Auto-approve confidence >0.95

---

## Key Architectural Principles

1. **Specialist Job Descriptions:** Each agent has clear, non-overlapping responsibilities
2. **Context Isolation:** Agents maintain only necessary context to prevent memory overflow
3. **Ephemeral Execution:** Aider instances spun up/torn down per Work Order (no persistent state)
4. **Progressive Autonomy:** Director auto-approves trusted patterns (confidence >0.95), escalates edge cases
5. **Learning Loops:** All agents feed patterns to shared memory (playbook_memory, pattern_confidence_scores)
6. **Budget Enforcement:** 3-tier system ($20 soft/$50 hard/$100 emergency) with graceful degradation
7. **Hard Stop Override:** Security/architecture keywords force best model even over budget
8. **Human-in-the-Loop:** Client Manager provides clear options + recommendations, never makes final decisions
9. **Live Feedback:** Aider eliminates stale assumptions by querying actual environment state
10. **Adaptive Quality:** Sentinel learns false positives and adjusts thresholds over time

---

## File Structure

```
src/
  lib/
    architect-decomposition-rules.ts  (✅ 7535 lines - centralized decomposition logic)
    architect-service.ts              (✅ 2511 lines - orchestration layer)
    director-risk-assessment.ts       (✅ centralized risk assessment logic)
    director-service.ts               (✅ 216 lines - approval orchestration)
    manager-routing-rules.ts          (✅ 371 lines - centralized routing logic)
    manager-service.ts                (✅ 202 lines - coordination orchestration)
    proposer-refinement-rules.ts      (✅ centralized 3-cycle refinement logic)
    enhanced-proposer-service.ts      (✅ 467 lines - code generation orchestration)
    complexity-analyzer.ts            (✅ 7-factor analysis + parseTypeScriptErrors)
    llm-service.ts                    (LEGACY - 615 lines, used by /api/llm/*)
    contract-validator.ts             (existing, 1 pre-existing TS error)
    config-services.ts                (existing, budget management)
  app/api/
    architect/decompose/route.ts      (✅ decomposition endpoint)
    director/approve/route.ts         (✅ approval endpoint)
    manager/route.ts                  (✅ routing + retry endpoints)
    proposer-enhanced/route.ts        (✅ enhanced generation with refinement)
    llm/                              (LEGACY endpoints)
  types/
    architect.ts                      (✅ 737 lines - TechnicalSpec, WorkOrder, DecompositionOutput)
    supabase.ts                       (✅ updated with 5 Architect columns)
  components/
    MissionControlDashboard.tsx       (✅ includes Upload Spec tab)
.temp-refinement/                     (runtime, self-refinement temp files)
```

---

## Infrastructure

**Environment:**
- Next.js @ localhost:3000
- Supabase project: qclxdnbvoruvqnhsshjr
- GitHub: AI-DevHouse/Moose
- Tunnel: https://moose-dev-webhook.loca.lt (optional for webhooks)

**Database:**
- Primary: PostgreSQL via Supabase
- Tables: work_orders, system_config, cost_tracking, pattern_confidence_scores, outcome_vectors, escalations, contracts, decision_logs, proposer_configs, playbook_memory, github_events

**Authentication:**
- Supabase Auth (email/password)
- Client: `createSupabaseClient()` (anon key)
- Server: `createSupabaseServiceClient()` (service role key)
- See `src/lib/supabase.ts`, `src/components/AuthButton.tsx`

**Models:**
- ALL agents now use claude-sonnet-4-5-20250929
- Proposer routing: Sonnet 4.5 (≥1.0 complexity), GPT-4o-mini (<0.3 complexity)

---

## Development Principles

**FOUND.PRINCIPLE:** Don't build infrastructure before validating concepts. Test with minimal implementation first.

**Evidence over recall (R4):** Always verify with commands (tsc/tests/diagnostics), never rely on memory.

**One step only (R1):** Execute one action, then stop for verification.

**100% validation (R7):** Complete current phase 100% before starting next.

---

**See [session-state.md](session-state.md) for current status and next steps.**