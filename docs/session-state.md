# Session State v44 (2025-10-04)

**Last Updated:** 2025-10-04 10:00:00 UTC

**Start here each session.** Reference other docs as needed.

---

## ⚠️ CRITICAL: Session Handover Protocol

**🚨 ABSOLUTE TOP PRIORITY - MUST DO BEFORE CONTEXT RUNS OUT 🚨**

**When to Update:** At **90,000 tokens used** (45% of 200,000 token budget), pause at the next logical task completion point.

**What Happens if Skipped:** Catastrophic loss of session progress - next session will not know what was accomplished, leading to duplicate work, confusion, and wasted time.

**Update Checklist (REQUIRED):**
1. ✅ Update "Last Session Summary" section with completed work
2. ✅ Update "Current Status" with new completions
3. ✅ Update "Next Immediate Task" with what's pending
4. ✅ Add new verification questions if new concepts introduced
5. ✅ Update "Quick Reference" with new files/commands
6. ✅ Sync architecture-decisions.md, known-issues.md if status changed
7. ✅ Create git commit with session summary

**Example Session Summary Template:**
```markdown
## Last Session Summary (vN→vN+1)

**Completed:**
- ✅ [Major accomplishment 1]
- ✅ [Major accomplishment 2]
- ✅ [Files created/modified with line counts]

**Key Learnings:**
- [Important discovery or pattern]
- [Error encountered and how fixed]

**Details:**
- **[Component]:** [Specific changes]
```

**DO NOT PROCEED with new major work if context is at 80%+ without updating handover docs first.**

---

## Last Session Summary (v44→v45)

**🚀 PRODUCTION DEPLOYMENT IN PROGRESS**

**Completed:**
- ✅ **Supabase Production Project Created**
  - Project ID: veofqiywppjsjqfqztft
  - URL: https://veofqiywppjsjqfqztft.supabase.co
  - Database schema deployed (13 tables)
  - Budget reservation function deployed
  - Initial config seeded (2 proposers, 6 system settings)
- ✅ **Phase 4.1 Features Deployed** (from v43→v44)
  - Dependency sequencing (235 lines)
  - Capacity management (207 lines)
  - FLAKY detection (299 lines)

**Next Steps (CRITICAL - Resume Here):**
1. **Deploy to Vercel** (30 min)
   - Go to: https://vercel.com/dashboard
   - Import GitHub repo: AI-DevHouse/Moose
   - Configure environment variables (see below)
2. **Run smoke tests** (10 min)
3. **Start using system** (collect data)

**Production Environment Variables for Vercel:**
```
NEXT_PUBLIC_SUPABASE_URL=https://veofqiywppjsjqfqztft.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[get from Supabase project settings]
SUPABASE_SERVICE_ROLE_KEY=[get from Supabase project settings]
ANTHROPIC_API_KEY=[copy from .env.local]
OPENAI_API_KEY=[copy from .env.local]
GITHUB_TOKEN=[copy from .env.local]
GITHUB_WEBHOOK_SECRET=[copy from .env.local or generate new]
NODE_ENV=production
```
**Get Supabase keys:** https://supabase.com/dashboard/project/veofqiywppjsjqfqztft/settings/api

**Development vs Production:**
- Local dev: Uses .env.local (unchanged, keep using current Supabase project)
- Production: Uses Vercel env vars (new Supabase project above)

**Test Results:**
- TypeScript: 0 errors ✅
- All tests: 49/49 passing ✅
- Git commits: 3247dbe (features), 8f32f05 (session v44)

## Previous Session Summary (v43→v44)

**✅ PHASE 4.1 REFINEMENT COMPLETE: Dependency Sequencing, Capacity Management, FLAKY Detection**

**Completed:**
- ✅ **Feature 1:** Dependency-based Sequencing (235 lines)
- ✅ **Feature 2:** Per-Model Capacity Management (207 lines)
- ✅ **Feature 3:** FLAKY Test Detection Infrastructure (299 lines)
- ✅ **Total:** 778 new lines of production code, 0 breaking changes

**Feature 1: Dependency-based Sequencing:**
- Created dependency-resolver.ts (235 lines)
  - Topological sort using Kahn's algorithm
  - Validates circular dependencies
  - Filters executable work orders (only those with dependencies satisfied)
  - Visualizes dependency graph in logs
- Updated work-order-poller.ts (+19 lines)
  - Queries completed work orders from database
  - Only returns WOs where all dependencies are completed
  - Increased poll limit to 50 to handle dependency chains
- Impact: Prevents executing WO-2 before WO-0 completes (correctness critical)

**Feature 2: Per-Model Capacity Management:**
- Created capacity-manager.ts (207 lines)
  - Claude Sonnet 4.5: max 2 concurrent executions
  - GPT-4o-mini: max 4 concurrent executions
  - Reserve/release capacity tracking per model
  - Wait for capacity with 60s timeout
- Updated orchestrator-service.ts (+18 lines)
  - Integrated capacity manager into execution pipeline
  - Waits for model capacity before starting execution
  - Releases capacity in finally block (guaranteed cleanup)
