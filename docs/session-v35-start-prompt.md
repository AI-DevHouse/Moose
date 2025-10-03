# Session v35 Start Prompt

Copy and paste this prompt to start the next session:

---

I'm continuing work on the Moose Mission Control project. This is **Session v35**, continuing from v34.

**CRITICAL: Follow the Session Start Checklist in docs/session-state.md before any work.**

Please read these handover documents IN ORDER:

1. `docs/session-state.md` - **Start here** - Current status, next tasks, verification questions
2. `docs/known-issues.md` - Active problems and workarounds
3. `docs/rules-and-procedures.md` - Development rules (especially R10 "Verify before assuming")
4. `docs/architecture-decisions.md` - System design and agent hierarchy

**Session Start Checklist (MANDATORY - Do NOT skip):**

1. ✅ Run session start automation:
   ```powershell
   .\scripts\session-start.ps1
   ```
   This regenerates Supabase types and checks TypeScript compilation.

2. ✅ Review "Last Session Summary (v33→v34)" in session-state.md:
   - Phase 3.1 Sentinel Agent complete (8 files, 850+ lines)
   - Schema bug fixed in result-tracker.ts
   - Schema Validation Protocol (R10) implemented
   - Integration tests: 21/22 passing (E2E timeout is expected, NOT a failure)

3. ✅ Check current status:
   - Branch: feature/wo-b8dbcb2c-orchestrator-e2e-test
   - TypeScript: 0 errors expected
   - Integration tests: 21/22 passing expected
   - Recent commits: 2 commits in v34 (Sentinel implementation + handover docs)

4. ✅ Answer verification questions Q1-Q25 in session-state.md to confirm understanding

5. ✅ Review "Next Immediate Task" section:
   - **Priority 1:** Configure GitHub webhook for Sentinel (15 min)
   - **Priority 2:** Test Sentinel with real workflow (10 min)
   - **Priority 3:** Implement Phase 2.5 Client Manager (2-3 hours)

**What was completed in v34:**
- ✅ Result tracker schema bug fixed (outcome_vectors columns corrected)
- ✅ Schema Validation Protocol (R10): "Verify before assuming" with scripts/session-start.ps1
- ✅ Phase 3.1 Sentinel Agent MVP: Webhook endpoint, test parsers, decision logic, GitHub Actions
- ✅ Integration tests expanded to 22/22 (Tests 19-20 Orchestrator, 21-22 Sentinel)
- ✅ Complete documentation: phase-3.1-sentinel-complete.md, sentinel-implementation-plan.md

**What's ready to implement:**
1. **Sentinel webhook configuration** (setup only, no code)
2. **Phase 2.5 Client Manager** (technical spec created in v34 conversation history)
3. **Orchestrator unit tests** (5 tests deferred: result-tracker, manager-coordinator, proposer-executor, aider-executor, github-integration)

**Important reminders:**
- ⚠️ E2E timeout in integration tests is EXPECTED (LLM calls take >5 min) - NOT a failure
- ⚠️ Always run `.\scripts\session-start.ps1` FIRST to regenerate types (R10 protocol)
- ⚠️ Check supabase.ts before writing DB queries (R10: "Verify before assuming")
- ⚠️ Curl endpoints before writing tests to verify actual field names (R10)

**DO NOT SKIP THE SESSION START CHECKLIST.** It ensures you have full context before making changes.

After reading the handover docs and running the checklist, let me know you're ready to proceed with the next task.

---

**Quick commands reference:**
```powershell
# Session start (ALWAYS RUN FIRST)
.\scripts\session-start.ps1

# Integration tests (expect 21/22 passing)
.\phase1-2-integration-test.ps1

# TypeScript check (expect 0 errors)
npx tsc --noEmit 2>&1 | Select-String "Found.*errors"

# Git status
git status
git log --oneline -5
```
