# Moose Mission Control - Master Session Handover

**Document Type:** Consolidated Session Handover & Methodology Guide
**Version:** 1.2
**Created:** 2025-10-10
**Last Updated:** 2025-10-10 18:20 (Session v67)
**Status:** ACTIVE - Comprehensive reference (start with SESSION_START_QUICK.md)
**Location:** `docs/session_updates/SESSION_HANDOVER_MASTER.md`

**📌 For quick start:** Read `SESSION_START_QUICK.md` first, use this as reference
**📌 For navigation:** See `WHEN_TO_READ_WHAT.md` to find specific sections

---

## 📋 TABLE OF CONTENTS

1. [Quick Start Checklist](#quick-start-checklist)
2. [Current Status (Session v67)](#current-status-session-v67)
3. [Critical Methodology Rules](#critical-methodology-rules)
4. [System Overview](#system-overview)
5. [Project Goals & Context](#project-goals--context)
6. [Key Reference Documents](#key-reference-documents)
7. [Common Commands](#common-commands)
8. [Update Instructions](#update-instructions)

---

## 🚀 QUICK START CHECKLIST

**At the start of EVERY session, do this in order:**

- [ ] 1. Read this document (SESSION_HANDOVER_MASTER.md)
- [ ] 2. Read latest session-specific handover (see [Current Status](#current-status-session-v67))
- [ ] 3. Check git status to see uncommitted changes
- [ ] 4. Review project status if orchestrator is running
- [ ] 5. Apply the [Critical Methodology Rules](#critical-methodology-rules)

**Time Required:** 5-10 minutes

---

## 📊 CURRENT STATUS (Session v67)

**Last Session:** v67 (2025-10-10 18:30) - Documentation validation & fixes

### Latest Session Handover Documents

**READ THESE IN ORDER:**

1. **Primary Handover:** `docs/session_updates/session-v67-20251010-1830-documentation-fixes.md`
   - **MOST RECENT** - Documentation validation results
   - Schema updated (complexity_score, project_id columns added)
   - Component status clarified
   - Database setup instructions added

2. **Code Fix Plan:** `docs/session_updates/session-v67-20251010-1751-fix-plan.md`
   - Code fixes still needed (git branch conflicts, PR extraction)
   - Capacity increases completed
   - Model fixes completed

3. **Session v66 Background:** `docs/session_updates/session-v66-20251010-1658-handover.md`
   - Context on bugs fixed in v66
   - Failure analysis from iteration 1
   - Expected recovery rates

4. **Full Session Context:** `docs/session_updates/session-v66-v67-20251010-1753-full-log.txt`
   - Complete conversation log from v66→v67
   - Useful for understanding decision context

**Naming Convention:**
- Session handovers: `session-vXX-YYYYMMDD-HHMM-[type].md`
- Full logs: `session-vXX-vYY-YYYYMMDD-HHMM-full-log.txt`
- Types: `handover`, `start-prompt`, `fix-plan`, `analysis`, `documentation-fixes`

### Current State Summary

✅ **COMPLETED IN SESSION v67:**
1. Fixed missing `model` field in ProposerConfig interface
2. Fixed hardcoded model names (Sonnet 3.5 → 4.5)
3. Increased capacity limits 5x (major performance improvement):
   - Claude: 2 → 10 concurrent
   - GPT: 4 → 10 concurrent
   - Total orchestrator: 3 → 15 concurrent
4. Expected impact: 10-20 min execution vs 60-90 min (5x faster)

🔴 **CRITICAL FIXES NEEDED BEFORE RESTART:**
1. **Git Branch Conflicts** - 3 WOs blocked by existing branches
2. **GitHub PR Extraction** - Windows JQ syntax error
3. **Database Schema Verification** - Check github_events.action column

📁 **Reference:** See `docs/session_updates/session-v67-20251010-1751-fix-plan.md` for detailed fix plan

### Daemon Status

**Status:** STOPPED (intentionally stopped for fixes)

**Next Action:** Apply fixes from v67 plan, then restart

**Commands:**
```bash
# After fixes are applied:
powershell.exe -File scripts/run-with-env.ps1 scripts/orchestrator-daemon.ts
```

### Project Context

**Current Test Project:** Multi-LLM Discussion App v1
- **Total Work Orders:** 49
- **Status:** Paused at ~15 in-progress when stopped
- **Budget:** $150 total
- **Spend:** ~$0.50 (minimal due to early stop)

---

## 🎯 CRITICAL METHODOLOGY RULES
<!-- SECTION MARKER: Lines 102-197 - Referenced by WHEN_TO_READ_WHAT.md -->

**These rules are MANDATORY - user explicitly requested them**

**📍 Quick Reference:** If you need these rules quickly, see SESSION_START_QUICK.md

### Rule 1: Read Schema Before ANY Database Changes

**ALWAYS read the complete schema before database queries or modifications:**

```bash
Read: C:\dev\moose-mission-control\scripts\create-production-schema.sql
```

**Why this matters:**
- Column names vary across tables (e.g., `active` vs `is_active`)
- Field names may not match expectations
- Prevents TypeScript errors and runtime bugs

**Common mistakes to avoid:**
- ❌ Using `is_active` in `proposer_configs` (correct: `active`)
- ❌ Using `model_name` (correct: `model`)
- ❌ Assuming field names without verification

**Correct approach:**
1. Read schema file FIRST
2. Verify exact column names
3. Write query/code using verified names
4. Test with small query before bulk operations

### Rule 2: Read Complete Files Before Editing

**Never edit code without reading the entire file first**

**Process:**
1. Use Read tool to view full file
2. Verify line numbers match current state
3. Understand context around the change
4. Check for dependencies and side effects
5. Make targeted edits with Edit tool

**Why this matters:**
- Line numbers shift as code changes
- Context helps avoid breaking changes
- Understanding prevents unintended side effects

### Rule 3: Minimize Terminal Output

**User wants concise responses to preserve context window**

**Good practices:**
```
✅ Analysis complete. Results in: docs/analysis-results.md
✅ Fixed 3 bugs. Details in: docs/bug-fixes.md
✅ Build successful. 0 errors.
```

**Bad practices:**
```
❌ [Pasting 500 lines of JSON]
❌ [Complete file contents in terminal]
❌ [Verbose step-by-step explanations]
```

**Strategy:**
- Write longer content to files
- Reference file paths instead of content
- Use bullet points, not paragraphs
- Goal: Maximize work before hitting context limits

### Rule 4: Use Files for Documentation

**Create files, don't paste content**

**File naming conventions:**
- Session handovers: `docs/session_updates/session-vXX-YYYYMMDD-HHMM-handover.md`
- Session plans: `docs/session_updates/session-vXX-YYYYMMDD-HHMM-fix-plan.md`
- Full logs: `docs/session_updates/session-vXX-vYY-YYYYMMDD-HHMM-full-log.txt`
- Analysis: `docs/analysis-[topic]-v[session].md` (in main docs/)
- Investigations: `docs/investigation-[issue].md` (in main docs/)
- Temporary logs: `docs/[process]-output.txt` (in main docs/)

**Benefits:**
- User can read at their own pace
- Persistent record across sessions
- Preserves context window
- Easy to reference later

### Rule 5: Respect Running Processes

**DO NOT kill daemon processes unless explicitly instructed**

**Monitoring approach:**
- Use BashOutput tool to check progress
- Check status with status scripts
- Be patient - daemons run for 30-90 minutes

**When to intervene:**
- User explicitly requests stop
- Clear error requiring restart
- Daemon has been stuck for >2 hours

---

## 🏗️ SYSTEM OVERVIEW
<!-- SECTION MARKER: Lines 200-256 - Architecture overview -->

### What is Moose Mission Control?

**Purpose:** LLM-orchestrated autonomous code generation system

**Core Workflow:**
1. **Input:** Technical specification (plain text)
2. **Decomposition:** Architect Agent breaks into work orders
3. **Execution:** Orchestrator executes work orders using LLMs
4. **Output:** GitHub pull requests with working code

### Architecture Components

**Fully Operational:**
- ✅ Architect Agent (decomposes specs → work orders)
- ✅ Orchestrator Service (main execution pipeline)
- ✅ Manager (routing decisions based on complexity)
- ✅ Proposer (code generation via Claude/GPT)
- ✅ Aider Executor (applies code changes)
- ✅ GitHub Integration (creates PRs)
- ✅ Result Tracking (costs, metrics, outcomes)
- ✅ Failure Classifier (categorizes errors)
- ✅ Decision Logger (tracks all decisions)

**Partially Implemented:**
- ⚠️ Director Agent (risk assessment + service exist, UI and full governance missing)
- ⚠️ Sentinel Agent (infrastructure exists: test-parser, flaky-detector, decision-maker, sentinel-service; not integrated into main orchestrator)
- ⚠️ Client Manager (service + escalation rules exist; option generation and UI missing)

**Learning System (In Progress):**
- ✅ Phase 0: Foundation (COMPLETE)
- ✅ Phase 1: Production Feedback (COMPLETE)
- ❌ Phase 2: Supervised Improvement (NOT STARTED)

### Key Technical Details

**Models Used:**
- Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) - Complex tasks
- GPT-4o-mini - Simple tasks

**Capacity Limits (as of v67):**
- Claude: 10 concurrent (was 2)
- GPT: 10 concurrent (was 4)
- Total: 15 concurrent orchestrator executions

**Budget Management:**
- Currently set to unlimited (999999) for testing
- 3-tier system exists: soft cap / hard cap / emergency kill
- Can be re-enabled for production

**Database:**
- Supabase PostgreSQL
- Main tables: work_orders, projects, proposer_configs, cost_tracking, outcome_vectors, decision_logs

---

## 📖 PROJECT GOALS & CONTEXT

### Primary Goal

**Enable autonomous software development at scale**

Build a system where:
1. User provides technical specification
2. System autonomously generates working code
3. Code is production-ready (builds, tests pass, PR created)
4. System learns from failures and improves

### Current Phase

**Phase:** Production Iteration Testing (Iteration 1)

**Objective:** Test full system with real-world app (Multi-LLM Discussion)

**Success Criteria:**
- >60% work order success rate
- Cost <$150
- Generated code builds and runs
- Failure patterns identified and documented

### Learning System Vision

**Long-term goal:** System that improves itself

**Approach:**
1. Execute iterations (build test apps)
2. Score quality (objective rubrics 1-10)
3. Analyze failures (using Phase 1 classification)
4. Generate improvement proposals
5. Human approves changes
6. Apply improvements to Moose
7. Repeat until quality target met (8/10 for 3 consecutive iterations)

**Status:** Infrastructure complete, supervised loop not yet implemented

---

## 📚 KEY REFERENCE DOCUMENTS

### Essential Reading (Start Here)

**System Architecture:**
- `docs/session_updates/SOURCE_OF_TRUTH_Moose_Workflow.md` - Complete system documentation
  - Version 1.3 (verified 2025-10-09)
  - All components documented with line numbers
  - Execution flow diagrams
  - Database schema reference

**Delivery Plan:**
- `docs/session_updates/DELIVERY_PLAN_To_Production.md` - Roadmap to production
  - Version 1.1 (updated 2025-10-09)
  - Phase breakdown (5 phases)
  - Timeline: 20-31 days
  - Current progress: 92% operational

**Learning System:**
- `docs/session_updates/TECHNICAL_PLAN_Learning_System.md` - Learning system specification
  - 3-phase approach (0: Foundation, 1: Feedback, 2: Improvement)
  - Phase 0 & 1: COMPLETE
  - Phase 2: NOT STARTED (5-7 days remaining)

### Session-Specific Documents

**Latest Sessions:**
- `docs/session_updates/session-v67-20251010-1751-fix-plan.md` - Current session (MOST RECENT)
- `docs/session_updates/session-v66-20251010-1658-handover.md` - Previous session context
- `docs/session_updates/session-v67-20251010-1659-start-prompt.md` - Instructions for v67 (now outdated)

**Iteration Tracking:**
- `docs/session_updates/iteration-1-changes-needed.md` - Issues discovered during iteration 1
  - 12 documented issues
  - Use this to track ongoing problems

### Technical Reference

**Database Schema:**
- `scripts/create-production-schema.sql` - **READ BEFORE ANY DB CHANGES**
  - Complete schema definition
  - All tables, columns, types, constraints

**API Endpoints:**
- `docs/api-reference.md` - API documentation (if exists)
- See SOURCE_OF_TRUTH lines 964-1066 for verified endpoints

**Orchestrator Logs:**
- `docs/Orchestrator Run Powershell(1).txt` - Last execution logs
- `docs/Orchestrator Run Powershell(Claude Response).txt` - Analysis
- `docs/Orchestrator Run Powershell(Claude Response 2).txt` - Detailed fixes

---

## ⚙️ COMMON COMMANDS

### Status Checks

```bash
# Overall project status
powershell.exe -File scripts/run-with-env.ps1 scripts/check-project-status.ts

# All work orders detail
powershell.exe -File scripts/run-with-env.ps1 scripts/check-all-wos.ts

# Specific work order
powershell.exe -File scripts/run-with-env.ps1 scripts/check-wo-details.ts [wo-id]

# Check proposer configs
powershell.exe -File scripts/run-with-env.ps1 scripts/check-proposers.ts

# Git status
git status
```

### Orchestrator Operations

```bash
# Start orchestrator daemon (background)
powershell.exe -File scripts/run-with-env.ps1 scripts/orchestrator-daemon.ts
# Use run_in_background: true in Bash tool

# Check daemon output (if running in background)
# Use BashOutput tool with bash_id from start command

# Reset failed work orders to pending
powershell.exe -File scripts/run-with-env.ps1 scripts/reset-failed-wos.ts
```

### Build & Test

```bash
# Build application
npm run build

# Run tests
npm test

# TypeScript check only
npx tsc --noEmit

# Start dev server
npm run dev
```

### Database Operations

```bash
# Check budget configuration
powershell.exe -File scripts/run-with-env.ps1 scripts/check-budget-config.ts

# Apply SQL migration (in Supabase SQL Editor)
# Copy from scripts/*.sql and run manually
```

---

## 📝 UPDATE INSTRUCTIONS
<!-- SECTION MARKER: Lines 415-543 - How to update handovers -->

### When to Update This Document

Update this master handover at the **end of each session** if:

1. ✅ **Major milestone reached** (phase completed, critical bug fixed)
2. ✅ **System architecture changed** (new component, modified workflow)
3. ✅ **Methodology rules added/changed** (user requests new rule)
4. ✅ **Critical bugs discovered** (affects future sessions)
5. ✅ **Session numbering changes** (new versioning scheme)

### How to Update

**Step 1: Update Current Status Section**

```markdown
## 📊 CURRENT STATUS (Session vXX)

**Last Session:** vXX (YYYY-MM-DD HH:MM)

### Latest Session Handover Documents

**READ THESE IN ORDER:**

1. **Primary Handover:** `docs/session-vXX-handover.md`
   - [Summary of what's in this doc]

[Update with latest session info]
```

**Step 2: Update Reference Documents**

Add new documents to "Key Reference Documents" section:
- Place session-specific docs under "Session-Specific Documents"
- Place permanent docs under appropriate category
- Remove outdated references (keep last 3-5 sessions)

**Step 3: Update System Overview (if architecture changed)**

Only update if:
- New component added/removed
- Component status changed (partial → operational)
- Major workflow changes

**Step 4: Add Critical Findings**

If session discovered critical issues:
- Add to "Critical Methodology Rules" if it's a process rule
- Add to "Common Pitfalls" subsection (create if needed)
- Document workarounds

**Step 5: Update Version & Date**

```markdown
**Version:** X.Y (increment minor for updates, major for breaking changes)
**Last Updated:** YYYY-MM-DD (Session vXX)
```

### Session-Specific Handover Template

**Create a new handover for each session:**

**Filename:** `docs/session_updates/session-vXX-YYYYMMDD-HHMM-handover.md`

**Format:** `session-v[number]-[YYYYMMDD]-[HHMM]-[type].md`
- `v[number]`: Session version (v67, v68, etc.)
- `YYYYMMDD`: Date (20251010 for Oct 10, 2025)
- `HHMM`: Time in 24hr format (1751 for 5:51 PM)
- `[type]`: handover, fix-plan, start-prompt, analysis

**Examples:**
- `session-v67-20251010-1751-fix-plan.md`
- `session-v68-20251011-0930-handover.md`
- `session-v66-v67-20251010-1753-full-log.txt`

**Required sections:**
1. Session Summary (what was accomplished)
2. Bugs Fixed / Issues Resolved
3. Current Status (WO counts, budget, daemon state)
4. Next Session Instructions (immediate actions)
5. Files Created/Modified
6. Critical Findings (if any)

**Optional sections:**
- Failure Analysis
- Code Changes
- Database Migrations
- Investigation Results

### Git Commit Message for Updates

When updating this master handover:

```
docs: Update SESSION_HANDOVER_MASTER to v67

- Updated current status section
- Added v67 fix plan reference
- Updated capacity limits (2→10 Claude)
- Documented critical fixes needed
```

---

## 🎯 SESSION START TEMPLATE

**Copy this checklist at the start of each session:**

```markdown
# Session vXX Start Checklist

Date: YYYY-MM-DD
Previous Session: vXX-1

## Pre-Session Review
- [ ] Read SESSION_HANDOVER_MASTER.md
- [ ] Read session-vXX-1-handover.md
- [ ] Check git status
- [ ] Review uncommitted changes
- [ ] Check daemon status (if applicable)

## Session Goals
1. [Primary goal]
2. [Secondary goal]
3. [Optional goal]

## Critical Reminders
- Read schema before DB changes
- Read files before editing
- Minimize terminal output
- Document in files
- Don't kill running daemons

## Status Checks Completed
- [ ] Work order status checked
- [ ] Budget verified
- [ ] Recent errors reviewed
```

---

## 🚨 CRITICAL WARNINGS

### Things That Will Break the System

1. **Modifying Moose while orchestrator is running**
   - Can cause mid-execution failures
   - Always stop daemon before code changes

2. **Database schema changes without migration**
   - Causes TypeScript type mismatches
   - Always update `src/types/supabase.ts` after schema changes

3. **Killing daemon without checking work order status**
   - WOs stuck in "in_progress" state
   - Must be manually reset to "pending"

4. **Budget limits too low during testing**
   - Blocks all execution
   - Keep unlimited (999999) for testing

5. **Wrong model names in Aider executor**
   - Uses incorrect LLM
   - Always use `proposerConfig.model` not `proposerConfig.name`

### Recovery Procedures

**If daemon stops unexpectedly:**
1. Check work order status
2. Identify WOs stuck in "in_progress"
3. Review last few WO executions for errors
4. Reset failed/stuck WOs to "pending"
5. Fix underlying issue
6. Restart daemon

**If build fails:**
1. Read error messages carefully
2. Check if schema changed (read schema file)
3. Verify imports are correct
4. Check for TypeScript type mismatches
5. Fix errors, rebuild

**If work orders fail repeatedly:**
1. Check failure classification in outcome_vectors
2. Look for patterns (same failure_class?)
3. Review decision_logs for routing decisions
4. Check if model capacity is blocked
5. Investigate root cause before retrying

---

## 📞 TROUBLESHOOTING REFERENCE
<!-- SECTION MARKER: Lines 596-623 - Common issues and fixes -->

### Common Issues & Solutions

**Issue: "Cannot find module" error**
- Cause: Import path incorrect or file moved
- Solution: Verify file exists, check import path

**Issue: "Column does not exist" database error**
- Cause: Schema out of sync with code
- Solution: Read schema file, verify column names

**Issue: Work orders stuck in "in_progress"**
- Cause: Daemon crashed mid-execution
- Solution: Reset to "pending" and restart

**Issue: Budget limit exceeded (when unlimited)**
- Cause: Hardcoded limits in code
- Solution: Check all 3 locations (see v66 handover)

**Issue: Aider using wrong model**
- Cause: Using `proposerConfig.name` instead of `.model`
- Solution: Update aider-executor.ts line 177

**Issue: Capacity timeout errors**
- Cause: Concurrency limits too low or timeout too short
- Solution: Increase limits (now 10/10) or timeout (now 600s)

---

## 📈 SUCCESS METRICS

### Current Targets

**Iteration 1 (Current):**
- Success Rate: >60% (30+ of 49 WOs)
- Budget: <$150
- Quality: Code builds and tests pass

**Learning System (Phase 2):**
- Quality Score: ≥8/10 for 3 consecutive iterations
- Improvement Rate: Measurable increase iteration-over-iteration
- Auto-Resolution: 70% of failures self-resolve

**Production (End Goal):**
- Success Rate: >90%
- Cost per WO: <$2 average
- Execution Time: <10 min average
- Uptime: >99%

---

## 🏁 END OF MASTER HANDOVER

**Remember:**
1. Read this document first each session
2. Read latest session-specific handover second
3. Apply Critical Methodology Rules always
4. Update this document when sessions complete major milestones
5. Create session-specific handovers for detailed context

**Current Version:** 1.3
**Last Updated:** 2025-10-10 18:35
**Last Session:** v67 (documentation validation complete)
**Next Session:** v68 (apply code fixes from v67, then restart orchestrator)

**Use this document as reference. Start with SESSION_START_QUICK.md ✅**

---

## 📁 DOCUMENT ORGANIZATION

**All session materials now in:** `docs/session_updates/`

**Navigation System:**
```
SESSION_START.txt (2 lines)
    ↓
SESSION_START_QUICK.md (quick start with triggers)
    ↓ (when triggered)
WHEN_TO_READ_WHAT.md (navigation guide)
    ↓
SESSION_HANDOVER_MASTER.md (comprehensive reference)
Other reference docs (as needed)
```

**File Structure:**
```
docs/
├── session_updates/           # Session handovers and reference docs
│   ├── SESSION_START.txt         # 2-line prompt
│   ├── SESSION_START_QUICK.md    # Quick start (read first!)
│   ├── WHEN_TO_READ_WHAT.md      # Navigation guide
│   ├── SESSION_HANDOVER_MASTER.md # This file (reference)
│   ├── README.md                 # Folder organization
│   ├── SOURCE_OF_TRUTH_Moose_Workflow.md
│   ├── DELIVERY_PLAN_To_Production.md
│   ├── TECHNICAL_PLAN_Learning_System.md
│   ├── iteration-1-changes-needed.md
│   ├── session-v67-20251010-1751-fix-plan.md
│   ├── session-v66-20251010-1658-handover.md
│   └── ...
├── [analysis/investigation files]  # Ad-hoc analysis
└── [temporary logs]                # Orchestrator logs, etc.
```

**Change Log v1.3 (2025-10-10 18:35):**
- Validated all 47 factual claims in documentation (83% accurate before fixes)
- Updated database schema to v2 (added complexity_score, project_id columns)
- Corrected component operational status (Sentinel, Director, Client Manager)
- Added database setup checklist to quick start guide
- Created validation report: docs/documentation-validation-report-20251010.md
- Created session handover: session-v67-20251010-1830-documentation-fixes.md

**Change Log v1.2 (2025-10-10 18:20):**
- Added section markers for easier navigation
- Created SESSION_START_QUICK.md (quick start with triggers)
- Created WHEN_TO_READ_WHAT.md (navigation guide)
- Implemented IF/THEN trigger system
- Changed role to comprehensive reference vs primary start point

**Change Log v1.1 (2025-10-10 18:15):**
- Reorganized all session files into `session_updates/` folder
- Implemented timestamp-based naming convention
- Updated all path references to new location
- Added naming convention documentation
- Moved reference documents (SOURCE_OF_TRUTH, DELIVERY_PLAN, TECHNICAL_PLAN)
