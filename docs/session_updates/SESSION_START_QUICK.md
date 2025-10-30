# SESSION START QUICK  
**Path:** C:\dev\moose-mission-control\docs\session_updates\SESSION_START_QUICK.md  
**Version:** v20251014-hybrid-B  

---

## ⚙️ MODEL INSTRUCTION (PRIORITY)
**Do this before any action:**
1️⃣ Open MASTER §§5.1–5.3 and follow exactly.
2️⃣ Reply must start with `ACK MOOSE-SOP v3`.
3️⃣ Use the required schema for your task type: PRECHECK / PLAN / DIFFS / TESTS / COMPLIANCE (or variants for scripts/investigation).
4️⃣ If DB evidence (schema + 3 rows for primary tables) cannot be shown and you will edit the DB, reply `BLOCKED: missing <specific item>` and stop.

---

## 1. ORIENTATION
Project: **Moose Mission Control**
Background rules → [SESSION_HANDOVER_MASTER.md](C:\dev\moose-mission-control\docs\session_updates\SESSION_HANDOVER_MASTER.md)
Current state → [session-v149-20251030-2359-handover.md](C:\dev\moose-mission-control\docs\session_updates\session-v149-20251030-2359-handover.md)

---

## 2. BEFORE YOU START (CHECKLIST)
☑ Load MASTER §§5.1–5.3 and begin reply with `ACK MOOSE-SOP v3`.
☑ Verify Supabase + Git connections active **and show evidence in PRECHECK** (schema + 3 rows if editing DB; `git status --porcelain` if editing code).
☑ Open current handover → read Δ Summary + Next Actions.
☑ Check `docs/index_cards/SCRIPTS.md` for existing scripts before creating new ones.

---

## 3. TODAY'S WORKFLOW
1️⃣ Continue from v149 Next Actions.
2️⃣ Document progress in a new `session-v150-…-handover.md`.
3️⃣ Keep updates short (≤5 bullets); store logs under `/evidence/v150/`.
4️⃣ If unexpected behaviour → **stop with `BLOCKED`** and list the single minimal artifact needed to proceed.

---

## 4. WRAP-UP
📝 Create v150 handover using MASTER §9 template.
📂 Archive handovers older than v147 → `archive\`.

---

## 5. REFERENCES
| Purpose | File | Path |
|----------|------|------|
| Rules | MASTER | docs\session_updates\ |
| Last Session | v149 | docs\session_updates\ |
| Evidence | evidence\ | docs\session_updates\evidence\ |
| Archive | archive\ | docs\session_updates\archive\ |

---

## 6. VERSION FOOTER
```
Version v20251014-hybrid-B  
Author Court  
Purpose Add explicit model-read instruction to §5.1 before session start
```
---
*End of SESSION_START_QUICK.md*
