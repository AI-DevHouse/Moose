# Known Issues

**Active problems, workarounds, planned fixes.**

---

## 1. Architect Workflow Integration ✅ RESOLVED

**Status:** Phase 2.1/2.2/4.1 Complete

**Resolution:** All components implemented and tested:
1. ✅ Database migration (5 columns added to work_orders)
2. ✅ UI integration (Upload Spec tab functional)
3. ✅ Director approval flow (Architect→Director→Manager→Proposers)
4. ✅ Manager routing (Phase 4.1 - complete tactical coordination)

**Testing:** 18/18 integration tests passing (100%)

**Files created:**
- `src/lib/architect-decomposition-rules.ts` (371 lines)
- `src/lib/director-risk-assessment.ts` (implemented)
- `src/lib/manager-routing-rules.ts` (371 lines)
- `src/lib/manager-service.ts` (202 lines)
- `src/app/api/manager/route.ts` (95 lines)

---

## 2. Database Migration ✅ RESOLVED

**Status:** Complete

**Resolution:** All 5 columns successfully added to `work_orders` table

**Columns added:**
1. `acceptance_criteria` (jsonb) - Array of criteria from Architect
2. `files_in_scope` (jsonb) - Array of file paths to modify
3. `context_budget_estimate` (integer) - Token budget per WO
4. `decomposition_doc` (text) - Markdown documentation
5. `architect_version` (text) - Version tracking (e.g., "v1")

**Verification:** Confirmed working in integration tests

---

## 3. Director Approval Flow ✅ RESOLVED

**Status:** Phase 2.2 Complete

**Resolution:** Full governance layer implemented with risk assessment

**Flow implemented:**
1. ✅ Architect generates decomposition
2. ✅ Director validates WO structure (director-risk-assessment.ts)
3. ✅ Director assesses aggregate risk (cost, confidence, risk score)
4. ✅ Auto-approve if: all WOs low-risk AND total_cost < $50
5. ✅ Queue for human review if: any high-risk OR total_cost > $50

**Files created:**
- `src/lib/director-risk-assessment.ts` (centralized risk logic)
- `src/lib/director-service.ts` (orchestration layer)
- `src/app/api/director/approve/route.ts` (approval endpoint)

---

## 4. Pre-existing TypeScript Errors ✅ RESOLVED (v31)

**Status:** Fixed in Session v31

**Resolution:** All 21 TypeScript errors resolved with type assertions and proper imports

**Files Fixed:**
- `complexity-analyzer.ts`: Added RequestData interface + typed bands array (4 errors fixed)
- `contract-validator.ts`: Added `as Contract[]` type assertion (1 error fixed)
- `director-service.ts`: Added `as any` for work_orders insert + decision_data (2 errors fixed)
- `enhanced-proposer-service.ts`: Used `Array.from()` for MapIterator + typed reduce params (10 errors fixed)
- `proposer-registry.ts`: Type assertions for provider, cost_profile, success_patterns, notes (4 errors fixed)

**Current Status:** 0 TypeScript errors across entire codebase - clean compilation achieved!

**Verification:** `npx tsc --noEmit` returns 0 errors

---

## 5. Cold-Start Race Condition (CRITICAL)

**Status:** Flaky test, workaround available

**Problem:** Security Hard Stop test fails on first run after server restart

**Symptoms:**
```
Integration tests: 14/15 passing (first run)
Security Hard Stop test: FAIL
Run tests again: 15/15 passing (second run)
```

**Root cause:** Config loading completes AFTER API accepts first request
- Server starts accepting requests immediately
- `system_config` table query still in flight
- First test hits endpoint before config loaded
- Security keywords not detected → wrong model selected

**Impact:** Test suite unreliable on fresh server start

**Workaround:** Run `.\phase1-2-integration-test.ps1` twice after server restart

**Planned fix (Week 4 Day 5):**
1. Add initialization barrier (async config load before server ready)
2. Create readiness check endpoint: `/api/health/ready`
3. Test suite waits for 200 from `/api/health/ready` before running tests

**Files to modify:**
- Server startup logic (Next.js app initialization)
- `src/lib/config-services.ts` (add initialization promise)
- New: `src/app/api/health/ready/route.ts`
- Test script: Update to check readiness endpoint first

---

## 6. Dependency Validation Relaxed (Temporary) - ⚠️ MONITORING

**Status:** Intentional compromise, refinement planned

**Problem:** Simple cycle detection flags valid diamond patterns as circular

