# Known Issues

**Active problems, workarounds, planned fixes.**

---

## 1. Architect Workflow Incomplete

**Status:** Phase 2.1 ~30% complete

**Problem:** API functional but missing critical integration pieces

**Missing components:**
1. Database migration (5 new work_orders columns)
2. UI integration (Upload Spec tab in MissionControlDashboard)
3. Director approval flow (Architect→Director→Manager handoff)

**Impact:** Can test API endpoint directly but no end-to-end workflow

**Workaround:** Use PowerShell `Invoke-RestMethod` to test decomposition API directly

**Planned fix:** Week 3 Day 5 (database) + Week 4 Day 1-3 (UI + Director)

**Files affected:**
- Database: `work_orders` table schema
- UI: `src/components/MissionControlDashboard.tsx`
- API: New Director approval endpoint needed

---

## 2. Database Migration Pending

**Status:** Not started

**Problem:** `work_orders` table missing Architect-specific columns

**Required columns:**
1. `acceptance_criteria` (jsonb) - Array of criteria from Architect
2. `files_in_scope` (jsonb) - Array of file paths to modify
3. `context_budget_estimate` (integer) - Token budget per WO
4. `decomposition_doc` (text) - Markdown documentation
5. `architect_version` (text) - Version tracking (e.g., "v1")

**Impact:** Cannot persist decomposition output to database

**Workaround:** Store decomposition in frontend state temporarily

**Planned fix:** Run migration before UI work (Week 3 Day 5)

**Migration SQL:**
```sql
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS
  acceptance_criteria jsonb DEFAULT '[]'::jsonb,
  files_in_scope jsonb DEFAULT '[]'::jsonb,
  context_budget_estimate integer DEFAULT 2000,
  decomposition_doc text,
  architect_version text DEFAULT 'v1';
```

**Verification:**
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'work_orders'
  AND column_name IN ('acceptance_criteria', 'files_in_scope',
      'context_budget_estimate', 'decomposition_doc', 'architect_version');
```

---

## 3. Director Approval Flow Missing

**Status:** Not implemented

**Problem:** No handoff from Architect to Director for governance approval

**Required flow:**
1. Architect generates decomposition
2. Director validates WO structure
3. Director assesses aggregate risk
4. Auto-approve if: all WOs low-risk AND total_cost < $50
5. Queue for human review if: any high-risk OR total_cost > $50

**Impact:** Work orders bypass governance layer

**Workaround:** Manual review of decomposition output before proceeding

**Planned fix:** Week 4 Day 1-3

**Files to create/modify:**
- `src/lib/director-service.ts` (rename from llm-service.ts)
- `src/app/api/director/approve/route.ts` (new endpoint)
- Update MissionControlDashboard for approval UI

---

## 4. Pre-existing TypeScript Errors (19 total)

**Status:** Unrelated to new code, not blocking

**Breakdown:**
- `complexity-analyzer.ts`: 4 errors
- `contract-validator.ts`: 17 errors
- `enhanced-proposer-service.ts`: 10 errors (overlapping with others)
- `proposer-registry.ts`: 4 errors

**Impact:** None on new Architect functionality. All errors in separate methods.

**Workaround:** Verify new code with targeted checks: `npx tsc --noEmit path/to/new/file.ts`

**Planned fix:** Address during Phase 4 refactoring (Week 8)

**Note:** New Architect files (`architect-service.ts`, `types/architect.ts`, `api/architect/decompose/route.ts`) have 0 errors.

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

## 6. Dependency Validation Relaxed (Temporary)

**Status:** Intentional compromise, refinement planned

**Problem:** Simple cycle detection flags valid diamond patterns as circular

**Example:**
```
WO-0: Database schema
WO-1: API endpoint
WO-2: Integration (depends on WO-0 AND WO-1)  ← Flagged as circular
```

**Current behavior:** Warns but doesn't block

**Constraint violated:** Architect prompt says "sequential dependencies only", but multi-parent convergence is valid

**Impact:** May generate complex dependency graphs that need human review

**Workaround:** Review dependency visualization in UI before approval

**Planned fix (Week 4 Day 2):**
1. Refine Architect prompt to explicitly support parallel foundations converging
2. Implement proper topological sort for dependency validation
3. Only block on TRUE circular dependencies (A→B→C→A)

**Files to modify:**
- `src/lib/architect-service.ts` (dependency validation logic)
- Architect system prompt (allow multi-parent explicitly)

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

## Summary Table

| Issue | Status | Impact | Workaround | Planned Fix |
|-------|--------|--------|------------|-------------|
| Architect workflow incomplete | 30% done | No E2E flow | Direct API test | Week 3-4 |
| Database migration pending | Not started | Can't persist | Frontend state | Week 3 Day 5 |
| Director approval missing | Not started | Bypasses governance | Manual review | Week 4 Day 1-3 |
| Pre-existing TS errors (19) | Non-blocking | None | Targeted checks | Week 8 refactor |
| Cold-start race condition | **CRITICAL** | Flaky tests | Run twice | Week 4 Day 5 |
| Dependency validation relaxed | Temporary | Complex graphs | Human review | Week 4 Day 2 |
| Tunnel status unknown | Non-critical | Webhook testing | Not needed yet | On-demand |
| Claude markdown wrapping | Handled | None | Code strips it | N/A (model behavior) |
| Git uncommitted restore | User error | Data loss | Check status | N/A (prevention) |

---

**See [session-state.md](session-state.md) for current work and [rules-and-procedures.md](rules-and-procedures.md) for mitigation procedures.**