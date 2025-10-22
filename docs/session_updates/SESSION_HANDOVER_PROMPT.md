# SESSION HANDOVER PROMPT — Moose Mission Control (auto‑locating)

We are closing this development session.

**Create the next handover as follows:**

1) In `C:\dev\moose-mission-control\docs\session_updates\`:
   - Find the **latest** file matching `session-v*-*-handover.md`.
   - Extract its version `vNN` and **increment by 1** (e.g., v77 → v78).

2) Create a new file named:
   `session-v<next>-<YYYYMMDD-HHMM>-handover.md`

3) Use **MASTER §9 “Standard Handover Template”** and include only:
   - **Result:** ✅ / ⚠️ / ❌ (one line)
   - **Δ Summary:** 3–6 bullets of changes since the prior version
   - **Next Actions:** numbered steps for the next session
   - **Watchpoints:** 3–5 bullets (stop/verify conditions, risks)
   - **References:** MASTER, QUICK, and `evidence\v<next>\`
   - **Version Footer**

4) Do **not** paste logs or long narratives.
   - Save all supporting material under: `evidence\v<next>\` and link by path.

5) After writing the new handover:
   - Update **SESSION_START_QUICK.md** to reference the new file.
   - Move any handovers **older than 2 sessions** into `archive\`.

**Respond with the completed new handover content only**, ready to save to the correct folder.
