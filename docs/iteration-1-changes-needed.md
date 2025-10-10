# Iteration 1: Multi-LLM Discussion v1 - Changes & Learnings

**Date Started:** 2025-10-10
**Project:** Multi-LLM Discussion App v1 (Electron desktop app)
**Purpose:** Track all issues, changes, and improvements needed in Moose during first real production test

**Status:** ✅ All 6 critical bugs fixed, orchestrator ready for restart

---

## Bug Fix Summary

### First Run Results (2025-10-10 13:16)
- **Outcome:** 100% failure rate (0/21 succeeded, 21 failed, 28 never attempted)
- **Root Cause:** 6 critical bugs in infrastructure
- **Action Taken:** All 49 work orders reset to "pending" after fixing bugs

### Bugs Fixed (2025-10-10 - Bug Fix Session)
1. ✅ **Bug #6:** Created initial commit in project repo (git branch creation blocked)
2. ✅ **Bug #1:** Added `failure_class`, `error_context`, `test_duration_ms` columns to `outcome_vectors`
3. ✅ **Bug #2:** Increased branch name limit from 30→80 chars (aider-executor.ts:88)
4. ✅ **Bug #3:** Increased capacity timeout from 60s→600s (capacity-manager.ts:158)
5. ✅ **Bug #5:** Auto-approval metadata now added by Architect (decompose/route.ts:225-229)
6. ✅ **Bug #4:** Incremental saves after each section (decompose/route.ts:115-158)

**Build Status:** ✅ Passes (npm run build successful)
**Ready for:** Orchestrator restart with 49 pending work orders

---

## Pre-Execution Setup

### What Was Done Manually (Not by Moose):
1. ✅ Created Supabase project `multi-llm-discussion-v1`
   - URL: `https://czwzmvrsfcuexudqiscr.supabase.co`
   - Keys obtained and stored
2. ✅ Technical spec already exists at `C:\dev\specs\Multi-LLM Discussion App_Technical Specification_ v2.2.txt`
3. ⏳ GitHub repo creation: Will be handled by setup script

### Setup Script Created:
- `scripts/setup-real-project.ts` - Automates project creation

---

## Issues Discovered

### Issue 1: Setup Script - Wrong Column Name (metadata vs setup_notes)
**Category:** Setup Script / Database Schema
**Description:** Setup script tried to use `metadata` column in projects table, but actual column is `setup_notes`
**Impact:** Medium - Caused setup failure, required manual fix
**Workaround:** Changed `metadata` to `setup_notes` in setup script
**Fix Needed in Moose:** No - This was in our test script, not Moose core. But good reminder to check schema before writing to DB.
**Discovered:** 2025-10-10 09:52

### Issue 2: Setup Script Not Idempotent
**Category:** Setup Script / DevEx
**Description:** If setup script fails partway through, it leaves artifacts (directory, GitHub repo) that block retry
**Impact:** Medium - Required manual cleanup and workaround
**What Was Left Behind:**
- ✅ GitHub repo created: `AI-DevHouse/multi-llm-discussion-v1`
- ✅ Local directory: `C:\dev\multi-llm-discussion-v1`
- ❌ Database project: Not created (this is where it failed)
- ❌ Tech spec submission: Not done
**Workaround:**
- Keep existing GitHub repo and directory
- Add git remote manually
- Create simplified script that just does DB + tech spec steps
**Fix Needed in Moose:** No - But setup scripts should check for existing resources or be designed to be idempotent
**Discovered:** 2025-10-10 09:55

### Issue 3: Architect API Expects Structured JSON, Not Raw Text
**Category:** Architect API / Input Format
**Description:** Architect API requires `TechnicalSpec` format (feature_name, objectives, constraints, acceptance_criteria), but user has 77,081-character unstructured text document
**Impact:** High - Blocks submission to Architect
**Actual Spec Format:** Multi-section technical specification document (2583 lines, includes Executive Summary, Architecture, Components, etc.)
**Expected Format:**
```typescript
{
  feature_name: string,
  objectives: string[],
  constraints: string[],
  acceptance_criteria: string[]
}
```
**Workaround Options:**
1. Wrap raw text in `feature_name` field with instruction to parse
2. Use LLM to extract structured format from document
3. Manually extract key sections
**Fix Needed in Moose:** **YES** - Architect should handle both structured AND unstructured specs. Add a pre-processing step that uses an LLM to convert raw specs into structured format.
**Discovered:** 2025-10-10 10:00

