# Session State v25 (2025-09-30)

**Start here each session.** Reference other docs as needed.

---

## Last Session Summary (v24→v25)

**Completed:**
- ✅ Sonnet 4.5 upgrade (claude-sonnet-4-5-20250929)
- ✅ Phase 2.1 Architect backend API functional
- ✅ Integration tests: 14/15 passing

**Key Learnings:**
- Claude wraps JSON in markdown despite prompts (strip in code)
- Dependency validation flags valid diamond patterns (relaxed to warn-only)
- Git can't restore uncommitted files (check status first)
- Separate commits for package.json changes

---

## Current Status

**Phase 2.1 Architect: ~30% complete**
- ✅ API complete (`/api/architect/decompose`)
- ⏳ Database migration needed (5 new work_orders columns)
- ⏳ UI integration (Upload Spec tab)
- ⏳ Director approval flow

**Infrastructure:**
- Server: localhost:3000
- Supabase: qclxdnbvoruvqnhsshjr
- Branch: test/contract-validation-integration
- Models: All using claude-sonnet-4-5-20250929
- Git: Clean working tree

**Testing:**
- Integration: 14/15 passing
- Cold-start flake: Security Hard Stop test (see [known-issues.md](known-issues.md#5-cold-start-race-condition))
- Pre-existing TS errors: 19 (unrelated to new code)

---

## Next Immediate Task

### Phase 2.1 Architect - Database Migration (30 min)

**Run in Supabase SQL editor:**
```sql
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS
  acceptance_criteria jsonb DEFAULT '[]'::jsonb,
  files_in_scope jsonb DEFAULT '[]'::jsonb,
  context_budget_estimate integer DEFAULT 2000,
  decomposition_doc text,
  architect_version text DEFAULT 'v1';
```

**Verify:**
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'work_orders'
  AND column_name IN ('acceptance_criteria', 'files_in_scope',
      'context_budget_estimate', 'decomposition_doc', 'architect_version');
```

**After migration:** Add Upload Spec UI tab (1 hour), then test E2E flow.

---

## Context Verification (Required Before Work)

Answer these to confirm doc comprehension:

**Q1:** What are the THREE mechanisms that make PowerShell find-replace unreliable, and what does R12 specify about the number of attempts before switching methods?

**Q2:** What is the mandatory code change when Claude returns JSON wrapped in markdown code blocks, and in which service file was this implemented for Phase 2.1?

**Q3:** What are the TWO validation thresholds for Phase 2.1 Architect (WO count range and max token budget per WO)?

**Q4:** What is the current cost per decomposition, and what percentage of the monthly LLM budget does this represent at 1-2 decompositions/day?

**Q5:** What is R11, where must it be applied, and what command implements it?

**Q6:** What model is the Architect using, and why is its high per-call cost acceptable despite budget constraints?

**Q7:** What is the dependency validation behavior in v25, why was strict validation relaxed, and what constraint does this temporarily violate?

**Q8:** What are the THREE remaining tasks to complete Phase 2.1 Architect implementation, and what is the completion percentage?

**Q9:** What five fields need to be added to the work_orders database table for Architect integration?

**Q10:** What is the root cause of the Security Hard Stop test failure on cold start, what is the workaround, and what is the planned fix?

---

## Quick Reference

**Key Files:**
- `src/lib/architect-service.ts` - NEW (spec decomposition)
- `src/types/architect.ts` - NEW (types)
- `src/app/api/architect/decompose/route.ts` - NEW (endpoint)
- `src/lib/enhanced-proposer-service.ts` - Self-refinement
- See [architecture-decisions.md](architecture-decisions.md) for full structure

**Agent Hierarchy:**
1. Architect (Phase 2.1 - API done)
2. Director (Phase 2.2 - needs rename from "Manager LLM")
3. Manager (Phase 4.1 - needs rename from "Director")
4. Proposers (existing + self-refinement)
5. Client Manager (Phase 2.5 - planned)
6. Orchestrator (Phase 2.3/3.2 - Aider-based, NOT agent)
7. Sentinel (Phase 3.1 - planned)

**Essential Commands:**
```powershell
# Integration tests (run first each session)
.\phase1-2-integration-test.ps1

# Type errors (expect 19 pre-existing)
npx tsc --noEmit 2>&1 | Select-String "Found.*errors"

# Test Architect endpoint
$spec = @{
  feature_name = "Test Feature"
  objectives = @("obj1")
  constraints = @("con1")
  acceptance_criteria = @("ac1")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/architect/decompose" `
  -Method POST `
  -ContentType "application/json" `
  -Body $spec

# Proposer status
Invoke-RestMethod http://localhost:3000/api/proposers | ConvertFrom-Json |
  Select-Object -ExpandProperty proposers |
  Format-Table name, complexity_threshold, model
```

---

## Session Start Checklist

1. [ ] Run integration tests: `.\phase1-2-integration-test.ps1` (expect 14-15/15)
2. [ ] Verify server running (T1: "compiled successfully")
3. [ ] Answer all 10 verification questions above
4. [ ] Check git status (should be clean on test/contract-validation-integration)
5. [ ] Review [known-issues.md](known-issues.md) for active problems
6. [ ] Decide: Continue Phase 2.1 OR other priority

---

## References

- **[architecture-decisions.md](architecture-decisions.md)** - Agent hierarchy, arch lockins, phase specs
- **[rules-and-procedures.md](rules-and-procedures.md)** - R1-R8 rules, common pitfalls, diagnostics
- **[known-issues.md](known-issues.md)** - Active issues with workarounds

---

**Phase Status:** 2.1 (30% - API done, DB/UI/Director pending) | Tests: 14/15 | TS Errors: 19 pre-existing | Git: Clean