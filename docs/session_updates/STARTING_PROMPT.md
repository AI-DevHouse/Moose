# STARTING PROMPT — Moose Mission Control (auto‑locating)

You are resuming development for **Moose Mission Control**.

Session files live in:
  `C:\dev\moose-mission-control\docs\session_updates\`

**Do this in order:**

1) Locate and open **SESSION_HANDOVER_MASTER.md**, **SESSION_START_QUICK.md**, and the **latest** file matching:
   `session-v*-*-handover.md` (choose the highest version number OR newest timestamp).

2) From MASTER:
   - Read **§§5.1–5.3** (Working Behaviour Standards, Reply Schema, Failure Policy).
   - **Begin your reply with `ACK MOOSE-SOP v3` and use the required schema** for your task type.

3) From the latest handover:
   - Summarise the **Δ Summary** and **Next Actions** in ≤3 bullets.
   - Set your current working goal accordingly.

4) Follow **SESSION_START_QUICK.md** workflow next.

5) **Context boundaries:**
   - Keep only MASTER, QUICK, latest handover, and relevant index cards in context.
   - Index cards: `docs/index_cards/` (BRIEF, GLOSSARY, DB_CONTRACT, INVARIANTS, SCRIPTS).
   - Reference `/evidence/` or `/archive/` by **path only**; do **not** load raw logs.

**Respond when complete with the full schema:**

```
ACK MOOSE-SOP v3

PRECHECK (≤200 tokens)
- Files read: MASTER (§§5.1-5.3), QUICK, session-vXXX-handover
- Index cards loaded: [if any]
- Δ Summary + Next Actions from handover: ≤3 bullets
- DB/Git evidence: [if editing DB/code]

PLAN (≤120 tokens)
- [If applicable: numbered steps for immediate actions]
- [Otherwise: "Session orientation complete, awaiting user direction"]

COMPLIANCE
- N1 ✓ N6 ✓ (full audit at first action)
```