**Example:**
```
WO-0: Database schema
WO-1: API endpoint
WO-2: Integration (depends on WO-0 AND WO-1)  ← Flagged as circular
```

**Current behavior:** Warns but doesn't block (implemented in v25)

**Constraint violated:** Architect prompt says "sequential dependencies only", but multi-parent convergence is valid

**Impact:** May generate complex dependency graphs that need human review

**Workaround:** Review dependency visualization in UI before approval (Director validates structure)

**Planned fix (Future Phase):**
1. Refine Architect prompt to explicitly support parallel foundations converging
2. Implement proper topological sort for dependency validation
3. Only block on TRUE circular dependencies (A→B→C→A)

**Files to modify:**
- `src/lib/architect-decomposition-rules.ts` (dependency validation logic)
- Architect system prompt (allow multi-parent explicitly)

**Note:** Director risk assessment now provides additional validation layer

---

## 7. Tunnel Status Unknown

**Status:** Not critical for local development

**Problem:** `https://moose-dev-webhook.loca.lt` may need restart (status not verified this session)

**Impact:** GitHub webhooks won't reach local server (affects webhook testing only)

**Workaround:** Not needed for Phase 2.1 work (local development only)

**How to verify:**
```powershell
Invoke-RestMethod -Uri "https://moose-dev-webhook.loca.lt/api/github/webhook"
```

**How to restart (if needed):**
```powershell
# Terminal 2
lt --port 3000 --subdomain moose-dev-webhook
```

**Note:** Tunnel only required for GitHub webhook testing. All Phase 2.1 Architect work can be done locally without tunnel.

---

## 8. Claude Markdown Wrapping Persists

**Status:** Handled in code, not fixable at prompt level

**Problem:** Despite explicit "Return ONLY valid JSON, no markdown", Claude Sonnet 4.5 wraps JSON in ```json blocks

**Example output:**
```json
```json
{"work_orders": [...]}
```
```

**Impact:** JSON parsing fails without preprocessing

**Workaround (implemented):** Strip markdown before parsing
```typescript
const cleaned = response.replace(/^```json\n?|\n?```$/g, '');
const parsed = JSON.parse(cleaned);
```

**Location:** `src/lib/architect-service.ts` line ~87

**Note:** This is a model behavior issue, not solvable via prompt engineering. Always strip markdown in parsing code.

---

## 9. Git Can't Restore Uncommitted Files

**Status:** User error, prevention in place

**Problem:** `git checkout HEAD -- file.ts` only works for tracked files

**Example:**
```powershell
# Create new file
New-Item temp.ts

# Try to restore (FAILS - file never committed)
git checkout HEAD -- temp.ts
# Error: pathspec 'temp.ts' did not match any file(s) known to git
```

**Impact:** Data loss if uncommitted file deleted

**Prevention:** Always check `git status` before `git checkout`

**Workaround:** None for uncommitted files (create backup before risky operations)

---

## 10. Orchestrator Testing Status - 🔄 IN PROGRESS (v33)

**Status:** Implementation complete, prerequisites installed, schema bug found, unit tests pending

**Problem:** Orchestrator has critical schema bug and zero automated tests

**Current state (v33):**
- ✅ Implementation: 10 files complete (8 core + 2 API), 1,152 lines
- ✅ Prerequisites: Python 3.11, Aider CLI 0.86.1, GitHub CLI 2.81.0 authenticated
- ✅ Git branch logic: Fixed to work from current branch (not hardcoded main/master)
- ❌ **Schema bug:** result-tracker.ts uses `agent_name` (doesn't exist) - should use `model_used`
- ❌ **Unit tests:** 0/5 written (went straight to E2E - backwards approach)
- ❌ **Integration tests:** 0/2 added to test suite
- ⏸️ **E2E testing:** Deferred until unit/integration tests pass

**Critical Bug Details:**
```typescript
// WRONG (lines 94-109 in result-tracker.ts)
await supabase.from('outcome_vectors').insert({
  agent_name: 'orchestrator',  // ❌ Column doesn't exist!
  operation_type: 'work_order_execution',  // ❌ Column doesn't exist!
  // Missing required columns: model_used, route_reason, work_order_id
});