### Issue 4: Architect Times Out on Large Spec (77K chars)
**Category:** Architect / Performance
**Description:** Architect API call timed out after 3+ minutes when processing 77,081-character technical specification
**Impact:** CRITICAL - Blocks entire test from proceeding
**Spec Size:** 2,583 lines, 77,081 characters
**Timeout:** 180 seconds (3 minutes)
**Root Cause Analysis:**
- Architect expects small structured `TechnicalSpec` (feature_name, objectives, constraints, acceptance_criteria)
- We embedded 77K spec into constraints array → massive token usage per batch
- Current batching handles work order generation, NOT spec preprocessing
**Workaround Options:**
1. ❌ Increase timeout (won't help - fundamentally wrong approach)
2. ✅ **CHOSEN: Build spec preprocessor** (see resolution below)
3. ❌ Manually extract sections (not scalable)
4. ❌ LLM summarization (loses detail)
**Fix Needed in Moose:** **YES - CRITICAL - BEING IMPLEMENTED**
**Discovered:** 2025-10-10 10:05

**RESOLUTION APPROACH:**
Create spec preprocessor as part of Architect Agent responsibility:
1. Parse large document by section headers
2. Split into logical chunks (e.g., "4.1 Main Process", "4.2 Clipboard Automation")
3. Convert each section to structured TechnicalSpec
4. Submit each section to Architect → generates WOs per section
5. Add cross-section dependencies where needed
6. Dependency resolver sequences WOs during execution (already exists)

**Benefits:**
- Preserves natural document structure
- Leverages existing dependency resolution (work-order-poller.ts)
- No changes to execution pipeline needed
- Architect handles manageable chunks

**Implementation:**
- New file: `src/lib/spec-preprocessor.ts`
- Integration point: `/api/architect/decompose` route (before batched-architect-service call)
- Treats this as Architect Agent responsibility (not separate agent)

**CURRENT STATUS:** ✅ Being implemented (2025-10-10 10:15)

---

## Changes Made During Test

### Change 1: Setup Script - Read Tech Spec from File
**What:** Modified `setup-real-project.ts` to read tech spec from file path instead of hardcoding it
**Why:** Allow Architect AI to analyze and decompose the spec (not pre-determined by us)
**Files Modified:**
- `scripts/setup-real-project.ts`
  - Added: Read tech spec from `CONFIG.techSpecPath`
  - Changed: Pass raw tech spec content to Architect (not structured JSON)
  - Removed: Hardcoded tech spec with my assumptions
**Should be in Moose?:** No - This is a one-off test script, not part of Moose core

### Change 2: Manual Git Remote Addition
**What:** Manually added git remote after partial setup failure
**Why:** Setup script failed partway, left directory and GitHub repo but no git remote
**Command Run:**
```bash
cd /c/dev/multi-llm-discussion-v1
git remote add origin https://github.com/AI-DevHouse/multi-llm-discussion-v1.git
```
**Should be in Moose?:** No - But shows setup scripts need better error handling

### Change 3: Created Completion Script
**What:** Created `scripts/complete-setup.ts` to finish setup after partial failure
**Why:** Original script not idempotent, needed to complete steps 4-6 only
**Files Created:**
- `scripts/complete-setup.ts` - Just does DB + tech spec submission
**Should be in Moose?:** No - Temporary workaround for this test

### Change 4: Implemented Spec Preprocessor (RESOLVES ISSUE 4)
**What:** Built spec preprocessor to handle large unstructured technical specs
**Why:** Architect timed out on 77K-character document; needs structured input
**Files Created:**
- `src/lib/spec-preprocessor.ts` (380 lines)
  - Parses document structure by section headers
  - Converts each section to structured TechnicalSpec using Claude
  - Adds cross-section dependencies
  - Threshold: >10K chars triggers preprocessing
**Files Modified:**
- `src/app/api/architect/decompose/route.ts`
  - Added preprocessing check before decomposition
  - Loops through sections if preprocessing needed
  - Combines work orders from all sections
  - Adds dependencies between sections
  - Response includes `preprocessing_used` flag
**How It Works:**
1. Detects if input is raw text >10K chars
2. Parses document by headers (markdown ##, numbered 4.1, Phase 1, etc.)
3. For each section:
   - Calls Claude to extract structured TechnicalSpec
   - Submits to batched-architect-service
   - Collects work orders
4. Adds dependencies between sections (sequential by default)
5. Returns combined work orders to orchestrator
**Benefits:**
- Handles real-world detailed specs (50K+ chars)
- Preserves document structure
- Leverages existing dependency resolution
- No changes to execution pipeline
- Transparent to orchestrator (just gets more WOs with dependencies)
**Should be in Moose?:** **YES - CRITICAL FEATURE**
- This is now part of Architect Agent responsibility
- Enables production use with detailed specs
**Status:** ✅ Implemented (2025-10-10 11:00)

### Issue 5: Work Order Generation - All-or-Nothing Database Write
**Category:** Architect API / Performance / Reliability
**Description:** Work order generation processes ALL sections in memory for 1-2 hours, then writes to database in one batch at the end. If process fails partway through, NO work orders are saved.
**Impact:** CRITICAL - Lost 90+ minutes of work, no incremental progress, no visibility during generation
**What Happened:**
- Spec preprocessor identified 15 sections
- AI processing started at 11:12 AM
- Made 100+ Claude API calls over 1h 47min (visible in Anthropic console)
- Process stopped at 12:59 PM (no API calls since)
- **Only 49 work orders in database** (all created at 10:14 AM and 11:05 AM)
- **No new WOs saved** despite 1h 47min of processing
**Root Cause:**
- `route.ts` (line 84-122): Loops through ALL 15 sections before DB write
- Database insert happens ONLY at line 227-230 (after all sections complete)
- If any section fails or process errors, entire batch is lost
- No progress indicators or intermediate saves
**Expected Behavior:**
- Save work orders after each section completes
- OR provide progress updates to user/logs
- OR allow resume from checkpoint
**Workaround:** None - must restart from scratch
**Fix Needed in Moose:** **YES - HIGH PRIORITY**
**Recommended Solution:**
1. **Option A (Quick Fix):** Save WOs to DB after each section completes (incremental writes)
2. **Option B (Better UX):** Stream progress to client (websocket/SSE) + incremental saves
3. **Option C (Most Robust):** Checkpointing system - save state, allow resume on failure
**Files to Modify:**
- `src/app/api/architect/decompose/route.ts` (lines 84-146)
  - Move database insert inside section loop
  - Add progress logging/streaming
**Discovered:** 2025-10-10 12:59
**Current Status:** ⏸️ Generation appears stuck/failed - waiting for timeout or manual intervention

### Issue 6: Missing Database Column - test_duration_ms
**Category:** Schema / Database
**Description:** `outcome_vectors` table missing `test_duration_ms` column that code expects
**Impact:** CRITICAL - Every work order failure cannot be tracked properly
**Error Message:** `Could not find the 'test_duration_ms' column of 'outcome_vectors' in the schema cache`
**Root Cause:** Schema mismatch between code and database
**Fix Needed:** **YES - CRITICAL**
- Add `test_duration_ms` column to `outcome_vectors` table
- Or remove references to this column in result-tracker.ts
**Discovered:** 2025-10-10 13:39
**Status:** ⚠️ BLOCKING - Prevents failure tracking

### Issue 7: Git Branch Name Truncation
**Category:** Orchestrator / Git Integration
**Description:** Git branch names being truncated to 50 characters, causing push failures
**Impact:** HIGH - Work orders fail at GitHub push stage even if code generation succeeds
**Example:**
- Expected: `feature/wo-d8d41cd4-implement-performance-optimization`
- Actual: `feature/wo-d8d41cd4-implement-performance-optimiza` (truncated)
**Error:** `error: src refspec feature/wo-d8d41cd4-implement-performance-optimiza does not match any`
**Root Cause:** Branch name generation in github-integration.ts truncates at 50 chars
**Fix Needed:** **YES - HIGH PRIORITY**
- Increase branch name length limit OR
- Use shorter, more compact naming scheme
**Files to Modify:** `src/lib/orchestrator/github-integration.ts`
**Discovered:** 2025-10-10 13:39

### Issue 8: Claude Capacity Timeout Too Short
**Category:** Orchestrator / Capacity Management
**Description:** 60-second timeout for Claude capacity wait is too short for real execution
**Impact:** MEDIUM - Causes cascading failures when multiple WOs use same model
**What Happened:**
- 3 WOs all routed to claude-sonnet-4-5 (max capacity: 2)
- First 2 started executing
- Third waited for capacity, timed out after 60s
- Marked as failed even though it could have succeeded
**Expected Behavior:** Wait longer or queue properly
**Fix Needed:** **YES - MEDIUM PRIORITY**
- Increase timeout to 5-10 minutes OR
- Implement proper queueing instead of busy-wait
**Files to Modify:** `src/lib/orchestrator/capacity-manager.ts`
**Discovered:** 2025-10-10 13:39

### Issue 9: Auto-Approval Missing from Generated Work Orders
**Category:** Architect / Workflow
**Description:** Work orders generated by Architect don't have `metadata.auto_approved = true`
**Impact:** HIGH - Orchestrator cannot execute any WOs without manual approval script
**What Happened:**
- Architect generated 49 WOs with empty metadata `{}`
- Orchestrator poller only picks up WOs with `auto_approved = true`
- Had to manually run script to add `auto_approved` flag
**Expected Behavior:** Architect should set `auto_approved: true` in metadata when generating WOs
**Workaround:** Run `scripts/approve-all-wos.ts` after generation
**Fix Needed:** **YES - HIGH PRIORITY**
**Files to Modify:** `src/app/api/architect/decompose/route.ts` (line 212-225)
**Discovered:** 2025-10-10 13:20

### Issue 10: Complexity Score Not a Direct Database Column
**Category:** Schema / Data Model
**Description:** `complexity_score` is stored in nested JSONB metadata, not as a direct column in `work_orders` table
**Impact:** MEDIUM - Makes querying and filtering by complexity difficult
**Current Storage Location:** `metadata.routing_decision.routing_metadata.complexity_score`
**Database Schema:** Per `create-production-schema.sql` lines 10-32, `work_orders` table has:
- Direct columns: `title`, `description`, `status`, `risk_level`, `proposer_id`, `estimated_cost`, `pattern_confidence`
- JSONB column: `metadata` (contains routing_decision with complexity_score nested inside)
**Example from WO `501edce0`:**
```json
{
  "metadata": {
    "routing_decision": {
      "routing_metadata": {
        "complexity_score": 0.85
      }
    }
  }
}
```
**Why This Matters:**
- Complexity score is used for routing decisions (Manager routing rules)
- Cannot easily query "show all WOs with complexity > 0.7"
- Not indexed, so filtering by complexity requires scanning entire JSONB column
- Makes analytics and reporting difficult
**Workaround:** Query JSONB with `metadata->'routing_decision'->'routing_metadata'->>'complexity_score'`
**Fix Needed:** **MAYBE - MEDIUM PRIORITY**
**Options:**
1. Add `complexity_score DECIMAL(5, 2)` column to `work_orders` table
2. Keep in metadata but add computed column/index for queries
3. Leave as-is (current implementation works, just less convenient)
**Considerations:**
- `risk_level` IS a direct column (for similar purpose)
- `pattern_confidence` IS a direct column (for similar purpose)
- Complexity score seems equally important for querying/analytics
**Files to Review:**
- `scripts/create-production-schema.sql` (table definition)
- `src/lib/orchestrator/result-tracker.ts` (stores routing decision)
- `src/lib/manager-routing-rules.ts` (uses complexity score)
**Discovered:** 2025-10-10 14:30 (during iteration restart)

### Issue 11: Orchestrator Timeout Hardcoded to 60s (BUG #7 - FIXED)
**Category:** Orchestrator / Capacity Management
**Description:** `orchestrator-service.ts:213` hardcoded 60s timeout instead of using capacity-manager's 600s default
**Impact:** CRITICAL - Caused 9/12 failures (75% failure rate) due to capacity wait timeout
**Root Cause:** Line 213 had `waitForCapacity(modelName, 60000)` instead of `waitForCapacity(modelName)`
**What Happened:**
- capacity-manager.ts defines 600s (10min) default timeout
- orchestrator-service.ts overrode it with 60s hardcoded value
- When 3 WOs all routed to claude-sonnet-4-5 (max capacity: 2), third WO waited only 60s before failing
- Caused cascading failures as more WOs queued up
**Error Classification Bug:** These failures were classified as `dependency_missing` instead of `orchestration_error`
**Fix Applied:** 2025-10-10 14:35
- Changed `waitForCapacity(modelName, 60000)` to `waitForCapacity(modelName)`
- Now uses 600s default from capacity-manager.ts:158
- Build passed, daemon restarted with fix
**Files Modified:**
- `src/lib/orchestrator/orchestrator-service.ts:213` (removed hardcoded 60000)
**Status:** ✅ FIXED
**Discovered:** 2025-10-10 14:11 (first daemon run, 9 failures)
**Resolved:** 2025-10-10 14:35 (daemon restarted with fix)

### Issue 12: Routing Decision vs Actual Proposer Mismatch
**Category:** Proposer Execution / Routing
**Description:** Work order routed to `claude-sonnet-4-5` but actually executed with `gpt-4o-mini`
**Impact:** MEDIUM - Routing decisions not being enforced, may use wrong model for task complexity
**Example from WO `501edce0`:**
- `metadata.routing_decision.selected_proposer`: `"claude-sonnet-4-5"`
- `metadata.proposer_response.proposer_used`: `"gpt-4o-mini"`
- Complexity score: `0.85` (should require claude-sonnet-4-5, threshold 0.3 for gpt-4o-mini)
**Routing Decision Context:**
```json
{
  "reason": "Single candidate for complexity 0.85: claude-sonnet-4-5",
  "routing_metadata": {
    "complexity_score": 0.85,
    "candidates_count": 1,
    "routing_strategy": "max_complexity_ceiling_with_cost_optimization"
  }
}
```
**Possible Causes:**
1. Fallback mechanism triggered (proposer failed, fell back to cheaper model)
2. Override in proposer-executor.ts
3. Cost optimization override
4. Bug in proposer selection
**Expected Behavior:** Selected proposer should match executed proposer (or log reason for override)
**Fix Needed:** **YES - MEDIUM PRIORITY** - Investigate and either:
- Fix bug if routing not being enforced
- Add clear logging when fallback/override occurs
- Store override reason in metadata
**Files to Review:**
- `src/lib/orchestrator/proposer-executor.ts` (may have override logic)
- `src/lib/enhanced-proposer-service.ts` (fallback logic)
- `src/lib/manager-routing-rules.ts` (routing decision)
**Discovered:** 2025-10-10 14:30 (analyzing first completed WO)

---

## Architect Decomposition Results

**Tech Spec Path:** `C:\dev\specs\Multi-LLM Discussion App_Technical Specification_ v2.2.txt`
**Tech Spec Type:** Electron desktop application (2583 lines)
**Budget:** $150
**Expected Work Orders:** TBD (Architect decides)

### Architect Output:
```
[Will be filled in after running setup script]
```

**Analysis:**
- **Number of work orders created:** 49 total (46 real + 3 parsing artifacts)
- **Sections processed:** Stopped after Section 2/15 (preprocessing failed)
- **Logical batching quality:** Good - 46 WOs represent complete MVP workflow
- **Dependencies identified:** Yes - WOs have dependencies, not yet validated in execution
- **Issues with decomposition:**
  - Process stopped after 1h 47min of API calls, no new WOs saved
  - Only saved WOs from first 2 sections before failure
  - 3 "Document Termination Marker" WOs are parsing artifacts (should be filtered)

**Real Work Orders (46):** Cover complete Electron app MVP
- Foundation: Project setup, Electron architecture, build system, testing (WO 1-4)
- Communication: IPC channels, type definitions, handlers (WO 5-8)
- State: Redux setup, slices, persistence, middleware (WO 9-13)
- Automation: Clipboard monitoring, paste engine, WebView injection (WO 14-18)
- Providers: LLM provider interfaces and adapters (WO 19-23)
- Services: Alignment service and Express server (WO 24-27)
- Orchestration: Discussion state machine, turn coordination (WO 28-31)
- UI: React app, components, layouts, pages (WO 32-40)
- Polish: Testing, performance, error handling, docs (WO 41-46)

---

## Execution Metrics

### Work Order Results:
| WO # | Title | Status | Time | Cost | Failure Class | Notes |
|------|-------|--------|------|------|---------------|-------|
| 1    |       |        |      |      |               |       |

### Summary Stats:
- **Total Work Orders:**
- **Completed:**
- **Failed:**
- **Success Rate:**
- **Total Cost:**
- **Total Time:**
- **Average Time per WO:**

---

## Phase 2 Data Analysis

### Failure Classification Breakdown:
```sql
SELECT failure_class, COUNT(*), AVG(cost)
FROM outcome_vectors
WHERE project_id = '[PROJECT_ID]'
GROUP BY failure_class;
```

**Results:**
[To be filled in after execution]

### Decision Logging Patterns:
```sql
SELECT decision_type, decision_result, COUNT(*)
FROM decision_logs
WHERE work_order_id IN (SELECT id FROM work_orders WHERE project_id = '[PROJECT_ID]')
GROUP BY decision_type, decision_result;
```

**Results:**
[To be filled in after execution]

---

## Quality Assessment

### Does the App Work?
- [ ] Builds successfully
- [ ] Runs without errors
- [ ] Core features functional
- [ ] Meets acceptance criteria

### Code Quality:
- **Readability:** [1-10]
- **Architecture:** [1-10]
- **Test Coverage:** [1-10]
- **Documentation:** [1-10]

### PR Quality:
- **Descriptions:** [Good / Fair / Poor]
- **Code Changes:** [Appropriate / Too Large / Too Small]
- **Commit Messages:** [Good / Fair / Poor]

---

## Recommendations for Moose

### High Priority Changes:
1.

### Medium Priority Changes:
1.

### Low Priority / Nice to Have:
1.

### Documentation Updates Needed:
1.

---

## Surprises / Unexpected Behaviors

### Positive Surprises:
1.

### Negative Surprises:
1.

### Neutral Observations:
1.

---

## Next Steps After This Test

**If Success Rate ≥ 60%:**
- [ ] Option A: Deploy to production
- [ ] Option B: Start Phase 3 (Supervised Learning)
- [ ] Option C: Run another test app

**If Success Rate < 60%:**
- [ ] Analyze failure patterns
- [ ] Fix critical issues in Moose
- [ ] Re-test with same or different app

---

## Session Notes

### Session 1: Setup & Initial Run
**Date:** 2025-10-10
**Actions:**
- Created this tracking document
- Modified setup script to read tech spec from file
-

**Issues:**
-

**Resolutions:**
-

---

## Final Summary

**Overall Assessment:** [To be filled in after completion]

**Key Takeaways:**
1.
2.
3.

**Most Important Change Needed:**


**Readiness for Production:** [Yes / No / Needs Work]

---

**Last Updated:** 2025-10-10
