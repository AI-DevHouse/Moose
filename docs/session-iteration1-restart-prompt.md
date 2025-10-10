# Session Start Prompt - Iteration 1 Restart

## Context

Read the complete handover document first:
```
C:\dev\moose-mission-control\docs\session-iteration1-handover.md
```

## Current Status

✅ **All 6 critical bugs have been fixed**
✅ **49 work orders reset to "pending" status**
✅ **Build passing (npm run build successful)**
✅ **Ready to restart orchestrator daemon**

## Your Task

Start the orchestrator daemon and monitor the execution of 49 work orders for the Multi-LLM Discussion App v1 project.

### Immediate Actions

1. **Verify system state:**
   ```bash
   powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/check-project-status.ts
   ```

2. **Start orchestrator daemon:**
   ```bash
   powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/orchestrator-daemon.ts
   ```

3. **Monitor execution** every 10-15 minutes using:
   ```bash
   powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/check-project-status.ts
   ```

### Success Criteria

- **Target:** >60% success rate (30+ of 49 work orders complete successfully)
- **Budget:** Stay under $150 total cost
- **Quality:** Generated code should build and run

### After Execution Completes

1. Analyze final results (success rate, cost, failure patterns)
2. Review generated code in `C:\dev\multi-llm-discussion-v1`
3. Check GitHub PRs created
4. Update `docs/iteration-1-changes-needed.md` with final metrics
5. Decide next steps (deploy, iterate, or fix remaining issues)

## Session Rules

**IMPORTANT - Follow these rules throughout the session:**

1. **Minimize terminal output:** Keep responses concise. For longer content, write to a file and reference it. The user wants to maximize working time before auto-compact.

2. **Read before editing:** Always read complete files and schemas before making any changes. Never edit code without first reading the entire file.

## Key Files Reference

- **Handover doc:** `docs/session-iteration1-handover.md` (read this FIRST)
- **Bug tracking:** `docs/iteration-1-changes-needed.md`
- **Project ID:** `f73e8c9f-1d78-4251-8fb6-a070fd857951`
- **Project path:** `C:\dev\multi-llm-discussion-v1`
- **Budget:** $150

## What Was Just Fixed

The previous session fixed all 6 critical bugs that caused 100% failure:
1. Missing initial commit → Fixed (README.md added)
2. Missing schema columns → Fixed (failure_class, error_context, test_duration_ms added)
3. Branch names too short → Fixed (30→80 chars)
4. Capacity timeout too short → Fixed (60s→10min)
5. Missing auto-approval → Fixed (metadata added by Architect)
6. All-or-nothing saves → Fixed (incremental saves per section)

All code changes have been built and verified. The system is ready for a fresh run.
