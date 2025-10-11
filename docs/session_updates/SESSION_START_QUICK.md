# Session Start - Quick Reference

**Session:** v72 (Next)
**Last Session:** v71 (2025-10-11 14:00 - ✅ SUCCESS - Aider Git detection fixed)
**Read Time:** 3 minutes

---

## ✅ v71 AIDER GIT DETECTION FIXED - READY FOR PHASE 1 RETRY

**What was completed in v71:**
1. ✅ Investigated v70 Phase 1 failure (Aider not committing)
2. ✅ Identified root cause: Git detection race condition
3. ✅ Implemented fix: Git priming step in aider-executor.ts
4. ✅ Tested fix: Manual Aider run successful
5. ✅ Cleaned up Phase 1 artifacts (5 branches, untracked files)
6. ✅ Reset 5 failed WOs to pending

**Fix Applied:** Git priming step (git status) before spawning Aider

**Status:** Ready for Phase 1 retry with high confidence

**See:** `session-v71-20251011-1400-handover.md` for full details

---

## 🚨 CRITICAL RULES (NON-NEGOTIABLE)

**RULE 1: Database Schema**
- ❌ NEVER query/modify database without reading schema first
- ✅ ALWAYS: Read `scripts/create-production-schema.sql` BEFORE any DB work
- Common mistakes: `is_active` vs `active`, `model_name` vs `model`

**RULE 2: Code Editing**
- ❌ NEVER edit without reading complete file first
- ✅ ALWAYS: Use Read tool, verify line numbers, understand context

**RULE 3: Terminal Output**
- ❌ NEVER paste 100+ lines of output/JSON/logs
- ✅ ALWAYS: Write to files, reference paths only

**RULE 4: Documentation**
- ❌ NEVER explain in terminal, paste file contents
- ✅ ALWAYS: Create .md/.txt files, reference them

**RULE 5: Running Processes**
- ❌ NEVER kill daemon without explicit instruction
- ✅ ALWAYS: Monitor with BashOutput, be patient (30-90 min runs)

---

## 📊 CURRENT STATUS (as of v71)

**System State:**
- ✅ All code fixes from v67: COMPLETE
- ✅ Aider Git detection fix: COMPLETE (v71)
- ✅ Orchestrator pipeline: Fully operational
- ✅ Target repo: Clean (0 branches, pristine working tree)
- ✅ Build: Successful (0 errors)
- ✅ Moose UI: Running at http://localhost:3001

**Work Order Status:**
- Total: 49
- Pending: 49 (100%)
- Failed: 0
- In Progress: 0
- Completed: 0

**Critical Blocker:**
- ✅ None - All blockers resolved

**Proposer Configuration:**
- ✅ Claude Sonnet 4.5: ACTIVE (for Phase 1)
- ❌ GPT-4o-mini: DISABLED (will enable for Phase 2)

**Current daemon:** STOPPED (ready to start Phase 1)

**Full details:** `session_updates/session-v71-20251011-1400-handover.md`

---

## 🎯 IMMEDIATE NEXT ACTIONS

**Phase 1 Retry: Execute with Fixed Aider**

1. **Read v71 handover**
   - Read: `session_updates/session-v71-20251011-1400-handover.md`
   - Understand Aider fix and retry instructions

2. **Approve 5 Work Orders for Phase 1**
   ```bash
   cd C:/dev/moose-mission-control
   powershell.exe -File scripts/run-with-env.ps1 scripts/approve-phase1-wos.ts
   ```

3. **Verify approval (exactly 5 WOs)**
   ```bash
   powershell.exe -File scripts/run-with-env.ps1 scripts/check-all-wos.ts
   # Should show 5 WOs with metadata.auto_approved = true
   ```

4. **Start Phase 1 orchestrator daemon**
   ```bash
   powershell.exe -File scripts/run-with-env.ps1 scripts/orchestrator-daemon.ts
   # Use run_in_background: true in Bash tool
   ```

5. **Monitor execution (critical - watch for Git detection)**
   - Use BashOutput tool to check progress
   - Monitor Moose UI: http://localhost:3001
   - Watch for: "Git detection primed successfully" in logs
   - Verify: "Git repo: .git with N files" (not "none")

6. **Verify success after completion**
   ```bash
   # Check work order status
   powershell.exe -File scripts/run-with-env.ps1 scripts/check-all-wos.ts

   # Check PRs and commits
   cd C:/dev/multi-llm-discussion-v1
   git fetch origin
   git branch -r | grep feature/wo-
   git log origin/feature/wo-[branch-name] --oneline
   ```

**Success Criteria:** ≥80% (4-5 of 5 WOs complete with commits and PRs)

---

## 🔔 STOP AND READ TRIGGERS

**BEFORE you do any of these, STOP and read the reference:**

