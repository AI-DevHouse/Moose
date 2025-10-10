# Session v63 Start Prompt

**Copy and paste this into your new Claude Code window to continue the work.**

---

## Quick Context

You are continuing work on **Moose Mission Control** - an LLM-orchestrated autonomous code generation system.

**Previous Session (v62):** Built a spec preprocessor to handle large technical specifications. Everything is now ready for the **first production test**.

**Your Task:** Execute the first production test using a real application (Multi-LLM Discussion App).

---

## What You Need to Know

### 1. Read the Complete Handover Document

**IMPORTANT:** Read this file first for full context:

```
C:\dev\moose-mission-control\docs\session-v62-handover.md
```

This document contains:
- What Moose is and how it works
- What we accomplished last session
- Current state (everything ready)
- Step-by-step instructions for next steps
- Troubleshooting guide
- All file references

**DO NOT proceed without reading the handover document first.**

---

### 2. Key Facts

- **Project:** First production test with Multi-LLM Discussion App (Electron desktop app)
- **Status:** Setup complete, preprocessor built, ready to submit spec
- **Current Directory:** `C:\dev\moose-mission-control`
- **Test Project Directory:** `C:\dev\multi-llm-discussion-v1` (created but empty)
- **Tech Spec:** 77K characters at `C:\dev\specs\Multi-LLM Discussion App_Technical Specification_ v2.2.txt`
- **Database Project ID:** `f73e8c9f-1d78-4251-8fb6-a070fd857951`

---

### 3. What's Already Done ✅

- ✅ Local directory created
- ✅ Git initialized
- ✅ GitHub repo created: `AI-DevHouse/multi-llm-discussion-v1`
- ✅ Supabase project created for app
- ✅ Project registered in Moose database
- ✅ Spec preprocessor implemented and integrated
- ✅ All scripts ready

---

### 4. What's NOT Done Yet ❌

- ❌ Tech spec NOT submitted to Architect
- ❌ Work orders NOT created
- ❌ Orchestrator NOT started
- ❌ No code generated yet

---

### 5. Immediate Next Steps

**Step 1:** Read the handover document (seriously, read it first)

**Step 2:** Submit technical spec to Architect:
```bash
powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/submit-tech-spec.ts
```

**Step 3:** Verify work orders created

**Step 4:** Start orchestrator daemon:
```bash
powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/orchestrator-daemon.ts
```

**Step 5:** Monitor execution and analyze results

**Detailed instructions for each step are in the handover document.**

---

### 6. Important Files to Reference

**Must Read:**
- `docs/session-v62-handover.md` - Complete handover (THIS IS CRITICAL)
- `docs/SOURCE_OF_TRUTH_Moose_Workflow.md` - How Moose works (1,604 lines reference)
- `docs/iteration-1-changes-needed.md` - Issue tracking and learnings

**Scripts You'll Use:**
- `scripts/submit-tech-spec.ts` - Submit spec to Architect
- `scripts/orchestrator-daemon.ts` - Start work order execution
- `scripts/list-work-orders.ts` - Check work order status

**New Component (Built Last Session):**
- `src/lib/spec-preprocessor.ts` - Handles large technical specs
- `src/app/api/architect/decompose/route.ts` - Integrated preprocessor

---

### 7. Expected Behavior

**When you submit the spec:**
- Runtime: 2-5 minutes
- Preprocessing will trigger automatically (spec is 77K chars)
- Logs will show: "🔄 Large document detected - using spec preprocessor..."
- Result: 30-50 work orders created with dependencies

**When you start orchestrator:**
- Polls every 10 seconds
- Max 3 concurrent work orders
- Each WO takes ~1-2 minutes
- Total time: ~60-120 minutes for all WOs
- PRs will appear on GitHub as WOs complete

---

### 8. Success Criteria

- ✅ At least 60% of work orders complete successfully
- ✅ Generated code compiles (TypeScript passes)
- ✅ PRs created on GitHub
- ✅ Total cost under $150
- ✅ Failure data properly classified (Phase 1 validation)

---

### 9. If Something Goes Wrong

**Consult these sections in the handover doc:**
- "Troubleshooting" section (page ~15)
- "Quick Reference Commands" section (page ~17)
- "Warning Signs" and "Critical Issues" section (page ~18)

**Common Issues:**
- Spec submission timeout → Check Next.js dev server running (`npm run dev`)
- Work orders not executing → Check dependencies in database
- High failure rate → Check `failure_class` breakdown in `outcome_vectors` table

---

### 10. Your Goal for This Session

**Execute the complete first production test:**
1. Submit tech spec ✓
2. Create work orders ✓
3. Run orchestrator ✓
4. Monitor execution ✓
5. Analyze results ✓
6. Document findings ✓

**Deliverable:**
- Updated `docs/iteration-1-changes-needed.md` with:
  - Final metrics (success rate, cost, time)
  - Failure breakdown by type
  - Issues discovered
  - Improvements needed
  - Assessment: Is Moose ready for production?

---

## Critical Reminders

1. **READ THE HANDOVER DOC FIRST** - Contains all context and detailed instructions
2. **Take notes** - Update `iteration-1-changes-needed.md` as you discover issues
3. **Monitor costs** - Check daily spend, should stay well under $150
4. **Let it run** - Don't stop orchestrator prematurely, let WOs complete
5. **Document everything** - This is a learning exercise, capture all findings

---

## Start Here

```bash
# 1. Read the handover document
cat docs/session-v62-handover.md

# 2. Then run this to start the test
powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/submit-tech-spec.ts
```

**Good luck! This is the moment we've been building towards. 🚀**

---

**Session v62 Handover Location:**
`C:\dev\moose-mission-control\docs\session-v62-handover.md`

**Iteration Tracking:**
`C:\dev\moose-mission-control\docs\iteration-1-changes-needed.md`

**Moose Workflow Reference:**
`C:\dev\moose-mission-control\docs\SOURCE_OF_TRUTH_Moose_Workflow.md`
