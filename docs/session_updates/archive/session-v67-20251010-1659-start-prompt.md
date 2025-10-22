# Session Start Prompt v67 - Rebuild and Restart Iteration 1

## Context

Read the complete handover document first:
```
C:\dev\moose-mission-control\docs\session-v66-handover.md
```

## Current Status

✅ **All critical bugs FIXED:**
- ✅ Aider model bug (Claude 3.5 → 4.5)
- ✅ Budget limits removed (all set to unlimited)
- ✅ Capacity timeout bug (60s → 600s, fixed in v65)
- ✅ Complexity score column added to database
- ✅ Test work orders deleted (6 removed)

📊 **Work Order Status:**
- **Failed:** 32 (need to reset to pending)
- **In Progress:** 19
- **Pending:** 29
- **Total:** 80 work orders

💰 **Budget:** $16.37 / $150 (10.9% used)

---

## Your Task

**Primary:** Rebuild application, reset failed WOs, restart orchestrator daemon

**Expected Duration:** 30-60 minutes for full iteration

**Expected Outcome:** 62-81% success rate (50-65 WOs succeed)

---

## Immediate Actions

### 1. Rebuild Application (REQUIRED)

All code fixes have been applied but not yet compiled:

```bash
npm run build
```

**Expected:** Should complete with 0 errors

**If build fails:** Check for TypeScript errors and fix

### 2. Create Script to Reset Failed WOs

Create `scripts/reset-failed-wos.ts`:

```typescript
// Reset all failed work orders to pending status
import { createSupabaseServiceClient } from '@/lib/supabase';

async function resetFailedWOs() {
  const supabase = createSupabaseServiceClient();

  // Get all failed WOs
  const { data: failedWOs } = await supabase
    .from('work_orders')
    .select('id, title')
    .eq('status', 'failed');

  console.log(`Found ${failedWOs?.length || 0} failed work orders`);

  if (!failedWOs || failedWOs.length === 0) {
    console.log('No failed work orders to reset');
    return;
  }

  // Reset to pending and clear error metadata
  const { error } = await supabase
    .from('work_orders')
    .update({
      status: 'pending',
      metadata: {} as any  // Clear all metadata including errors
    })
    .eq('status', 'failed');

  if (error) {
    console.error('Error resetting work orders:', error);
    return;
  }

  console.log(`✅ Reset ${failedWOs.length} work orders to pending`);
}

resetFailedWOs().catch(console.error);
```

**Then run:**
```bash
powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/reset-failed-wos.ts
```

### 3. Restart Orchestrator Daemon

Start the orchestrator in the background:

```bash
powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/orchestrator-daemon.ts
```

**IMPORTANT:** Use `run_in_background: true` parameter in Bash tool

**Monitor with:** BashOutput tool (use returned bash_id)

### 4. Monitor Execution

Check status every 10-15 minutes:

```bash
powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/check-project-status.ts
```

**What to look for:**
- Is daemon still running?
- How many WOs completed/failed/pending?
- Any new error patterns?

### 5. When Complete, Analyze Results

Run final analysis:

```bash
# Final status
powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/check-project-status.ts

# Detailed WO list
powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/check-all-wos.ts
```

Update `docs/iteration-1-changes-needed.md` with:
- Final success rate
- Failure patterns
- Cost breakdown
- Recommendations

---

## CRITICAL SESSION RULES (FROM USER)

### Rule 1: Read Schema Before Editing

**ALWAYS read complete schema before ANY database/query changes:**

```bash
Read: C:\dev\moose-mission-control\scripts\create-production-schema.sql
```