### Database Setup (First Time Only)
```
IF: Setting up fresh database OR new deployment
THEN: Run these SQL files in order:
  1. scripts/create-production-schema.sql (base schema)
  2. scripts/create-budget-reservation-function.sql (RPC function)
  3. Seed initial proposer configs via /api/proposers
WHY: Schema must be complete before code runs
NOTE: Migration files are ALREADY included in create-production-schema.sql (v2)
```

### Database Work
```
IF: Writing SQL query OR modifying database
THEN: Read scripts/create-production-schema.sql (ENTIRE FILE)
WHY: Column names vary (active vs is_active, model vs model_name)
```

### Code Editing
```
IF: About to edit any .ts/.tsx/.js file
THEN: Read COMPLETE file first with Read tool
WHY: Line numbers shift, need context to avoid breaking changes
```

### Architecture Questions
```
IF: Confused about how system works OR planning changes
THEN: Read session_updates/SOURCE_OF_TRUTH_Moose_Workflow.md
WHERE: Lines 1-300 (architecture), 300-600 (components), 600-900 (workflow)
```

### Failures/Errors
```
IF: Work orders failing OR investigating errors
THEN: Read session_updates/iteration-1-changes-needed.md
WHY: 12 known issues documented with patterns
```

### End of Session
```
IF: Session ending OR major milestone reached
THEN: Read SESSION_HANDOVER_MASTER.md (Update Instructions section)
ALSO: Read WHEN_TO_READ_WHAT.md for handover creation guide
```

### Planning Next Steps
```
IF: Don't know what to build/fix next
THEN: Read session_updates/DELIVERY_PLAN_To_Production.md
WHERE: Lines 1366-1514 (current status), 20-90 (what needs completion)
```

### Stuck/Confused
```
IF: Stuck OR need methodology guidance
THEN: Read SESSION_HANDOVER_MASTER.md
WHERE: Check Table of Contents, jump to relevant section
```

---

## ⚙️ QUICK COMMAND REFERENCE

**Status checks:**
```bash
# Overall status
powershell.exe -File scripts/run-with-env.ps1 scripts/check-project-status.ts

# All work orders
powershell.exe -File scripts/run-with-env.ps1 scripts/check-all-wos.ts

# Git status
git status
```

**Build:**
```bash
npm run build
npm test
npx tsc --noEmit
```

**Orchestrator:**
```bash
# Start (background)
powershell.exe -File scripts/run-with-env.ps1 scripts/orchestrator-daemon.ts
# Use run_in_background: true in Bash tool

# Monitor
# Use BashOutput tool with bash_id
```

---

## 📚 DOCUMENT MAP

**Start here (you are here):**
- `SESSION_START_QUICK.md` ← Current file

**When triggered (see above):**
- `session-v67-20251010-1751-fix-plan.md` ← Next actions
- `scripts/create-production-schema.sql` ← Before ANY DB work
- `SOURCE_OF_TRUTH_Moose_Workflow.md` ← System architecture
- `iteration-1-changes-needed.md` ← Known issues

**Reference guides:**
- `WHEN_TO_READ_WHAT.md` ← Document navigation guide
- `SESSION_HANDOVER_MASTER.md` ← Comprehensive reference

**Planning:**
- `DELIVERY_PLAN_To_Production.md` ← What to build next

---

## ✅ SESSION START CHECKLIST

Copy this, check off as you go:

```
□ Read this document (SESSION_START_QUICK.md)
□ Read session-v71-20251011-1400-handover.md
□ Run git status (verify clean)
□ Check Moose UI status (http://localhost:3001)
□ Verify target repo is clean (no feature branches)
□ Understand Aider Git detection fix
□ Review STOP AND READ TRIGGERS above
□ Approve 5 WOs for Phase 1 retry
□ Start orchestrator daemon
□ Monitor for successful Git detection
```

**Estimated time to start:** 5 minutes

---

## 🎯 SUCCESS CRITERIA

**Phase 1 (Claude Sonnet 4.5):**
- Success Rate: ≥80% (4-5 of 5 WOs complete)
- Cost: <$15
- No PR conflicts or branch errors

**Phase 2 (GPT-4o-mini):**
- Success Rate: ≥80% (4-5 of 5 WOs complete)
- Cost: <$5
- Compare code quality vs Claude

**Overall Goal:**
- Determine which model produces higher quality code
- Validate cleanup procedure worked

**Budget:** <$150 total ($0 spent so far)

---

**REMEMBER:** When in doubt, check WHEN_TO_READ_WHAT.md for navigation

**Next:** Read `session-v71-20251011-1400-handover.md` for Phase 1 retry instructions

**IMPORTANT:** Phase 1 ready for retry - Aider Git detection fixed:
1. ✅ Fix Applied: Git priming step in aider-executor.ts
2. ✅ Tested: Manual Aider run successful
3. ✅ Cleanup: Target repo clean, WOs reset
4. Next: Approve 5 WOs and start Phase 1 retry
5. Monitor: Watch for "Git detection primed successfully" in logs
6. Success: ≥80% (4-5 of 5 WOs complete with commits and PRs)
7. Phase 2: After Phase 1 success (GPT-4o-mini comparison)
