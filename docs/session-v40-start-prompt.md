# Session v40 Start Prompt

You're the next Claude acting as my lead developer. Now your handover documents are ready!

**Read these first:**
1. `docs/session-state.md` (v39→v40 summary at top)
2. `docs/orchestrator-e2e-findings.md` (complete bug analysis)

**Your task:** Fix 2 critical bugs blocking orchestrator E2E test.

**Bug #3:** Work order GET endpoint failing - fix `src/app/api/work-orders/[id]/route.ts`

**Bug #4:** Orchestrator not processing work orders - debug `src/lib/orchestrator/work-order-poller.ts`

**Test:** Run `node test-orchestrator-e2e-simple.js` - should complete successfully (not stay "pending" for 60s)

**Start by saying:** "I'll fix Bug #3 (work order GET endpoint)..." then read the route file and debug.
