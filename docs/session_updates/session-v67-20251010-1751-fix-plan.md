# Session v67 - Fix Plan & Current Status

**Date:** 2025-10-10
**Session:** v67 (continuation from v66)
**Daemon Status:** STOPPED (ready for fixes before restart)

---

## ✅ COMPLETED IN THIS SESSION

### 1. **Fixed Missing `model` Field in ProposerConfig**
- **Problem:** TypeScript build failing - ProposerConfig interface didn't match database schema
- **Fix:** Added `model: string` field to interface, updated all references
- **Files Changed:**
  - `src/lib/proposer-registry.ts` - Added model field to interface and SELECT query
  - `src/lib/orchestrator/aider-executor.ts` - Use proposer.model instead of hardcoded
  - `src/app/api/proposers/route.ts` - Include model in POST/PUT routes
- **Commit:** `32fb747` - "fix: Add missing 'model' field to ProposerConfig interface"

### 2. **Fixed Hardcoded Model Names**
- **Problem:** Code was falling back to Sonnet 3.5 instead of Sonnet 4.5
- **Root Cause:** 4 locations had hardcoded `'claude-3-5-sonnet-20241022'` instead of using `proposer.model`
- **Fix:** Updated all API calls to use `proposer.model` from database
- **Files Changed:**
  - `src/lib/enhanced-proposer-service.ts` - Lines 596, 638
  - `src/lib/claude-sonnet-proposer.ts` - Lines 215, 264
- **Commit:** `03874cd` - "fix: Remove hardcoded model names, use proposer.model from database"

### 3. **Increased Capacity Limits (MAJOR PERFORMANCE FIX)**
- **Problem:** Severe over-throttling - using 0.1% of available API capacity
- **Old Limits:** Claude 2 concurrent, GPT 4 concurrent, Total 3 concurrent
- **Actual API Limits:** Claude 1,000 RPM / 450,000 TPM
- **New Limits:** Claude 10 concurrent, GPT 10 concurrent, Total 15 concurrent
- **Files Changed:**
  - `src/lib/orchestrator/capacity-manager.ts` - 2→10 Claude, 4→10 GPT
  - `src/lib/orchestrator/orchestrator-service.ts` - 3→15 total
- **Expected Impact:** 5x faster execution (10-20 min vs 60-90 min for 49 WOs)
- **Commit:** `0d579b7` - "perf: Increase capacity limits to match actual API rate limits"

---

## 🔴 CRITICAL ISSUES TO FIX BEFORE RESTART

### **Priority 1: Git Branch Conflicts (BLOCKING 3 WOs)**

**Problem:**
```
fatal: a branch named 'feature/wo-ca68150a-...' already exists
```

**Root Cause:** `aider-executor.ts` line ~106 doesn't check for existing branches before creating

**Impact:** 3 work orders cannot proceed

**Fix Required:** 2 steps
1. **Immediate:** Delete conflicting branches in target project
2. **Code Fix:** Add branch existence check to `aider-executor.ts`

**Detailed Implementation:** See `docs/Orchestrator Run Powershell(Claude Response 2).txt` lines 3-53

**Manual Cleanup:**
```bash
cd C:/dev/e2e-test-1759944541056
git branch -D feature/wo-ca68150a-complete-documentation-build-configuration-and-production-packaging
git branch -D feature/wo-d8b748fd-build-status-indicator-system-with-real-time-activity-and-error-notifications
git branch -D feature/wo-73c43c90-implement-component-library-foundation-with-shared-ui-primitives
```

**Code Fix Location:** `src/lib/orchestrator/aider-executor.ts` - `createFeatureBranch()` function

---

### **Priority 2: GitHub PR Number Extraction (ALL WOs affected)**

**Problem:**
```
error: failed to parse jq expression... unexpected token "'"
```

**Root Cause:** Windows PowerShell quote escaping issue with gh CLI + JQ

**Impact:** Every work order fails to extract PR number (non-blocking but logs errors)

**Fix Required:** Update `github-integration.ts` to handle Windows quoting or avoid JQ

**Detailed Implementation:** See `docs/Orchestrator Run Powershell(Claude Response 2).txt` lines 108-160

**Recommended Approach:**
```typescript
// Use --json without --jq, parse JSON in code instead
const cmd = `gh pr list --head ${branchName} --json number --repo ${repo}`;
const { stdout } = execSync(cmd, { encoding: 'utf8' });
const prList = JSON.parse(stdout);
const prNumber = prList.length > 0 ? prList[0].number : null;
```

**Code Fix Location:** `src/lib/orchestrator/github-integration.ts` - PR number extraction

---

### **Priority 3: Database Schema Verification**

**Problem:** Code may be trying to write to non-existent `github_events.action` column