- Impact: Prevents rate limit 429 errors, better resource utilization

**Feature 3: FLAKY Test Detection Infrastructure:**
- Created flaky-detector.ts (299 lines)
  - Classifies tests: STABLE_PASS (>90%), FLAKY (10-90%), STABLE_FAIL (<10%)
  - Tracks test pass/fail history (queries outcome_vectors)
  - Auto-ignores FLAKY tests with >10% flake rate over 20+ runs
  - Filters out flaky test failures from decision making
- Status: Infrastructure-only (database writes deferred to post-deployment)
- Impact: Reduces false positive escalations when calibrated with real data

**Test Results:**
- TypeScript: 0 errors ✅
- All tests: 49/49 passing (100%) ✅
- Git commit: 3247dbe ✅

**Files Created:**
- src/lib/orchestrator/dependency-resolver.ts (235 lines)
- src/lib/orchestrator/capacity-manager.ts (207 lines)
- src/lib/sentinel/flaky-detector.ts (299 lines)

**Files Modified:**
- src/lib/orchestrator/work-order-poller.ts (+19 lines)
- src/lib/orchestrator/orchestrator-service.ts (+18 lines)

## Previous Session Summary (v42→v43)

**✅ PRIORITY 5.4 COMPLETE: Ops Documentation**

**Completed:**
- ✅ **Deployment Procedures** - Comprehensive deployment guide (500+ lines)
- ✅ **Operational Runbook** - Daily ops, monitoring, troubleshooting (700+ lines)
- ✅ **Priority 5 COMPLETE** - All 4 tasks finished (Performance, Backup, Security, Ops Docs)

**Deployment Procedures:**
- Initial setup guide (Supabase project, Vercel deployment, environment config)
- Database migration steps (all tables, functions, indexes)
- GitHub configuration (webhooks, Actions, Orchestrator prerequisites)
- Production readiness checklist (15 items)
- Rollback procedures (application 2-5min, database 10-30min, config 5min)
- Troubleshooting common deployment issues (6 scenarios)
- Files: docs/deployment-procedures.md (500+ lines)

**Operational Runbook:**
- Daily operations (health checks, escalation review, budget monitoring)
- Monitoring and alerting setup (health endpoint, Slack/email alerts)
- Escalation response procedures (5 types with SLAs: 30min-4 hours)
- Troubleshooting procedures (6 common scenarios with SQL queries)
- Emergency response (4 scenarios: budget overrun, DB loss, outage, security)
- Routine maintenance (weekly 30min, monthly 2hr, quarterly 1 day)
- Contacts and escalation matrix (4-level escalation path)
- Files: docs/operational-runbook.md (700+ lines)

**Key Learnings:**
- Architect cost calculation was wrong ($11.30 → $0.05/call): Used wrong pricing
- Correct pricing: Claude Sonnet 4.5 = $3/1M input, $15/1M output tokens
- 4 RPM rate limit is correct for 30k TPM protection, not cost
- Expected Architect spend: $1.50-$3/month (not $226-$452!)

**Test Results:**
- TypeScript: 0 errors ✅
- All tests: 49/49 passing (100%) ✅
- Git commit: 0810bfc ✅

## Previous Session Summary (v41→v42)

**✅ PRIORITY 5 COMPLETE: Integration & Hardening (Tasks 1-3)**

**Completed:**
- ✅ **Task 5.1: Performance Profiling** - Artillery setup, all endpoints <200ms (P95: 130ms)
- ✅ **Task 5.2: Backup Procedures** - Config export/restore scripts, procedures documented
- ✅ **Task 5.3: Security Hardening** - Rate limiting, input sanitization, security audit

**Performance Profiling (5.1):**
- Artillery 2.0.26 installed, 1,200+ requests tested
- P95: 130ms ✅ (target <200ms), P99: 233ms ✅ (target <500ms)
- Database indexes created (5 indexes for slow queries)
- Caching added (`src/lib/cache.ts`, `/api/proposers` cached 60s)
- Files: artillery-performance.yml, scripts/create-performance-indexes.sql, docs/performance-baseline.md

**Backup Procedures (5.2):**
- Export script: `npm run backup:config` (exports system_config, proposer_configs, contracts)
- Restore script: `npm run restore:config --input <file> [--dry-run]`
- 4 rollback scenarios documented (5-60 min RTO)
- Files: scripts/export-config.ts (157 lines), scripts/restore-config.ts (199 lines), docs/backup-procedures.md (500+ lines)

**Security Hardening (5.3):**
- Rate limiter: `src/lib/rate-limiter.ts` (230 lines) - Single-user, LLM quota protection
- Input sanitizer: `src/lib/input-sanitizer.ts` (360 lines) - SQL injection, XSS, path traversal
- Rate limits adjusted for single-user: Architect 4 req/min (TPM-limited), Internal 1000 req/min
- Security audit: 5 vulnerabilities found in Client Manager API, all fixed
- Files: docs/security-procedures.md (600+ lines), docs/security-audit-client-manager.md (400+ lines)

