# SESSION HANDOVER MASTER  
**Path:** C:\dev\moose-mission-control\docs\session_updates\SESSION_HANDOVER_MASTER.md  
**Version:** v20251014-hybrid-B  
**Purpose:** Permanent master reference for session continuity within Moose Mission Control.  
**Audience:** Developer (Court) & AI Assistants (Claude Code, GPT, etc.)

---

## 1. OVERVIEW
Defines **session workflow, behavioural rules, and context discipline.**  
This is the single source of truth for process integrity.  
Do **not** paste the entire file into an LLM unless starting from zero.

---

## 2. FILE STRUCTURE
```
C:\dev\moose-mission-control\docs\session_updates\
├── SESSION_HANDOVER_MASTER.md
├── SESSION_START_QUICK.md
├── session-v77-20251014-1600-handover.md
├── archive\
├── evidence\
└── ../index_cards\
    ├── BRIEF.md          # Architecture overview (~500 tokens)
    ├── GLOSSARY.md       # Domain terms (~450 tokens)
    ├── DB_CONTRACT.sql   # Schema definitions (~900 tokens)
    ├── INVARIANTS.md     # Non-changing rules (~850 tokens)
    └── SCRIPTS.md        # Script quick reference (~200 tokens)
```

---

## 3. PURPOSE & SCOPE
**Does:** set working standards, context size rules, and file roles.  
**Does not:** contain full logs or per-session next actions.

---

## 4. USING THIS FILE
- **Humans:** Read sections 5–6 occasionally for consistency.  
- **Models:**  
  1. Load this file first and read §5.1.  
  2. Confirm compliance in one short line before any code action.  
  3. Then load `SESSION_START_QUICK.md` + current session handover only.

---

## 5. CONTEXT CONTROL RULES
1. Only the **current handover + QUICK** belong in context.  
2. Logs → `/evidence/{session}/`; link, don’t paste.  
3. Archive older handovers after 2 sessions.  
4. Word caps: handover ≤ 600 w, QUICK ≤ 400 w, MASTER ≤ 1500 w.  
5. *Delta principle:* each handover logs only differences.  
6. Human notes: prefix with `# Comment:`.  
7. Automation scripts enforce caps to preserve window capacity.

---

### 5.1 WORKING BEHAVIOUR STANDARDS (Non-Negotiables)
**At session start, reply must begin with:** `ACK MOOSE-SOP v3`

**N1 — Read Before Write.** List the files you read and what you found (1–2 lines per file).

**N2 — Verify DB State.** Show Supabase table schema + 3 sample rows for the **primary** table(s) you will modify, or declare `BLOCKED: missing <credential|query output>`.

**N3 — Plan Before Edit.** Present a minimal plan + tests before generating diffs.

**N4 — Output Diffs Only.** Provide unified diffs, not full files (exceptions: new files, <50 lines).

**N5 — Self-Audit.** End with a compliance audit for N1–N5 (pass/fail).

**N6 — Minimal Context.** Load only MASTER, QUICK, current handover, and index cards unless explicitly told otherwise.

**N7 — Script Reuse.** Check `docs/index_cards/SCRIPTS.md` before writing scripts. If a suitable script exists, use/modify it. Add new scripts to the registry.

---

### 5.2 REPLY SCHEMA (Task-Type Variants)

**For code changes (edits, refactors, new features):**
```
ACK MOOSE-SOP v3

PRECHECK
- Files read: <bullet list + 1-line summaries>
- DB schema + 3 rows for primary tables (or BLOCKED)
- Index cards loaded: <BRIEF | GLOSSARY | DB_CONTRACT | INVARIANTS | SCRIPTS>

PLAN
- Numbered steps + tests to run

DIFFS
- Unified diffs only

TESTS
- Unit/Integration/Acceptance checklist

COMPLIANCE
- N1..N7 pass/fail
```

**For script execution (run + interpret):**
```
ACK MOOSE-SOP v3

PRECHECK
- Script checked: <existing script name or "new script required">
- Purpose: <one line>
- Index cards loaded: <if relevant>

SCRIPT
- Command to run or script code

OUTPUT
- Stdout/stderr results

ANALYSIS
- Interpretation + next actions

COMPLIANCE
- N1, N6, N7 pass/fail (N2-N5 N/A for script execution)
```

**For investigation (research, discovery):**
```
ACK MOOSE-SOP v3

PRECHECK
- Files/areas to investigate
- Index cards loaded: <if relevant>

FINDINGS
- Bullet list of discoveries

RECOMMENDATIONS
- Actionable next steps

COMPLIANCE
- N1, N6 pass/fail (N2-N5, N7 N/A for investigation)
```

---

### 5.3 FAILURE POLICY

**If PRECHECK cannot show DB evidence and DB will be edited:**
- Respond `BLOCKED: missing <specific credential|query|connection>` and **stop**.
- Do not proceed with guesses or cached knowledge.

**If script does not exist in registry and task is trivial:**
- Create inline script, execute, and add to registry in same session.

**If script does not exist and task is complex:**
- Flag for user: "Complex script required, not in registry. Proceed with creation?"

---

## 6. HANDOVER FILE TYPES AND ROLES
| File | Description | Paste to Model? |
|------|--------------|----------------|
| MASTER | Rules & standards | Only for resets |
| QUICK | Active plan | ✅ |
| session-vXX | Delta log | ✅ |
| archive\ | Old sessions | ❌ |
| evidence\ | Logs | ❌ |

---

## 7. ROLES & RESPONSIBILITIES
- **Court:** Maintains QUICK + new handovers.  
- **Claude Code / GPT:** Must acknowledge §5.1 compliance, follow caps, and reference evidence paths only.

---

## 8. HANDOVER CREATION FLOW
1. Finish work → complete delta summary.  
2. Save as `session-vNN-YYYYMMDD-HHMM-handover.md`.  
3. Copy headline items to QUICK.  
4. Move handovers > 2 old to `/archive/`.

---

## 9. STANDARD HANDOVER TEMPLATE
*(For reference only – don’t paste logs)*  
```
# session-vNN-YYYYMMDD-HHMM-handover.md
Result: ✅/⚠️/❌
Δ Summary:
Next Actions:
Watchpoints:
References:
  - MASTER
  - QUICK
  - evidence\vNN\
```

---

## 10. REFERENCE LINKS
| Purpose | Path |
|----------|------|
| MASTER | docs\session_updates\ |
| QUICK | docs\session_updates\ |
| Current | session-v77-20251014-1600-handover.md |
| Evidence | evidence\ |
| Archive | archive\ |

---

## 11. MAINTENANCE
| Action | Frequency |
|--------|------------|
| Archive old handovers | every 2 sessions |
| Prune evidence | weekly |
| Review MASTER | monthly |

---

## 12. VERSION FOOTER
```
Version v20251014-hybrid-B  
Author Court  
Purpose Add §5.1 Working Behaviour Standards + model-read instruction  
Next update when workflow or rules change
```
---
*End of SESSION_HANDOVER_MASTER.md*