**Status:** NEEDS INVESTIGATION (wasn't confirmed in grep results)

**Actions:**
1. Check current `github_events` schema in Supabase
2. Either:
   - **Option A:** Add migration to add `action` column (recommended)
   - **Option B:** Update code to use `event_type` instead

**Detailed Implementation:** See `docs/Orchestrator Run Powershell(Claude Response 2).txt` lines 56-105

---

## 🟡 MEDIUM PRIORITY IMPROVEMENTS

### **Priority 4: Improve Work Order Context (Reduce Aider Questions)**

**Problem:** Some WOs show Aider asking for clarification instead of implementing

**Impact:** Delays autonomous execution, requires manual intervention

**Fix:** Add architectural context to work order instructions

**Detailed Implementation:** See `docs/Orchestrator Run Powershell(Claude Response 2).txt` lines 163-248

**Key Changes:**
1. Add architectural context section to proposer executor prompts
2. Create `.aider.context.md` file in target project
3. Add `--read` flag to Aider command to include context

---

## 🟢 LOW PRIORITY (OPTIONAL)

### **Priority 5: Terminal Warnings Suppression**

**Problem:** "Can't initialize prompt toolkit" warnings clutter logs

**Impact:** Cosmetic only

**Fix:** Set `TERM=dumb` environment variable in Aider execution

**Detailed Implementation:** See `docs/Orchestrator Run Powershell(Claude Response 2).txt` lines 321-360

---

### **Priority 6: EventEmitter Listeners**

**Problem:** Logs show "No listeners for {wo-id}, event: started/progress/completed"

**Impact:** None - informational only

**Fix Options:**
- **A:** Add event listeners if real-time monitoring needed
- **B:** Remove emit calls if not needed (recommended)

**Detailed Implementation:** See `docs/Orchestrator Run Powershell(Claude Response 2).txt` lines 363-415

---

## 📋 RECOMMENDED EXECUTION PLAN

### **Quick Fix Plan (15-20 minutes)**

**Step 1: Branch Cleanup (2 min)**
```bash
# Close orchestrator daemon window (Ctrl+C or close window)
cd C:/dev/e2e-test-1759944541056
git branch -D feature/wo-ca68150a-complete-documentation-build-configuration-and-production-packaging
git branch -D feature/wo-d8b748fd-build-status-indicator-system-with-real-time-activity-and-error-notifications
git branch -D feature/wo-73c43c90-implement-component-library-foundation-with-shared-ui-primitives
cd C:/dev/moose-mission-control
```

**Step 2: Fix Branch Creation Logic (5 min)**
- Edit `src/lib/orchestrator/aider-executor.ts`
- Add branch existence check in `createFeatureBranch()` function
- See detailed code in `docs/Orchestrator Run Powershell(Claude Response 2).txt` lines 12-50

**Step 3: Fix GitHub PR Extraction (5 min)**
- Edit `src/lib/orchestrator/github-integration.ts`
- Remove JQ, parse JSON directly
- See detailed code in `docs/Orchestrator Run Powershell(Claude Response 2).txt` lines 152-159

**Step 4: Verify Database Schema (3 min)**
- Check if `github_events` table has `action` column
- If not, decide: add column OR update code to use `event_type`

**Step 5: Rebuild & Restart (3 min)**
```bash
npm run build
powershell.exe -File scripts/run-with-env.ps1 scripts/orchestrator-daemon.ts
```

---

## 🔍 CURRENT WORK ORDER STATUS

**Total WOs:** 49
**Status Before Stop:**
- ⏳ In Progress: 3 WOs (actively running when stopped)
- ⏸️ Pending: 34 WOs (waiting to execute)
- ❌ Failed: 3 WOs (branch conflicts)
- ✅ Completed: Unknown (likely some completed before stop)

**Failed WOs (Branch Conflicts):**
1. `ca68150a` - Complete Documentation, Build Configuration, and Production Packaging
2. `d8b748fd` - Build Status Indicator System with Real-Time Activity and Error Notifications
3. `73c43c90` - Implement Component Library Foundation with Shared UI Primitives

---

## 📊 EXPECTED PERFORMANCE AFTER FIXES

**Before Fixes:**
- Capacity: 2 Claude concurrent (severe bottleneck)
- Total: 3 concurrent max
- Throughput: ~0.5-1 req/min
- Time for 49 WOs: 60-90 minutes

**After Fixes:**
- Capacity: 10 Claude concurrent (5x increase)
- Total: 15 concurrent max
- Throughput: ~150-300 req/hour
- Time for 49 WOs: 10-20 minutes
- Branch conflicts: Eliminated
- PR extraction: Working correctly

---

## 📝 HANDOVER NOTES

### **What's Already Done:**
✅ Model field fixes (Sonnet 4.5 now works)
✅ Capacity limits increased 5x
✅ All code committed to main branch
✅ Build successful (0 TypeScript errors)

### **What's Needed Next:**
🔴 Fix branch conflicts (delete existing branches + add code check)
🔴 Fix PR number extraction (Windows JQ issue)
🟡 Verify database schema (github_events.action column)
🟡 Add work order context (reduce Aider questions)

### **Reference Documents:**
- **Detailed Fixes:** `docs/Orchestrator Run Powershell(Claude Response 2).txt`
- **Analysis:** `docs/Orchestrator Run Powershell(Claude Response).txt`
- **Logs:** `docs/Orchestrator Run Powershell(1).txt`
- **Session Handover:** `docs/session-v66-handover.md`

### **Key Files to Edit:**
1. `src/lib/orchestrator/aider-executor.ts` - Branch creation logic
2. `src/lib/orchestrator/github-integration.ts` - PR number extraction
3. `src/lib/orchestrator/result-tracker.ts` - Database writes (if action column missing)

### **Commands for Next Session:**
```bash
# Check current status
powershell.exe -File scripts/run-with-env.ps1 scripts/check-project-status.ts

# After fixes, restart daemon
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit', '-File', 'scripts/run-with-env.ps1', 'scripts/orchestrator-daemon.ts' -WindowStyle Normal"

# Monitor progress
powershell.exe -File scripts/run-with-env.ps1 scripts/check-project-status.ts
```

---

## 🎯 SUCCESS CRITERIA

**Immediate:**
- [ ] No branch conflict errors
- [ ] PR numbers extracted successfully
- [ ] All database writes succeed
- [ ] 10+ WOs executing concurrently
- [ ] No "waiting for capacity" messages

**Final:**
- [ ] All 49 WOs complete successfully
- [ ] Total execution time < 30 minutes
- [ ] Success rate > 80%
- [ ] No critical errors in logs

---

**End of Fix Plan**
**Next Action:** Execute Quick Fix Plan above, then restart orchestrator