**Key Changes:**
- Rate limits now match LLM API quotas (Claude: 4 RPM for 30k TPM, OpenAI: 500 RPM)
- `/api/architect/decompose` secured: rate limited (4/min) + input validated + security check
- `/api/client-manager/escalate` secured: rate limited (1000/min) + UUID validated + audit logged

**Test Results:**
- TypeScript: 0 errors ✅
- All tests: 49/49 passing (100%) ✅
- Performance: P95 130ms, P99 233ms ✅
- Backup/restore: Tested successfully ✅

## Previous Session Summary (v40→v41)

**🎉 MAJOR MILESTONE: First Successful Orchestrator E2E Test + Branch Cleanup Complete**

**Completed:**
- ✅ **GitHub Branch Cleanup** - PR #2 created with 27,675 lines, secrets removed from history
- ✅ **Pre-commit Hook Installed** - Blocks secrets (.env.local, API keys) from being committed
- ✅ **Bug #3: Work Order GET Endpoint Fixed** - Added missing GET handler
- ✅ **Bug #4: Orchestrator Processing Fixed** - Fixed field name mismatch
- ✅ **Bug #5: createWorkOrder Fields Fixed** - Extended API to accept all Architect fields
- ✅ **E2E Test COMPLETE** - Full pipeline validated end-to-end

**Key Achievement:** Clean branch pushed to GitHub, 1,418 lines of orchestrator code validated

## Session Summary (v39→v40)

**Completed:**
- ✅ **Priority 1: All Tests Fixed** (1 day → 15 min) - 49/49 tests passing (100%)
- ✅ **Priority 2: Contract Validation Integrated** (0.5 days → 10 min) - Week 4 D4-5 deliverable complete
- ✅ **Priority 3: E2E Infrastructure Created** - Test scripts + environment verified
- ✅ **Priority 3: Integration Bugs Discovered** - 4 bugs found in first E2E run (2 critical)

**Key Accomplishments:**
- **Test fixes:** 4 github-integration formatting + 1 manager-coordinator complexity calculation
- **Contract validation:** Integrated into enhanced-proposer-service.ts after refinement cycle
- **E2E tests:** Created test-orchestrator-e2e-full.ps1 + test-orchestrator-e2e-simple.js
- **Environment:** Verified Aider CLI 0.86.1, GitHub CLI 2.81.0, Python 3.11.9 all working

**Bugs Discovered (First E2E Run):**
1. ❌ **CRITICAL:** Work order GET endpoint failing (api/work-orders/[id]/route.ts)
2. ❌ **CRITICAL:** Orchestrator not processing work orders (stuck in "pending" status)
3. ⚠️ **MODERATE:** Orchestrator status endpoint returns undefined
4. ✅ **WORKAROUND:** Director API expects decomposition payload, not work_order_id

**Details:**
- **Priority 1:** Fixed markdown formatting in tests ("Risk Level: medium" → "**Risk Level:** medium")
- **Priority 2:** Added ContractValidator import, validation after refinement, contract_validation field in response
- **Priority 3:** Created 2 E2E test scripts, ran first execution, documented bugs in orchestrator-e2e-findings.md
- **Test execution:** Work order created → approved → orchestrator started → **STUCK** (no processing)

**Files Modified (v40):**
- src/lib/orchestrator/__tests__/github-integration.test.ts (4 test fixes)
- src/lib/orchestrator/__tests__/manager-coordinator.test.ts (1 test fix)
- src/lib/enhanced-proposer-service.ts (contract validation lines 13, 77, 242-283, 326)

**Files Created (v40):**
- test-orchestrator-e2e-full.ps1 (PowerShell 7-step E2E test)
- test-orchestrator-e2e-simple.js (Node.js 6-step automated test)
- docs/orchestrator-e2e-findings.md (Complete bug analysis + next steps)

**Next Session Priority:**
**Fix Critical E2E Bugs** - Priority order: Bug #3 (GET endpoint) → Bug #4 (orchestrator processing) → Re-run E2E → Fix remaining bugs

---

## Current Status

### **Overall Completion: 68%** (Verified 2025-10-03 17:30 UTC)

### ✅ **Phase 2: Core Engine - 80% Complete**
- ✅ **2.4.6 Self-Refinement:** 100% complete (3-cycle, exceeds plan)
- ✅ **2.1 Architect:** 100% complete (8/8 deliverables)
- ✅ **Week 4 D4-5 Integration:** 87.5% complete (3.5/4 deliverables) - Contract validation IN refinement loop ✅
- ✅ **2.2 Director Refactor:** 100% complete (5/5 deliverables)
- ✅ **2.3 Orchestrator:** 100% complete (8/8 deliverables) - E2E tested ✅, all tests passing ✅

