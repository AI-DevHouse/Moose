# When to Read What - Navigation Guide

**Purpose:** Quick reference for which document to read in each situation
**Read time:** 1 minute to scan, 30 seconds to find what you need

---

## 🚀 SESSION START

**Situation:** Starting a new Claude Code session

```
1. SESSION_START.txt (2 lines) → copy/paste to start
2. SESSION_START_QUICK.md (this loads everything)
3. Latest session handover (check date/time)
```

**Time:** 5-10 minutes total

---

## 💾 DATABASE WORK

**Situation:** ANY database query, migration, or modification

```
🚨 MANDATORY: scripts/create-production-schema.sql
```

**Read:**
- Full schema before ANY work
- Verify column names exactly
- Check data types and constraints

**Common traps:**
- `proposer_configs.active` NOT `is_active`
- `proposer_configs.model` NOT `model_name`
- `contracts.is_active` (different from proposer_configs!)

**Time:** 2-5 minutes to verify columns

---

## ✏️ CODE EDITING

**Situation:** About to edit any TypeScript/JavaScript file

```
🚨 MANDATORY: Read COMPLETE file first
```

**Use:** Read tool on full file

**Why:**
- Line numbers shift with changes
- Need context to avoid breaking changes
- Dependencies may not be obvious

**Exceptions:** None. Always read first.

---

## 🏗️ ARCHITECTURE QUESTIONS

**Situation:** Don't understand how system works OR planning changes

```
📖 READ: session_updates/SOURCE_OF_TRUTH_Moose_Workflow.md
```

**Key Sections:**
- Lines 1-300: Overall architecture
- Lines 300-600: Component details
- Lines 600-900: Execution workflow
- Lines 900-1100: Database schema overview

**When to read:**
- Confused about component interaction
- Planning new features
- Understanding execution flow
- Debugging complex issues

**Time:** 10-20 minutes for relevant section

---

## 🐛 FAILURES & ERRORS

**Situation:** Work orders failing OR investigating errors

```
📖 READ: session_updates/iteration-1-changes-needed.md
```

**Contains:**
- 12 documented issues from iteration 1
- Error patterns and classifications
- Known workarounds

**Also check:**
- Latest session handover (may have recent fixes)
- `outcome_vectors` table (failure_class column)
- `decision_logs` table (routing decisions)

**Time:** 5-10 minutes to scan for patterns

---

## 📋 PLANNING NEXT STEPS

**Situation:** Don't know what to build/fix next

```
📖 READ: session_updates/DELIVERY_PLAN_To_Production.md
```

**Key Sections:**
- Lines 1366-1514: Current status & phase tracking
- Lines 20-90: What needs completion
- Lines 150-1300: Detailed phase breakdown

**When to read:**
- After completing a milestone
- Planning next development phase
- Prioritizing work

**Time:** 5 minutes for status, 15-20 for full plan

---

## 🧠 LEARNING SYSTEM

**Situation:** Working on self-improvement features

```
📖 READ: session_updates/TECHNICAL_PLAN_Learning_System.md
```

**Key Sections:**
- Phase 0 (Foundation): Lines 1-200 ✅ COMPLETE
- Phase 1 (Feedback Loops): Lines 200-500 ✅ COMPLETE
- Phase 2 (Supervised Improvement): Lines 500-900 ❌ NOT STARTED

**When to read:**
- Implementing learning features
- Understanding failure classification
- Building improvement proposals

**Time:** 10-30 minutes depending on phase

---

## 📝 END OF SESSION

**Situation:** Session ending OR major milestone reached

```
📖 READ: SESSION_HANDOVER_MASTER.md (Update Instructions)
```

**Section:** Lines 415-543 (Update Instructions)

**What to do:**
1. Create session handover with timestamp
2. Update MASTER if major milestone
3. Document findings
4. Update iteration tracking if needed

**Template:** Lines 486-507 (Session-Specific Handover Template)

**Time:** 5-10 minutes to create handover

---

## 🆘 STUCK OR CONFUSED

**Situation:** General confusion OR need methodology guidance

```
📖 READ: SESSION_HANDOVER_MASTER.md
```

**Use Table of Contents to jump to:**
- Critical Methodology Rules (Lines 102-197)
- System Overview (Lines 200-256)
- Troubleshooting Reference (Lines 596-623)
- Common Issues & Solutions (Lines 598-623)

**When to read:**
- Forgot a critical rule
- Need command reference
- Hit common error
- Need recovery procedure

