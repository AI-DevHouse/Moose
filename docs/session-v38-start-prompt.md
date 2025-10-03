# Session v38 Start Prompt: Error Handling & Resilience Implementation

**Objective:** Implement error handling and resilience fixes for production deployment.

**Context:** You are working on the Moose Mission Control system - a multi-agent autonomous development environment. The system is functionally complete (v37) but has critical production gaps: silent failures, budget race conditions, and no failure mode testing.

---

## Your Task

Implement the **Error Handling & Resilience Plan** documented in:
**`C:\dev\moose-mission-control\docs\error-handling-resilience-plan.md`**

Read that document carefully - it contains the complete implementation plan with code examples, rationale, and success criteria.

---

## Critical Context (Read Before Starting)

### What Already Exists (DON'T rebuild these)

1. **Client Manager Escalation System (v35-v37)** - FULLY FUNCTIONAL
   - Files: `src/lib/client-manager-service.ts`, `src/lib/client-manager-escalation-rules.ts`
   - API: `/api/client-manager/escalate`, `/api/client-manager/resolutions/{id}`, `/api/client-manager/execute`
   - UI: Mission Control Escalations tab (260+ lines, v37)
   - Database: `escalations` table
   - **Your job:** Make all agents USE this system consistently

2. **Sentinel Error Handling Pattern (v34-v35)** - GOOD PATTERN TO REPLICATE
   - File: `src/lib/sentinel/sentinel-service.ts` lines 188-243
   - Pattern: Try Client Manager API → Fallback to Work Order status update → Log error
   - **Your job:** Apply this pattern everywhere

3. **Testing Infrastructure** - READY TO USE
   - Vitest 3.2.4 installed (`npx vitest --version` to confirm)
   - 5 existing tests in `src/lib/orchestrator/__tests__/*.test.ts`
   - PowerShell integration tests: 18/18 passing
   - **Your job:** Add 10 failure mode tests

4. **Budget Enforcement (Current)** - HAS RACE CONDITION
   - File: `src/lib/manager-service.ts` lines 126-142
   - Function: `calculateDailySpend()` reads without locking
   - **Your job:** Add PostgreSQL function with row-level locking

### Current Problems (What You're Fixing)

**Problem 1: Silent Failures**
- 20 files have `console.error`, 84 catch blocks, many don't escalate
- Example: `result-tracker.ts` line 113-116 logs error but doesn't escalate
- Impact: Learning system blind, Work Orders stuck, no human visibility

**Problem 2: Budget Race Condition**
- Two concurrent requests can both read $95, both call LLM for $10, total = $105 (exceeds $100 limit)
- File: `src/lib/manager-service.ts` calculateDailySpend()
- Impact: Financial risk - can exceed emergency kill limit

**Problem 3: Zero Failure Testing**
- 18/18 integration tests pass (all happy path)
- 0 tests for error handling, escalation, graceful degradation
- Impact: Unknown resilience in production

---

## Implementation Order (Follow Exactly)

### Phase 1: Error Escalation Enforcement (1-2 days) ← START HERE

**Step 1.1:** Create `src/lib/error-escalation.ts`
- Full code is in the plan document (50 lines)
- Function: `handleCriticalError()` that calls Client Manager API
- Pattern: Log → Escalate if critical+workOrderId → Don't throw if escalation fails

**Step 1.2:** Audit & Fix Files
- Run: `npx grep -r "console.error" src/lib --files-with-matches`
- Expected: 20 files
- For each file, ask: "Does this impact Work Order execution?" → YES = Add escalation

**Priority order (from plan document):**
1. **CRITICAL:** result-tracker.ts (line 113-116), manager-service.ts (line 138), orchestrator-service.ts
2. **HIGH:** sentinel-service.ts (already has fallback, just add escalation call), proposer-executor.ts, aider-executor.ts, github-integration.ts
3. **MEDIUM:** Remaining 13 files

**Step 1.3:** Test Phase 1
- Trigger an error (e.g., mock Supabase failure)
- Verify escalation appears in Mission Control UI: http://localhost:3000 → Escalations tab
- Success: Error visible, human can make decision

### Phase 2: Budget Race Fix (1 day)

**Step 2.1:** Create PostgreSQL function
- SQL in plan document: `check_and_reserve_budget()`
- Uses `LOCK TABLE` to prevent concurrent reads
- Run migration via Supabase dashboard or CLI