### ⚠️ **Phase 3: Quality & Learning - 40% Complete**
- ✅ **2.5 Client Manager:** 100% complete (7/7 deliverables)
- ⚠️ **3.1 Sentinel:** 38% complete (3/8 deliverables) - MVP binary pass/fail only
- ❌ **3.3 Learning:** 0% complete (0/6 deliverables) - Not started

### ⚠️ **Phase 4: Manager Enhancement - 50% Complete**
- ⚠️ **4.1 Manager Upgrade:** 50% complete (3/6 deliverables) - Core routing works
- ⚠️ **4.2 Integration:** 17% complete (1/6 deliverables) - Only observability complete

### ❌ **Phase 5: Learning Period - 0% Complete**
- ❌ **5.1 Test App:** 0% complete (0/4 deliverables)
- ❌ **5.2 Training:** 0% complete (0/5 deliverables)

### ✅ **v38 Error Handling & Resilience - 100% Complete**
- ✅ **Phase 1:** Error Escalation (error-escalation.ts used in 8 files)
- ✅ **Phase 2:** Budget Race Fix (PostgreSQL locking function active)
- ✅ **Phase 3:** Failure Mode Tests (10/10 passing)
- ✅ **Phase 4:** Monitoring Dashboard (Health Monitor tab operational)

---

## Next Immediate Task

### 🎯 DEPLOY TO VERCEL (Resume deployment - 30 min remaining)

**CURRENT STATUS: Database ready ✅, Vercel deployment pending**

**Step-by-step Vercel Deployment:**

1. **Go to Vercel Dashboard:**
   - URL: https://vercel.com/dashboard
   - Login with GitHub

2. **Import Repository:**
   - Click "Add New" → "Project"
   - Import: AI-DevHouse/Moose
   - Framework: Next.js (auto-detected)
   - Root Directory: ./
   - Build Command: npm run build
   - Output Directory: .next

3. **Configure Environment Variables:**
   - Click "Environment Variables"
   - Add all variables from "Production Environment Variables" section above
   - Mark as "Secret": SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, GITHUB_TOKEN
   - Scope: Production only

4. **Deploy:**
   - Click "Deploy"
   - Wait 3-5 minutes for build
   - Copy deployment URL

5. **Verify:**
   - Visit: https://[your-app].vercel.app/api/admin/health
   - Expected: {"status":"healthy"}
   - Test: Upload a spec via Mission Control UI

**After Deployment:**
- Run smoke tests (see docs/deployment-procedures.md Section 6)
- Start using system for real work (collect data)
- Monitor daily via Health dashboard

**Reference:** docs/deployment-procedures.md (complete guide)

---

## Session Start Checklist

**CRITICAL: Run this checklist at the start of EVERY session**

1. ✅ Check if dev server is running (should be `npm run dev`)
2. ✅ Regenerate Supabase types: `npx supabase gen types typescript --project-id qclxdnbvoruvqnhsshjr > src/types/supabase.ts`
3. ✅ Verify TypeScript: `npx tsc --noEmit` (expect 0 errors)
4. ✅ Review git status
5. ✅ Answer verification questions Q1-Q39 below (spot check, not all required)

---

## Reading Pack for New Session

**MUST READ (in order):**
1. **THIS FILE** - `docs/session-state.md` - Start here
2. **Project Plan v3** - `docs/Project Plan (3) - Verified Status.txt` - Complete verified status + critical path
3. **Known Issues** - `docs/known-issues.md` - Active problems
4. **Rules** - `docs/rules-and-procedures.md` - Development rules (R10: Verify before assuming)
5. **Architecture** - `docs/architecture-decisions.md` - System design

**OPTIONAL (as needed):**
- `docs/error-handling-resilience-plan.md` - v38 implementation details
- `docs/api-reference.md` - API documentation

---

## Quick Reference

### Key Commands
```bash
# Dev server (should already be running)
npm run dev

# TypeScript check (expect 0 errors)
npx tsc --noEmit

# Run all tests
npx vitest run

# Run failure mode tests only
npx vitest run src/lib/__tests__/failure-modes.test.ts

# Regenerate Supabase types
npx supabase gen types typescript --project-id qclxdnbvoruvqnhsshjr > src/types/supabase.ts

# Git status
git status
```

