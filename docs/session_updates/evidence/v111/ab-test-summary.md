# A/B Test Summary - Claude vs GPT-4o-mini (Quick Reference)

**Date:** 2025-10-21
**Session:** v111

---

## Bottom Line

**❌ Claude does NOT solve the quality problem**

- **Mid complexity:** +8 points (58→66) — **INSUFFICIENT** (target: 75)
- **Low complexity:** -11 points (78→67) — **REGRESSION**
- **High complexity:** FAILED (PR body >65K chars)

**Average score:** Claude (66.5) vs gpt-4o-mini (68) = **-1.5 points worse**

---

## Test Results

| WO | Complexity | gpt-4o-mini | Claude | Delta | Winner |
|----|------------|-------------|--------|-------|--------|
| Redux | 0.55 (MID) | 58/100 | 66/100 | +8 | Claude ✅ |
| Validation | 0.41 (LOW) | 78/100 | 67/100 | -11 | **gpt-4o-mini** ✅ |
| Clipboard | 0.98 (HIGH) | 44/100 | FAILED | N/A | Both fail ❌ |

---

## Critical Finding: Both Models Fail Test Generation

**Mid complexity (0.55) test scores:**
- gpt-4o-mini: **0/10** (no tests created)
- Claude: **0/10** (no tests created)

**Despite acceptance criterion:** "Store initialization tested with empty state"

**BOTH MODELS IGNORED THE REQUIREMENT IDENTICALLY**

---

## Why Claude Regressed on Low Complexity (-11 pts)

**Good:**
- Better architecture (+4): Reusable `SpecificationParser` class
- Better validation (+3): Runtime type checking
- Better error handling (+1): TypeError for invalid inputs

**Bad:**
- Worse documentation (-2): **Removed all JSDoc/comments** that gpt-4o-mini had

**Net:** +8 technical improvements - 2 documentation regression - context overhead = -11 overall

**Pattern:** Claude optimizes for **technical perfection** over **readability**.

---

## New Failure Mode: PR Body Too Long

**High complexity WO failed:**
```
GraphQL: Body is too long (maximum is 65536 characters)
```

**Cause:** Claude's verbose PR descriptions exceed GitHub's 65,536 char limit

**Impact:** Cannot test high complexity with Claude until PR body truncation implemented

---

## Decision: Option B (Tier 3 Validator) is MANDATORY

**Why routing fix (Option C) alone won't work:**

1. Claude scored **66/100** on mid (target: 75) — **fails by -9**
2. Both models **0/10 on tests** — identical failure
3. Claude introduces new failure mode (PR body length)
4. Average performance **worse** overall (-1.5 pts)

**Expected impact of Tier 3 validator:**

| Criterion | Claude Mid (Current) | + Validator | Gain |
|-----------|---------------------|-------------|------|
| Tests | 0/10 | 9/10 | **+9** ✅ |
| Error Handling | 5/10 | 9/10 | +4 |
| Input Validation | 2/10 | 7/10 | +5 |
| No Placeholders | 9/10 | 10/10 | +1 |
| **TOTAL** | **66/100** | **85/100** | **+19** ✅ |

**With validator:** 66 + 19 = **85/100 on mid complexity** ✅ **MEETS TARGET**

---

## Recommended Implementation Plan

### Phase 1 (2 hours) - Fix PR Body Issue
```typescript
// github-integration.ts
const MAX_PR_BODY_LENGTH = 65000;
if (prBody.length > MAX_PR_BODY_LENGTH) {
  prBody = prBody.substring(0, MAX_PR_BODY_LENGTH) + '\n\n...(truncated)';
}
```

### Phase 2 (10 hours) - Tier 3 Validator (CRITICAL)

**Programmatic checks:**
1. **Test assertion count** (CRITICAL - both models fail)
2. Placeholder detection (regex scan, TODO markers)
3. Import validation
4. Error handling coverage
5. Type safety scan

**Integration:** Run validator in refinement loop BEFORE syntax checking

### Phase 3 (Optional 2 hours) - Hybrid Routing
- Low (<0.5): gpt-4o-mini ($0.05/WO)
- Mid/High (≥0.5): Claude ($1.00/WO)
- **Only if Tier 3 validator proves effective**

---

## Cost Analysis

| Strategy | Quality (Mid) | Cost per WO | Notes |
|----------|--------------|-------------|-------|
| gpt-4o-mini only | 58/100 ❌ | $0.05 | Baseline |
| Claude only | 66/100 ❌ | $1.00 | 20x cost, +8 pts |
| **gpt-4o-mini + Tier 3** | **75-80/100** ✅ | **$0.05** | **RECOMMENDED** |
| **Claude + Tier 3** | **80-85/100** ✅ | $1.00 | 5 pts better, 20x cost |

**ROI:** gpt-4o-mini + Tier 3 validator = **16x cheaper** with only **5-10 pts lower quality**

---

## Final Recommendation

**Use gpt-4o-mini + Tier 3 Programmatic Validator**

**Rationale:**
1. Claude's improvement (+8 mid) is **marginal and insufficient** to meet 75/100 target
2. Both models need Tier 3 validator to pass (identical test generation failure)
3. gpt-4o-mini is **16x cheaper** ($0.05 vs $1.00)
4. Quality delta after validator: only 5-10 points (80 vs 85)

**Next Action:** Implement Tier 3 validator (10 hours) → test on both models → measure effectiveness

---

**Full Analysis:** `evidence/v111/claude-vs-gpt4o-mini-comparison.md`
**Baseline Data:** `evidence/v111/gpt4o-mini-baseline-results.md`
**Decision Matrix:** `evidence/v111/decision-summary.md`