**Common mistakes to avoid:**
- ❌ Using `is_active` (wrong - it's `active` in proposer_configs)
- ❌ Using `model_name` (wrong - it's `model` in proposer_configs)
- ✅ Check schema first, then query/modify

**Schema locations in code:**
- Line 44: `proposer_configs.active` (NOT `is_active`)
- Line 40: `proposer_configs.model` (NOT `model_name`)
- Line 104: `contracts.is_active` (different naming!)

### Rule 2: Read Complete Files Before Editing

**Never edit without reading entire file first:**
- Use Read tool to see full file
- Verify line numbers match current state
- Check context around changes
- Understand what code does before modifying

### Rule 3: Minimize Terminal Output

**User wants concise responses:**
- Keep terminal output short
- Write longer analysis to files
- Reference file paths instead of pasting content
- Goal: Maximize working time before context limit

**Good:**
```
✅ Analysis complete. See: analysis-results.md
✅ 5 PRs created successfully
```

**Bad:**
```
❌ [500 lines of JSON output]
❌ [Complete file contents pasted]
❌ [Verbose explanations in terminal]
```

### Rule 4: Use Files for Documentation

**Create files, don't paste:**
- Write analysis to `.md` files
- Save logs to `.txt` files
- Reference paths in responses
- Let user read at their pace

### Rule 5: DO NOT Kill Running Daemon

**Monitor, don't interrupt:**
- Use BashOutput tool to check progress
- DO NOT use KillShell unless explicitly instructed
- Daemon processes are valuable long-running state

---

## Key Files Reference

**Main tracking doc:**
```
C:\dev\moose-mission-control\docs\iteration-1-changes-needed.md
```
- 12 issues documented
- Use this to track findings

**Handover doc (READ THIS!):**
```
C:\dev\moose-mission-control\docs\session-v66-handover.md
```
- Complete session history
- All bugs fixed
- What to do next

**Schema (READ BEFORE QUERYING!):**
```
C:\dev\moose-mission-control\scripts\create-production-schema.sql
```

**Status check scripts:**
```bash
# Overall status
scripts/check-project-status.ts

# Detailed WO list
scripts/check-all-wos.ts

# Specific WO details
scripts/check-wo-details.ts [wo-id]

# Proposer routing
scripts/check-proposers.ts
```

---

## Project Context

**Project:** Multi-LLM Discussion App v1 (Electron desktop app)
- **Local path:** C:\dev\multi-llm-discussion-v1
- **GitHub:** https://github.com/AI-DevHouse/multi-llm-discussion-v1
- **Supabase project:** f73e8c9f-1d78-4251-8fb6-a070fd857951
- **Budget:** $150
- **Work orders:** 80 total (49 original + decomposition, minus 6 test WOs)

**What's been fixed:**
- Aider model bug (using correct Claude 4.5 model ID)
- Budget limits (all set to unlimited)
- Capacity timeout (600s instead of 60s)
- Complexity score (now direct column in database)

---

## Success Criteria

**Target:** >60% success rate (48+ of 80 WOs succeed)
**Budget:** <$150 total
**Quality:** Code builds and runs

**Expected Outcome:**
- Post-fixes: 62-81% success rate
- Budget: Well under limit
- 28/32 failures should resolve (87.5% recovery)

---

## What Was Fixed in Session v66

**Bug #1: Aider Model Selection (CRITICAL)**
- **File:** `src/lib/orchestrator/aider-executor.ts:177`
- **Problem:** Used `proposerConfig.name` → Aider interpreted as Claude 3.5
- **Fix:** Now uses `proposerConfig.model` → Correct Claude 4.5 model ID
- **Status:** ✅ FIXED, needs rebuild

**Bug #2: Budget Limits (CRITICAL)**
- **Files:** 3 locations with hardcoded limits ($20/$50/$100)
- **Fix:** All set to unlimited (999999) in database
- **Status:** ✅ FIXED, SQL applied

**Bug #3: Complexity Score Column**
- **File:** `result-tracker.ts:45, 188`
- **Fix:** Now writes complexity_score as direct column
- **Status:** ✅ FIXED, SQL applied, needs rebuild

**TypeScript Error Fix:**
- **File:** `result-tracker.ts:209`
- **Fix:** Removed duplicate variable declaration
- **Status:** ✅ FIXED, needs rebuild

---

## Expected Timeline

**From start:**
- +5 min: Rebuild complete
- +10 min: Reset WOs, start daemon
- +20 min: ~3 PRs expected
- +35 min: ~6 PRs expected
- +50 min: ~9 PRs expected
- +60 min: Possibly complete or nearly complete

**If complete:**
- Run final analysis
- Calculate success rate
- Document findings
- Plan next steps

**If still running:**
- Continue monitoring
- Check for new issues
- Be patient (WOs take 3-5 min each)

---

## Quick Start Checklist

On session start, do this:

- [ ] Read handover doc: `docs/session-v66-handover.md`
- [ ] Rebuild application: `npm run build`
- [ ] Create reset script: `scripts/reset-failed-wos.ts`
- [ ] Reset failed WOs to pending
- [ ] Start orchestrator daemon (background)
- [ ] Monitor every 10-15 min
- [ ] When done: Analyze results
- [ ] Update: `docs/iteration-1-changes-needed.md`
- [ ] Document: Final metrics and recommendations

---

**Start by reading the handover doc, then rebuild. Good luck! 🚀**
