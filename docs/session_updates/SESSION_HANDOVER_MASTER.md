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
└── evidence\
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

### 5.1 WORKING BEHAVIOUR STANDARDS
**Models:** You must read this section at session start and restate compliance in ≤1 sentence before performing any edit.

1. **Read Before Write** – Always read relevant code, schemas, and config before proposing or generating modifications.  
2. **Verify Before Commit** – Confirm all edits match current repo + Supabase schema.  
3. **Preserve Ground Truth** – Never invent structure or config values.  
4. **Use Minimal Context** – Load only what’s required for the current task.  
5. **Request Clarification Instead of Assuming.**  
6. **Uniform Compliance** – All LLMs and agents follow these same rules.  
7. **Human Override** – If unsure, ask Court before continuing.

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