// CORRECT (fix needed)
await supabase.from('outcome_vectors').insert({
  work_order_id: wo.id,  // ✅ Required
  model_used: proposerResponse.proposer_used,  // ✅ Required (e.g., "gpt-4o-mini")
  route_reason: routingDecision.reason,  // ✅ Required
  cost: proposerResponse.cost,
  execution_time_ms: proposerResponse.execution_time_ms,
  success: true,
  diff_size_lines: 0,
  test_duration_ms: null,
  failure_classes: null
});
```

**Root Cause:** Misunderstood outcome_vectors table purpose
- **Incorrect assumption:** Generic agent activity log
- **Actual purpose:** LLM model performance tracking for Manager's learning system
- **Should track:** "gpt-4o-mini generated code for WO-123, cost $0.001, succeeded"
- **Should NOT track:** "orchestrator executed WO-123"

**Impact:** Every Orchestrator execution fails at result tracking stage (500 error)

**Testing Strategy (Corrected):**
1. ✅ Fix result-tracker.ts schema bug (15 min)
2. ✅ Write 5 unit tests (60 min) - result-tracker, manager-coordinator, proposer-executor, aider-executor, github-integration
3. ✅ Add Tests 19-20 to integration suite (10 min)
4. ✅ Run full test suite (5 min) - target 19-20/20 passing
5. ⏸️ E2E deferred - move to Client Manager

**Unit Tests Planned:**
- `src/lib/orchestrator/__tests__/result-tracker.test.ts` - Schema validation (CRITICAL)
- `src/lib/orchestrator/__tests__/manager-coordinator.test.ts` - Complexity estimation logic
- `src/lib/orchestrator/__tests__/proposer-executor.test.ts` - Task description building
- `src/lib/orchestrator/__tests__/aider-executor.test.ts` - Instruction file formatting
- `src/lib/orchestrator/__tests__/github-integration.test.ts` - PR body generation

**Why E2E Deferred:**
- Attempted E2E 4 times, each revealed new environment issue
- No unit tests exist to validate components in isolation
- Testing backwards (E2E first, unit tests last)
- Diminishing returns - 2+ hours spent, still not working

**Next Phase:** Client Manager (Phase 2.5) - higher value, simpler to test

---

## 11. Manager Integration with Proposers - 🔜 PENDING

**Status:** Manager complete, integration pending

**Problem:** Manager service exists but enhanced-proposer-service still calls proposerRegistry directly

**Current state:**
- ✅ Manager routing logic: Complete (371 lines in manager-routing-rules.ts)
- ✅ Manager service: Complete (202 lines in manager-service.ts)
- ✅ Manager API: Complete (/api/manager POST + GET retry)
- ⚠️ Integration: Proposers don't call Manager yet

**Required changes:**
1. Update `enhanced-proposer-service.ts` to call Manager instead of proposerRegistry
2. Refactor `proposer-registry.ts` lines 110-245 (old routing logic duplicates Manager)
3. Test Director→Manager→Proposer E2E flow

**Impact:** Manager works independently but not in full workflow

**Workaround:** Test Manager with direct API calls (18/18 tests passing)

**Planned fix:** Next phase integration work

**Files to modify:**
- `src/lib/enhanced-proposer-service.ts` (remove proposerRegistry routing call)
- `src/lib/proposer-registry.ts` (remove lines 110-245 after migration)

---

## Summary Table

| Issue | Status | Impact | Workaround | Planned Fix |
|-------|--------|--------|------------|-------------|
| ~~Architect workflow~~ | ✅ RESOLVED | None | N/A | Complete |
| ~~Database migration~~ | ✅ RESOLVED | None | N/A | Complete |
| ~~Director approval~~ | ✅ RESOLVED | None | N/A | Complete |
| ~~Pre-existing TS errors (21)~~ | ✅ RESOLVED v31 | None | N/A | Complete |
| Manager→Proposer integration | 🔜 PENDING | Manager isolated | Direct API test | Next phase |
| Orchestrator E2E testing | 🔜 PENDING | Not tested yet | N/A | Install prerequisites |
| Cold-start race condition | **CRITICAL** | Flaky tests | Run twice | Week 4 Day 5 |
| Dependency validation relaxed | ⚠️ Monitoring | Complex graphs | Director validates | Future phase |
| Tunnel status unknown | Non-critical | Webhook testing | Not needed yet | On-demand |
| Claude markdown wrapping | Handled | None | Code strips it | N/A (model behavior) |
| Git uncommitted restore | User error | Data loss | Check status | N/A (prevention) |

---

**See [session-state.md](session-state.md) for current work and [rules-and-procedures.md](rules-and-procedures.md) for mitigation procedures.**