### Key Files (Updated v43)
```
Core Architecture:
- src/lib/architect-decomposition-rules.ts (7,535 lines) - Spec→WO decomposition
- src/lib/director-risk-assessment.ts - Governance & approval
- src/lib/rate-limiter.ts (230 lines) - Single-user LLM quota protection
- src/lib/input-sanitizer.ts (360 lines) - SQL/XSS/path traversal prevention
- src/lib/cache.ts (107 lines) - In-memory cache with TTL
- src/lib/manager-routing-rules.ts (371 lines) - Routing logic
- src/lib/proposer-refinement-rules.ts (375 lines) - 3-cycle self-refinement + contract validation
- src/lib/enhanced-proposer-service.ts (609 lines) - Code generation orchestration + contract callback
- src/lib/client-manager-escalation-rules.ts (361 lines) - 7 trigger types, 5 strategies
- src/lib/error-escalation.ts (50 lines) - Centralized error handler
- src/lib/contract-validator.ts (435 lines) - Contract validation with breaking change detection

Orchestrator (1,418 lines total):
- src/lib/orchestrator/orchestrator-service.ts (310 lines)
- src/lib/orchestrator/work-order-poller.ts (82 lines)
- src/lib/orchestrator/manager-coordinator.ts (91 lines)
- src/lib/orchestrator/proposer-executor.ts (124 lines)
- src/lib/orchestrator/result-tracker.ts (223 lines)
- src/lib/orchestrator/aider-executor.ts (259 lines)
- src/lib/orchestrator/github-integration.ts (257 lines)
- src/lib/orchestrator/types.ts (72 lines)

Tests:
- src/lib/__tests__/failure-modes.test.ts (10 tests, all passing)
- src/lib/orchestrator/__tests__/*.test.ts (5 files, 31 tests, 26 passing)

APIs:
- /api/architect/decompose - Spec→Work Orders
- /api/director/approve - Governance approval
- /api/manager - Routing decisions
- /api/proposer-enhanced - Code generation
- /api/client-manager/escalate - Error escalation
- /api/orchestrator - Work order polling
- /api/sentinel - GitHub webhook
- /api/admin/health - Health monitoring

UI:
- src/components/MissionControlDashboard.tsx - Main dashboard
- src/components/MonitoringDashboard.tsx (260 lines) - Health monitoring

Database:
- scripts/create-budget-reservation-function.sql - Budget race fix
- scripts/create-performance-indexes.sql - 5 indexes for slow queries

Documentation (v43):
- docs/deployment-procedures.md (500+ lines) - Deployment guide
- docs/operational-runbook.md (700+ lines) - Daily ops, monitoring, troubleshooting
- docs/backup-procedures.md (500+ lines) - Backup/restore procedures
- docs/security-procedures.md (600+ lines) - Security hardening
- docs/performance-baseline.md - Performance test results
```

### Test Results (Current)
```
Unit Tests: 49/49 passing (100%) ✅
  - Orchestrator tests: 39/39 passing
  - Failure mode tests: 10/10 passing (3.6s)
Integration Tests: 18/18 passing (PowerShell API smoke tests)
TypeScript: 0 errors
E2E Test: First successful orchestrator E2E complete ✅
```

---

## Verification Questions (Q1-Q39)

**Context Verification (Answer these to prove understanding)**

### Agent Architecture (Q1-Q8)

**Q1:** What is the architectural pattern for agent logic separation? Name THREE agents that follow this pattern and their file pairs.

**Answer:** Centralized logic in separate rules files. Three agents:
1. Architect: `architect-decomposition-rules.ts` (logic) + `architect-service.ts` (orchestration)
2. Director: `director-risk-assessment.ts` (logic) + `director-service.ts` (orchestration)
3. Manager: `manager-routing-rules.ts` (logic) + `manager-service.ts` (orchestration)

**Q2:** What are the THREE refinement cycle strategies in Phase 2.2.6, and when does each trigger?

**Answer:**
1. Cycle 1-2: Same model with failure context added
2. Cycle 2-3: Switch to higher capability model (gpt-4o-mini → claude-sonnet-4-5)
3. Zero-progress abort: If no improvement between cycles (same error count)

**Q3:** What are the TWO validation thresholds for Phase 2.1 Architect Work Order generation?

**Answer:**
- WO count range: 3-8 Work Orders (too few = not decomposed, too many = overwhelming)
- Max token budget per WO: <4000 tokens

**Q4:** What is the current cost per Architect decomposition call, and what % of monthly LLM budget does this represent at 1-2 calls/day?

**Answer:** $11.30 per call. At 1-2 calls/day = $226-$452/month = 75-150% of £300 LLM budget

**Q5:** What are the Director approval thresholds for auto-approval?

**Answer:** All WOs must be low-risk AND total_cost < $50
(Defined in: director-risk-assessment.ts)

**Q6:** What was the refinement success rate in Phase 2.2.6 testing? (Initial errors → Final errors → Improvement %)

**Answer:** Data not specified in docs (verification needed with test results)

**Q7:** What is the dependency validation behavior in v25, and which constraint does it violate?

**Answer:**
- Relaxed validation: Warns but doesn't block on complex dependency patterns
- Why: Simple cycle detection flagged valid diamond patterns (A,B→C) as circular
- Constraint violated: "Sequential dependencies only" (temporarily violated to allow multi-parent convergence)

**Q8:** What is the next phase priority after Phase 2.2, and what is its key architectural principle?

**Answer:** Phase 2.3 Orchestrator (comes before Phase 2.5 Client Manager)
Key principle: Orchestrator = tooling/infrastructure (Aider CLI), NOT an agent

### Database & Migration (Q9-Q12)

**Q9:** What are the FIVE columns added to work_orders table for Architect integration? Were they successfully migrated?

