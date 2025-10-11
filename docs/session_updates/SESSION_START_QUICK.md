# Session Start - Quick Reference

**Session:** v68 (Next)
**Last Session:** v67 (2025-10-10 18:35 - Documentation validation complete)
**Read Time:** 2 minutes

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

## 📊 CURRENT STATUS

**What was completed in v67:**
- ✅ Fixed ProposerConfig interface (added `model` field)
- ✅ Fixed hardcoded model names (Sonnet 3.5 → 4.5)
- ✅ Increased capacity 5x (Claude: 2→10, GPT: 4→10, Total: 3→15)

**What needs fixing before restart:**
1. 🔴 Git branch conflicts (3 WOs blocked)
2. 🔴 GitHub PR extraction (Windows JQ syntax error)
3. ✅ Database schema updated (complexity_score and project_id columns added)

**Current daemon:** STOPPED (waiting for fixes)

**Work Order Status (as of 2025-10-10 18:30):**
- Failed: 7 (14.3%)
- In Progress: 19 (38.8%)
- Pending: 23 (46.9%)
- Completed: 0

**Full details:** `session_updates/session-v67-20251010-1751-fix-plan.md`

---

## 🎯 IMMEDIATE NEXT ACTIONS

**Do these in order:**

1. **Read full handover**
   - Read: `session_updates/session-v67-20251010-1751-fix-plan.md`
   - Understand all 3 critical fixes needed

2. **Check current state**
   ```bash
   git status
   powershell.exe -File scripts/run-with-env.ps1 scripts/check-project-status.ts
   ```

3. **Apply fixes from v67 plan**
   - Follow fix plan document exactly
   - Test each fix before proceeding

4. **Restart orchestrator when ready**
   ```bash
   powershell.exe -File scripts/run-with-env.ps1 scripts/orchestrator-daemon.ts
   # Use run_in_background: true
   ```

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
□ Read session-v67-20251010-1751-fix-plan.md
□ Run git status
□ Check work order status
□ Understand 3 critical fixes needed
□ Review STOP AND READ TRIGGERS above
□ Proceed with immediate actions
```

**Estimated time to start:** 5-10 minutes

---

## 🎯 SUCCESS CRITERIA

**Your goal:**
- Apply 3 critical fixes from v67
- Restart orchestrator
- Monitor execution
- Document results

**Budget:** <$150 total (currently ~$0.50 spent)
**Target:** >60% work order success rate

---

**REMEMBER:** When in doubt, check WHEN_TO_READ_WHAT.md for navigation

**Next:** Read `session-v67-20251010-1751-fix-plan.md` for detailed fix instructions