**Time:** 2-5 minutes for specific section

---

## 🔍 SPECIFIC SCENARIOS

### Scenario: "Aider is using wrong model"
```
📖 READ: session_updates/session-v66-20251010-1658-handover.md
WHERE: Bug #1 (Lines 24-39)
FIX: aider-executor.ts:177 - use proposer.model not proposer.name
```

### Scenario: "Budget limit exceeded but should be unlimited"
```
📖 READ: session_updates/session-v66-20251010-1658-handover.md
WHERE: Bug #2 (Lines 41-59)
CHECK: 3 locations + RPC function
```

### Scenario: "Capacity timeout errors"
```
📖 READ: session_updates/session-v67-20251010-1751-fix-plan.md
WHERE: Completed fixes section
NOTE: Capacity increased to 10/10, timeout 600s
```

### Scenario: "Git branch already exists"
```
📖 READ: session_updates/session-v67-20251010-1751-fix-plan.md
WHERE: Critical Fix #1 (Git branch conflicts)
```

### Scenario: "GitHub PR extraction fails"
```
📖 READ: session_updates/session-v67-20251010-1751-fix-plan.md
WHERE: Critical Fix #2 (JQ syntax error)
```

---

## 📊 DOCUMENT DECISION TREE

```
Start new session?
  → SESSION_START_QUICK.md

Database work?
  → scripts/create-production-schema.sql (MANDATORY)

Code editing?
  → Read full file first (MANDATORY)

Architecture question?
  → SOURCE_OF_TRUTH_Moose_Workflow.md

Error/failure?
  → iteration-1-changes-needed.md
  → Latest session handover

What to build next?
  → DELIVERY_PLAN_To_Production.md

Learning system work?
  → TECHNICAL_PLAN_Learning_System.md

Session ending?
  → SESSION_HANDOVER_MASTER.md (Update Instructions)

Stuck/confused?
  → SESSION_HANDOVER_MASTER.md (use ToC)

Specific bug?
  → Check latest 2-3 session handovers
```

---

## 📁 FILE LOCATIONS

**All in:** `docs/session_updates/`

**Session materials:**
- `SESSION_START.txt` ← 2-line prompt
- `SESSION_START_QUICK.md` ← Quick start (read first)
- `WHEN_TO_READ_WHAT.md` ← This file
- `session-vXX-YYYYMMDD-HHMM-[type].md` ← Session handovers

**Reference docs:**
- `SESSION_HANDOVER_MASTER.md` ← Comprehensive guide
- `SOURCE_OF_TRUTH_Moose_Workflow.md` ← Architecture
- `DELIVERY_PLAN_To_Production.md` ← Roadmap
- `TECHNICAL_PLAN_Learning_System.md` ← Learning system

**Tracking:**
- `iteration-1-changes-needed.md` ← Known issues

**Schema (not in session_updates):**
- `scripts/create-production-schema.sql` ← Database schema

---

## 🎯 READING PRIORITY

**ALWAYS read (mandatory):**
1. Schema before database work
2. Full file before code editing
3. Latest session handover at session start

**Read when triggered (see situations above):**
4. SOURCE_OF_TRUTH for architecture
5. iteration-1-changes-needed for errors
6. DELIVERY_PLAN for planning

**Reference only (when stuck):**
7. SESSION_HANDOVER_MASTER
8. TECHNICAL_PLAN_Learning_System

---

## ⏱️ TIME BUDGET

**Quick references:** 30 seconds - 2 minutes
- This file (find what to read)
- SESSION_START_QUICK.md (session start)
- Schema (verify column name)

**Focused reading:** 5-10 minutes
- Session handover (specific sections)
- iteration-1-changes-needed (error patterns)
- DELIVERY_PLAN status section

**Deep reading:** 15-30 minutes
- SOURCE_OF_TRUTH (architecture)
- TECHNICAL_PLAN (learning system)
- Full MASTER document

**Total at session start:** 5-10 minutes max

---

## 💡 TIPS

1. **Bookmark this file** - It's your navigation hub
2. **Check timestamps** - Latest session handover = highest HHMM
3. **Use triggers** - Don't guess, follow IF/THEN rules
4. **Scan first** - Use ToC and line numbers to jump
5. **Trust the process** - These rules exist because mistakes happened

---

**Remember:** When in doubt, follow the triggers. They're designed to prevent the most common mistakes.

**Last Updated:** 2025-10-10 18:20