**Answer:**
1. acceptance_criteria (jsonb)
2. files_in_scope (jsonb)
3. context_budget_estimate (integer)
4. decomposition_doc (text)
5. architect_version (text)
Successfully migrated: ✅ YES (verified in supabase.ts lines 469-479)

**Q10:** What was the root cause of the Security Hard Stop test failure on cold start, and what is the planned fix?

**Answer:**
- Root cause: Config loading race condition - API accepts requests before system_config loaded
- Workaround: Run integration tests twice after server restart
- Planned fix: Add initialization barrier + `/api/health/ready` endpoint + test suite waits for readiness

**Q11:** What caused the system_config SQL error during migration, and how was it fixed?

**Answer:** Not explicitly specified in docs (migration scripts created with safeguards)

**Q12:** Why did type generation fail using Supabase CLI, and what is the workaround?

**Answer:**
- Why failed: Not specified in docs
- Workaround: Manual generation command: `npx supabase gen types typescript --project-id qclxdnbvoruvqnhsshjr > src/types/supabase.ts`

### Orchestrator (Q13-Q19)

**Q13:** What are the 5 stages of the Orchestrator execution pipeline, and what is the concurrency limit?

**Answer:**
1. Poll (work-order-poller)
2. Route (manager-coordinator - calls Manager API)
3. Generate (proposer-executor - calls Proposer API)
4. Aider (aider-executor - applies code)
5. PR + Track (github-integration + result-tracker)
Concurrency limit: max 3 concurrent

**Q14:** What are the prerequisites for Orchestrator E2E testing, and name 3 rollback scenarios.

**Answer:**
- Prerequisites: Aider CLI installed, GitHub CLI (gh) installed and authenticated
- 3 rollback scenarios: Not explicitly listed in docs (need to check implementation)

**Q15 (v32):** What are the TWO metadata fields used by Orchestrator work-order-poller for Director approval? Why are there two?

**Answer:**
- Two fields: `director_approved` and `approval_status`
- Why two: Belt-and-suspenders approach for approval tracking

**Q16 (v32):** What is the actual API endpoint structure for Orchestrator control? How does it differ from the original spec?

**Answer:**
- Structure: POST `/api/orchestrator` with `{"action":"start"|"stop","interval_ms":10000}`
- Differs from original spec: Single POST endpoint with action parameter vs separate start/stop endpoints

**Q17 (v33):** What was the critical schema bug in result-tracker.ts? What are the correct columns?

**Answer:**
- Wrong columns: `agent_name` and `operation_type`
- Correct columns: `work_order_id`, `model_used`, `route_reason`, `cost`, `execution_time_ms`, `success`, `diff_size_lines`, `test_duration_ms`, `failure_classes`, `metadata`

**Q18 (v33):** Why was E2E testing deferred, and what is the testing sequence? How many unit tests were planned?

**Answer:**
- Why deferred: Attempted 4 times, each revealed new environment issues - focused on Sentinel + Client Manager instead
- Testing sequence: Unit → Integration → E2E
- Unit tests planned: 5 tests (result-tracker, manager-coordinator, proposer-executor, aider-executor, github-integration)

**Q19 (v33):** What Orchestrator prerequisites are installed, and what Python version is required?

**Answer:**
- Prerequisites: Aider CLI, GitHub CLI
- Python version: Python 3.11 with aider-chat 0.86.1
- Why: Specified compatibility/stability version

### Data Flow & Tables (Q20-Q22)

**Q20:** What is the purpose of the outcome_vectors table, and which pipeline stages write to it?

**Answer:**
- Purpose: LLM model performance tracking for Manager's learning system (NOT generic agent activity)
- Which stages write: Proposer stage only (tracks LLM model usage: "gpt-4o-mini generated code for WO-123, cost $0.001, succeeded")

**Q21:** What is Rule R10 "Verify before assuming"? Name 4 verification requirements and the automation script.