**Step 2.2:** Update manager-service.ts
- Add `reserveBudget()`, `updateReservationWithActual()`, `cancelReservation()`
- Full code in plan document
- Modify `routeWorkOrder()` to call reservation before routing

**Step 2.3:** Test Phase 2
- Simulate 2 concurrent requests at $95 daily spend
- Verify only ONE proceeds
- Check `cost_tracking` table for reservation records

### Phase 3: Failure Mode Tests (3-4 days)

**Step 3.1:** Create test file
- File: `src/lib/__tests__/failure-modes.test.ts`
- Framework: Vitest (already installed)

**Step 3.2:** Write 10 tests (specs in plan document)
1. outcome_vectors write failure → escalation created
2. Budget race condition → only one request succeeds
3. Concurrent Work Order metadata updates → no data loss
4. Malformed LLM JSON → error caught, escalation created
5. Database connection failure → graceful degradation
6. GitHub webhook race (PR number not set) → retry logic
7. Invalid state transition → rejected
8. Aider command failure → escalation created
9. Sentinel webhook invalid auth → 401 rejection
10. Work Order stuck >24h → detected and escalated

**Step 3.3:** Run tests
- Command: `npx vitest run src/lib/__tests__/failure-modes.test.ts`
- Expected: 10/10 passing
- Fix any failures discovered

### Phase 4: Monitoring Dashboard (1 day)

**Step 4.1:** Create API endpoint
- File: `src/app/api/admin/health/route.ts`
- Full code in plan document
- Returns: stuck WOs, daily budget, error rate, escalation backlog

**Step 4.2:** Create dashboard component
- File: `src/components/MonitoringDashboard.tsx`
- Full code in plan document
- Shows: budget progress bar, stuck WO alerts, escalation stats

**Step 4.3:** Add tab to Mission Control
- File: `src/components/MissionControlDashboard.tsx`
- Add: `<TabsTrigger value="monitoring">Monitoring</TabsTrigger>`
- Pattern already exists for Escalations tab (v37)

---

## Key Constraints & Decisions

