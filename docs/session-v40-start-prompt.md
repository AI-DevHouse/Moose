# Session v40 Start Prompt

## Quick Context

You're continuing work on **Priority 3: Orchestrator E2E Test**. The previous session (v39→v40) completed Priorities 1 & 2 and created E2E test infrastructure, but discovered **4 critical integration bugs** when running the first E2E test.

## What Just Happened (Last 2 Hours)

- ✅ Fixed all 49 unit tests (were 5 failing)
- ✅ Integrated contract validation into refinement cycle
- ✅ Created 2 E2E test scripts (PowerShell + Node.js)
- ✅ Verified environment (Aider CLI, GitHub CLI, Python 3.11 all working)
- ❌ **First E2E test run FAILED** - found 4 bugs blocking orchestrator pipeline

## The Problem Right Now

The orchestrator pipeline is broken. When you run `node test-orchestrator-e2e-simple.js`:

1. ✅ Work order creates successfully
2. ✅ Work order gets marked as approved
3. ✅ Orchestrator starts polling
4. ❌ **Orchestrator can't read the work order** - GET endpoint failing (12/12 attempts)
5. ❌ **Work order stays "pending" forever** - orchestrator never processes it

This means the entire Poll → Route → Generate → Aider → PR flow is broken.

## Your Mission

**Fix the 2 critical bugs blocking E2E:**

### Bug #3 (CRITICAL) - Fix First
**File:** `src/app/api/work-orders/[id]/route.ts`
**Issue:** GET endpoint returns error every time
**Test:** `curl http://localhost:3000/api/work-orders/<work-order-id>` fails

**What to do:**
1. Read the route.ts file
2. Check if there's a runtime error (missing imports, wrong field names, etc.)
3. Test manually with curl using a real work order ID from database
4. Fix the error
5. Verify GET works

### Bug #4 (CRITICAL) - Fix Second
**File:** `src/lib/orchestrator/work-order-poller.ts`
**Issue:** Orchestrator polls but doesn't find/process approved work orders
**Test:** Work order stays "pending" forever even though orchestrator is running

**What to do:**
1. Add debug logging to work-order-poller.ts
2. Check the polling query - is it filtering correctly for approved work orders?
3. Verify it's looking for the right metadata fields (`director_approved: true`)
4. Test that it actually calls manager-coordinator when it finds a work order
5. Check if manager-coordinator is failing silently

## Success Criteria

Run `node test-orchestrator-e2e-simple.js` and see:
- Work order GET succeeds (not 12 failed attempts)
- Work order status changes from "pending" → "routed" → "in_progress"
- Orchestrator processes the work order within 60 seconds

## Key Files Already Read

- `docs/session-state.md` - Complete context
- `docs/orchestrator-e2e-findings.md` - Detailed bug analysis
- `test-orchestrator-e2e-simple.js` - The failing test

## Commands You'll Need

```bash
# Run the E2E test
node test-orchestrator-e2e-simple.js

# Check dev server is running
curl http://localhost:3000/api/health

# Test work order GET manually
curl http://localhost:3000/api/work-orders/<work-order-id>

# Check orchestrator status
curl http://localhost:3000/api/orchestrator

# Run all unit tests (should stay at 49/49)
npx vitest run

# TypeScript check (should stay at 0 errors)
npx tsc --noEmit
```

## Expected Timeline

- Bug #3 fix: 1-2 hours (endpoint debugging)
- Bug #4 fix: 2-3 hours (orchestrator pipeline debugging)
- Re-run and validate: 30 minutes
- Total: 3-5 hours to working E2E test

## Don't Repeat This Work

The previous session already did:
- ✅ Environment setup and verification
- ✅ Test script creation
- ✅ First E2E run and bug discovery
- ✅ Documentation of all findings

Just read `docs/orchestrator-e2e-findings.md` for the complete bug analysis - don't re-investigate what's already documented.

## Starting Point

Begin by saying: "I'll fix the 2 critical bugs blocking the orchestrator E2E test. Starting with Bug #3 (work order GET endpoint)..."

Then read `src/app/api/work-orders/[id]/route.ts` and start debugging.