**Answer:**
- 4 verification requirements:
  1. Always regenerate types at session start
  2. Curl endpoints before writing tests (verify field names)
  3. Check supabase.ts before DB queries (no field name assumptions)
  4. Read actual metadata structures from DB (don't assume field names)
- Automation script: `scripts/session-start.ps1`

**Q22:** What was the schema bug in result-tracker.ts (v34)? What are the correct columns, and when should you write outcome_vectors?

**Answer:**
- Wrong columns: `agent_name`, `operation_type`
- Correct columns: `work_order_id`, `model_used`, `route_reason`
- When to write outcome_vectors: Proposer stage only (LLM tracking, not infrastructure)

### Sentinel Agent (Q23-Q25)

**Q23:** What are the 3 main components of Sentinel Agent? What is the MVP scope vs Phase 3.2 enhancements?

**Answer:**
- 3 components:
  1. `test-parser.ts` (PowerShell + Jest test output parsing)
  2. `decision-maker.ts` (Pass/fail decision logic)
  3. `sentinel-service.ts` (Main orchestration with retry logic + Client Manager integration)
- MVP scope: Binary pass/fail, 3-retry logic for race conditions, GitHub webhook integration
- Phase 3.2 enhancements: Flaky detection, auto-merge, advanced quality gates (deferred)

**Q24:** How does Sentinel handle the race condition when webhook arrives before github_pr_number is set?

**Answer:** 3-retry logic for when webhook arrives before github_pr_number is set
Alternative solution: Wait for metadata to be populated before processing webhook

**Q25:** What were the integration test results for v34? Why is E2E timeout NOT considered a failure?

**Answer:**
- Results: 21/22 passing (E2E timeout expected)
- E2E timeout NOT a failure: Because it involves actual LLM calls (long-running)
- Tests added: Tests 19-20 (Orchestrator), Tests 21-22 (Sentinel)

### Client Manager (Q26-Q30)

**Q26:** What are the 7 escalation trigger types for Client Manager? What are the 3 conditions for shouldEscalate()?

**Answer:**
- 7 types: retry_exhausted, budget_warning, budget_critical, test_failures, contract_violation, aider_failure, manual_escalation
- 3 conditions for shouldEscalate():
  1. Retry exhausted (attempts ≥ 3)
  2. Budget critical (>$80 spent)
  3. Test failures (repeated >3 cycles)

**Q27:** What are the 5 resolution strategies for Client Manager? What is the cost-efficiency formula?

**Answer:**
- 5 strategies: retry_different_approach, pivot_solution, amend_work_orders, abort_redesign, increase_budget
- Cost-efficiency formula: `score = (success_probability * 100) / (estimated_cost + risk_factor * 10)`

**Q28:** What are the 5 Orchestrator unit tests?

**Answer:**
1. result-tracker.test.ts: Schema validation for outcome_vectors writes
2. manager-coordinator.test.ts: Complexity estimation logic
3. proposer-executor.test.ts: Task description building
4. aider-executor.test.ts: Instruction file formatting
5. github-integration.test.ts: PR body generation

**Q29:** What is the function that integrates Sentinel + Client Manager? What is the API call, and what is the graceful fallback?

**Answer:**
- Function: `escalateToClientManager()` in sentinel-service.ts
- API call: `POST /api/client-manager/escalate`
- Graceful fallback: Manual status update if API call fails

**Q30:** What are the budget threshold levels for Client Manager?

**Answer:**
- $20 (soft cap): Warning status, continue normally
- $50 (hard cap): Force cheapest model (gpt-4o-mini)
- $100 (emergency kill): Stop all operations, escalate to Client Manager

### Manager Integration (Q31-Q33)

**Q31:** What changed in Manager integration (v36)? How many lines of duplicate routing were removed, and how does Proposer call Manager?

**Answer:**
- Change: Proposer service now calls `POST /api/manager` for routing decisions
- Duplicate routing removed: `proposer-registry.ts` lines 110-245 (135 lines removed)
- How Proposer calls Manager: HTTP fetch to `/api/manager` with work_order_id, complexity_score, context

**Q32:** How does Manager handle ad-hoc routing? Why is this necessary?

**Answer:**
- How: Check if work_order exists before DB update (lines 154-164 in manager-service.ts)
- Why necessary: Support ad-hoc routing requests from Proposer service for testing/non-WO scenarios

**Q33:** What were the 3 Manager integration test results in v36?

**Answer:**
1. Low complexity (0.2): Routed to gpt-4o-mini ✅
2. High complexity (0.9) + OAuth keywords: Hard Stop → claude-sonnet-4-5 ✅
3. SQL injection keyword: Hard Stop detected → claude-sonnet-4-5 ✅

### Client Manager v37 (Q34-Q36)

**Q34:** What schema bug was fixed in client-manager-service.ts (v37)?

**Answer:**
- Queried incorrectly: `cost_tracking.work_order_id` (column doesn't exist)
- Should use instead: `outcome_vectors` table with `work_order_id` filter for cost tracking

**Q35:** What are the 5 main sections of the Escalation Details Modal UI?

**Answer:**
1. Work Order context (ID, title, description)
2. Context Summary (cost spent, attempts, failure pattern)
3. AI Recommendation with confidence visualization
4. Resolution Options with pros/cons (green checkmarks/red X)
5. Decision Notes + Execute button
Recommended option highlight: Blue border + star (⭐)

**Q36:** What are the 2 dashboard API methods added for Client Manager in v37?

**Answer:**
1. `getEscalationResolutions(escalationId)`: Fetch resolution options for an escalation
2. `executeEscalationDecision(escalationId, optionId, decidedBy, notes?)`: Execute human's chosen resolution

### v38 Error Handling (Q37-Q39)

**Q37:** What are the 4 phases of v38 Error Handling & Resilience plan? Which are complete?

**Answer:**
1. Phase 1: Error Escalation (error-escalation.ts + audit fixes) - ✅ COMPLETE
2. Phase 2: Budget Race Condition Fix (PostgreSQL locking function) - ✅ COMPLETE
3. Phase 3: Failure Mode Tests (10 tests) - ✅ COMPLETE
4. Phase 4: Monitoring Dashboard - ✅ COMPLETE
All 4 phases: ✅ VERIFIED COMPLETE

**Q38:** How does the budget race condition fix work? What PostgreSQL feature prevents the race?

**Answer:**
- Function: `check_and_reserve_budget(p_estimated_cost, p_service_name, p_metadata)`
- PostgreSQL feature: `LOCK TABLE cost_tracking IN SHARE ROW EXCLUSIVE MODE`
- How it works: Atomic check-and-reserve prevents concurrent reads during budget calculation
- Called from: `manager-service.ts` line 194

**Q39:** What are the 10 failure mode tests, and what is the pass rate?

**Answer:**
1. outcome_vectors Write Failure
2. Budget Race Condition
3. Concurrent Work Order Metadata Updates
4. Malformed LLM JSON Response
5. Database Connection Failure
6. GitHub Webhook Race Condition
7. Invalid State Transition
8. Orchestrator Aider Command Failure
9. Sentinel Webhook Invalid Auth Token
10. Work Order Stuck >24h Monitoring
Pass rate: 10/10 passing (100%, 3.6s execution time)

---

## Known Issues Reference

**See `docs/known-issues.md` for full details**

**Active Issues:**
1. **Orchestrator E2E never run** - 1,418 lines of code untested with real Aider
2. **5 unit tests failing** - github-integration formatting, manager-coordinator complexity
3. **Contract validation NOT in refinement** - Missing from Week 4 D4-5
4. **Sentinel binary pass/fail only** - No FLAKY classification or adaptive baselines
5. **Learning system 0%** - Phase 3.3 not implemented

**Recently Resolved (v38):**
- ✅ Error escalation enforcement (Phase 1 complete)
- ✅ Budget race condition (Phase 2 complete)
- ✅ Failure mode test coverage (Phase 3 complete)
- ✅ Health monitoring (Phase 4 complete)

---

## Git Reference

**Current Branch:** `feature/wo-b8dbcb2c-orchestrator-e2e-test`

**Recent Commits:**
- `6b89ee6` v38 Final Integration: Health Monitoring + Documentation
- `93012f1` Phase 4: Monitoring & Observability
- `fa67473` Phase 3: Failure Mode Tests - 10 Comprehensive Tests
- `8c865eb` Phase 1 & 2: Error Escalation + Budget Race Fix

**Main Branch:** `main`

---

## Git Best Practices (Lessons Learned)

### Branch Management Rules
1. **One feature = one branch** - Don't mix unrelated changes
2. **Branch from main, merge to main** - Always create from latest main
3. **Keep branches short-lived** - Days, not weeks (avoid drift)
4. **Delete after merge** - No stale branches
5. **Squash large PRs** - 47 commits → 1-3 logical commits for main history

### Naming Conventions
- ✅ `feature/descriptive-name` - Feature work
- ✅ `bugfix/issue-description` - Bug fixes
- ✅ `hotfix/critical-issue` - Production fixes
- ✅ `backup-{description}` - Temporary backups (delete after confirmation)

### Security & Hygiene
- ❌ **NEVER commit secrets** - Use `.gitignore` from day 1
- ✅ **Add `.env.local` to `.gitignore`** - Before first commit
- ✅ **Review diffs before commit** - Check for API keys, passwords, tokens
- ✅ **Use pre-commit hooks** - Automated secret scanning

### Main Branch Protection (Recommended)
- ✅ Require PR reviews (1+ approvers)
- ✅ Require passing CI/tests
- ✅ Prohibit direct pushes to main
- ✅ Prohibit force pushes to main

### Cleanup Schedule
**After PR merge:**
- Delete feature branch (local + remote)
- Delete backup branches (after confirming main stable)

**Weekly:**
- Check for stale branches: `git branch -a`
- Delete merged/abandoned branches

### Current Violations Found
1. ❌ 47 commits in feature branch (should squash to 1-3)
2. ❌ 3 backup branches (should delete after PR merge)
3. ❌ 2 stale branches (old work orders + closed PR)
4. ❌ Secrets committed (required `git filter-branch` to fix)

### Grade: C+ → A- (After Cleanup)
**Before:** Functional but cluttered (4 violations)
**After cleanup:** Clean, organized, secure (0 violations)


---

## Critical Reminders

1. **ALWAYS regenerate types at session start** - Schema may have changed
2. **ALWAYS run `npx tsc --noEmit` before committing** - Must have 0 errors
3. **NEVER assume field names** - Check supabase.ts first (Rule R10)
4. **ALWAYS use handleCriticalError() for critical errors** - Ensures escalation to Client Manager
5. **READ Project Plan v3 before starting work** - Complete verified status + critical path
6. **Orchestrator E2E is highest risk** - Never tested end-to-end, 60% chance of bugs

---

**Last Session Duration:** ~3 hours (verification audit)
**Context Used:** 68,825 / 200,000 tokens (34.4%)
**Next Session Focus:** Critical Path - Fix tests, add contract validation, Orchestrator E2E