### DO NOT Do These Things
❌ Create new error handling infrastructure (Client Manager already exists)
❌ Add new database tables (use existing escalations, cost_tracking)
❌ Rebuild Client Manager (it's complete in v35-v37)
❌ Apply budget limits to Architect (strategic, not tactical - see plan doc for reasoning)
❌ Use application-level optimistic locking (database locks are required for budget race)

### DO These Things
✅ Use existing Client Manager API for ALL escalations
✅ Follow Sentinel's error handling pattern (lines 188-243 in sentinel-service.ts)
✅ Use PostgreSQL row-level locking for budget race (battle-tested, atomic)
✅ Write all 10 failure mode tests (comprehensive coverage required)
✅ Keep new code minimal (~200 lines total)

### Critical Files to Modify
- **Phase 1:** Create `error-escalation.ts`, modify 20 files with console.error
- **Phase 2:** Create migration SQL, modify `manager-service.ts`
- **Phase 3:** Create `failure-modes.test.ts`
- **Phase 4:** Create `health/route.ts`, `MonitoringDashboard.tsx`, modify `MissionControlDashboard.tsx`

### Files to READ for Context
- `src/lib/client-manager-service.ts` - Existing escalation pattern (v35)
- `src/lib/sentinel/sentinel-service.ts` lines 188-243 - Good error handling example
- `src/lib/manager-service.ts` lines 126-142 - Current budget calculation (has race)
- `src/lib/orchestrator/result-tracker.ts` lines 113-116 - Example silent failure
- `src/lib/orchestrator/__tests__/result-tracker.test.ts` - Existing test pattern

---

## Verification Commands

### Check TypeScript Errors
```bash
npx tsc --noEmit 2>&1 | Select-String "Found.*errors"
# Expected: 0 errors
```

### Run Failure Mode Tests
```bash
npx vitest run src/lib/__tests__/failure-modes.test.ts
# Expected: 10/10 passing
```

### Check Integration Tests (Don't Break These)
```bash
.\phase1-2-integration-test.ps1
# Expected: 18/18 passing (unchanged)
```

### Test Escalation UI
```bash
# 1. Start server: npm run dev
# 2. Open: http://localhost:3000
# 3. Navigate to Escalations tab
# 4. Trigger error (mock Supabase failure)
# 5. Verify: Escalation appears with context
```

### Test Budget Race Fix
```bash
# Run 2 concurrent curl requests at $95 daily spend
# Expected: Only 1 succeeds, other gets "budget exceeded"
```

---

## Success Criteria (Report These When Done)

### Phase 1 Complete When:
- ✅ `error-escalation.ts` created and working
- ✅ All 20 files with console.error audited
- ✅ Priority 1 files fixed (result-tracker, manager-service, orchestrator-service)
- ✅ Triggered error appears in Mission Control UI
- ✅ TypeScript: 0 errors

### Phase 2 Complete When:
- ✅ PostgreSQL function created and tested
- ✅ `manager-service.ts` uses budget reservations
- ✅ Concurrent request test: Only 1 of 2 succeeds at budget limit
- ✅ Budget over-run creates escalation
- ✅ TypeScript: 0 errors

### Phase 3 Complete When:
- ✅ 10/10 failure mode tests passing
- ✅ Tests validate escalation creation
- ✅ Tests validate graceful degradation (no crashes)
- ✅ Coverage >80% for error handling paths

### Phase 4 Complete When:
- ✅ Monitoring tab visible in Mission Control
- ✅ Real-time budget tracking works
- ✅ Stuck Work Orders highlighted
- ✅ Escalation backlog visible
- ✅ TypeScript: 0 errors

### Overall Complete When:
- ✅ All 4 phases done
- ✅ Integration tests: 18/18 still passing
- ✅ Failure tests: 10/10 passing
- ✅ TypeScript: 0 errors
- ✅ Git commit created: "Error handling & resilience implementation (v38)"

---

## Important Notes

### Budget Reservation Design Decision
The plan document explains why we use database-level pessimistic locking (not application-level optimistic locking). Key reasons:
- Budget enforcement is financial risk - zero tolerance for races
- PostgreSQL locks are battle-tested
- Atomic operations prevent all concurrent read/write issues
- Fail-safe: Over-estimates budget if reservations not cleaned up

### Architect Budget Exception
Architect is NOT subject to daily budget limits (explained in plan doc):
- Strategic planning vs tactical execution
- Human-initiated (conscious decision)
- Low frequency (1-2 calls/day max)
- High cost ($11.30/call) but acceptable for strategic decisions

### Testing Philosophy
- Integration tests (PowerShell): Happy path, full system
- Unit tests (Vitest): Failure modes, error paths
- Both are required for production confidence

---

## Workflow Tips

### Start Each Phase By:
1. Read relevant section in `error-handling-resilience-plan.md`
2. Understand WHY this approach was chosen (vs alternatives)
3. Review code examples in plan document
4. Implement with full code (don't skip details)
5. Test thoroughly before moving to next phase

### If You Get Stuck:
1. Re-read plan document section
2. Check existing patterns in codebase (Sentinel error handling is good reference)
3. Verify TypeScript types in `src/types/supabase.ts`
4. Test incrementally (don't wait until end of phase)

### Before Marking Phase Complete:
1. Run TypeScript check (0 errors required)
2. Run relevant tests (must pass)
3. Manually verify in UI if applicable
4. Update todo list (mark phase as completed)

---

## Reference Documents

**Primary:** `docs/error-handling-resilience-plan.md` ← READ THIS FIRST
- Complete implementation plan with code examples
- Rationale for all design decisions
- Success criteria and rollback plans

**Secondary (if needed):**
- `docs/session-state.md` - Current system status (v37)
- `docs/known-issues.md` - Pre-existing problems
- `docs/architecture-decisions.md` - Agent hierarchy and patterns

**Don't read unless stuck:** Other handover documents will consume context unnecessarily. The plan document is self-contained.

---

## Expected Timeline

- **Day 1-2:** Phase 1 (Error Escalation)
- **Day 3:** Phase 2 (Budget Race Fix)
- **Day 4-6:** Phase 3 (Failure Mode Tests)
- **Day 7:** Phase 4 (Monitoring Dashboard)

**Total: 6-7 days of focused work**

---

## Starting Command

```bash
# Verify environment
npx tsc --noEmit  # Should show 0 errors
npx vitest --version  # Should show 3.2.4
npm run dev  # Should start on localhost:3000

# Read the plan
cat docs/error-handling-resilience-plan.md

# Begin Phase 1
echo "Starting Phase 1: Error Escalation Enforcement"
```

---

**Ready to begin.** Start with Phase 1, Step 1.1: Create `src/lib/error-escalation.ts`. The full code is in the plan document.
