# V115 Strategy Pivot: From Formula Validation to Root Cause Analysis

**Date:** 2025-10-22
**Session:** v115
**Decision:** Abandon complexity formula validation; pivot to practical problem-solving

---

## Problem Statement

**Original Goal:** Validate complexity formula correlation (r < -0.80) before shadow mode deployment

**Actual Result:**
- Correlation: r = +0.962 (POSITIVE, opposite direction)
- Decision gate: FAILED (target r < -0.80)

**Root Cause of Failure:**
1. All 5 test WOs have broken project baseline (100% build failures, 0% test coverage)
2. Only 1 dimension varies (readability, 15% weight) → artificial clustering at 2.7-3.3/10
3. Historical r=-0.97 was from different scoring method (old /100 scale vs new /10 scale)
4. Validation test fundamentally compromised by broken baseline

---

## Critical Discovery: Acceptance Scoring Changed

**Historical Scores (from analysis doc, unknown method):**
| WO | Complexity | Old Score | Current Score | Delta |
|----|------------|-----------|---------------|-------|
| Validation Suite | 0.41 | 78/100 | 33/100 | -45 |
| Redux Store | 0.55 | 58/100 | 27/100 | -31 |
| Clipboard Coord | 0.98 | 44/100 | 27/100 | -17 |

**Current Acceptance Validator:** `src/lib/acceptance-validator.ts`
- 5 dimensions (architecture, readability, completeness, test_coverage, build_success)
- Weighted aggregate: 25%, 15%, 25%, 20%, 15%
- Score range: 0-10 (not 0-100)

**All current WOs score 2.7-3.3/10** due to broken baseline constraining variation.

---

## Dimensional Breakdown Analysis

**What Actually Varies:**

| Dimension | Weight | Low Complexity | High Complexity | Variation |
|-----------|--------|----------------|-----------------|-----------|
| Readability | 15% | 6/10 | 10/10 | ✅ VARIES |
| Architecture | 25% | 5/10 | 5/10 | ❌ CONSTANT |
| Completeness | 25% | 2/10 | 2/10 | ❌ CONSTANT (build fail) |
| Test Coverage | 20% | 0/10 | 0/10 | ❌ CONSTANT (no tests) |
| Build Success | 15% | 0/10 | 0/10 | ❌ CONSTANT (all fail) |

**Mathematical Result:**
```
score = 5 * 0.25 + readability * 0.15 + 2 * 0.25 + 0 * 0.20 + 0 * 0.15
score = 1.75 + (readability * 0.15)
```

- If readability = 6: score = 2.65/10
- If readability = 10: score = 3.25/10

**Why Readability Correlates POSITIVELY:**
- High complexity WOs (1.13-1.15) = simple code (docs/config) → high readability (10/10)
- Low complexity WOs (0.44-0.68) = complex logic (state/API) → lower readability (6/10)
- **File count ≠ code complexity** (the inverse!)

---

## New Pragmatic Approach

### Goal Shift

**OLD GOAL:** Validate formula predicts quality
**NEW GOAL:** Understand WHY WOs fail and HOW to fix them

### The Real Questions

1. **Root Cause:** Why do 100% of WOs fail to build?
   - Missing imports?
   - Type errors?
   - Config issues?
   - File path problems?

2. **Measurement:** How do we track improvement over time?
   - Static test suite (repeatable)
   - Dimensional scores (actionable metrics)
   - Build success % → 70%
   - Test coverage % → 30%

3. **Action:** What do we fix in the proposer?
   - Analyze actual build errors from PRs
   - Categorize error patterns
   - Update proposer prompt/logic

---

## Proposed Implementation (V116+)

### Phase 1: Root Cause Analysis (V116)

**Analyze 5 test WO PRs:**
- PR #246: WO 0.44 (healthy)
- PR #250: WO 0.61 (review)
- PR #249: WO 0.68 (review)
- PR #248: WO 1.13 (oversized)
- PR #247: WO 1.15 (oversized)

**For each PR:**
1. Clone branch
2. Run build, capture errors
3. Categorize error types:
   - Missing imports/dependencies
   - Type errors
   - File path issues
   - Configuration problems
   - Syntax errors

**Output:** Error pattern report → proposer fix recommendations

### Phase 2: Static Test Suite Design (V116)

**Option A: Synthetic Test Cases**
```typescript
const STATIC_TESTS = [
  { name: "Simple Component", spec: "React button with TS", expected: 2 files, 3 criteria },
  { name: "API Integration", spec: "REST client for users", expected: 3 files, 5 criteria },
  { name: "State Management", spec: "Redux slice for auth", expected: 4 files, 6 criteria },
  { name: "Documentation", spec: "API docs + README", expected: 5 files, 4 criteria },
  { name: "Test Suite", spec: "Unit tests for utils", expected: 3 files, 5 criteria }
];
```

Run monthly, track dimensional improvements.

**Option B: Reusable WO Set**
- Use our 5 test WOs as permanent baseline
- Reset to `pending` each test cycle
- Re-execute with current proposer
- Compare dimensional scores over time

### Phase 3: Dimensional Improvement Tracking (V116)

**Baseline (V115):**
- Build Success: 0% (0/5 passed)
- Test Coverage: 0% (0/5 have tests)
- Completeness: 2.0/10 avg
- Overall Acceptance: 2.9/10 avg

**Targets (3-6 months):**
- Build Success: 70% (7/10 pass)
- Test Coverage: 30% (3/10 have tests)
- Completeness: 7.0/10 avg
- Overall Acceptance: 6.5/10 avg

**Measurement Protocol:**
1. Run static test suite monthly
2. Record dimensional scores
3. Calculate improvement Δ
4. Adjust proposer based on patterns

### Phase 4: Proposer Fixes (V117+)

Based on error analysis, update proposer to:
- Generate proper imports
- Fix type definitions
- Create valid config files
- Add missing dependencies
- Generate buildable code

---

## Abandoning Formula Validation (For Now)

**Why we're stopping:**
1. Broken project baseline prevents clean validation
2. Historical r=-0.97 cannot be reproduced (different scoring method)
3. Formula validation is THEORETICAL; root cause analysis is PRACTICAL
4. Dimensional approach is more actionable

**When to revisit:**
- After build success >70% (clean baseline established)
- After 10-20 WOs with passing builds available
- When we can test on a working project (e.g., moose-mission-control itself)

**Alternative approach:**
- Deploy shadow mode WITHOUT validation
- Collect production data (10-20 decompositions)
- Validate formula with real-world outcomes
- Adjust thresholds based on actual failure rates

---

## Actionable Next Steps (V116)

1. **PR Analysis Script:**
```bash
scripts/analyze-test-wo-build-failures.ts
# For each PR: clone, build, categorize errors
```

2. **Static Test Suite Design:**
```bash
docs/static-quality-test-suite-design.md
# Define approach, test cases, measurement protocol
```

3. **Dimensional Targets:**
```bash
docs/dimensional-improvement-targets.md
# Baseline, targets, measurement schedule
```

4. **Proposer Fix Recommendations:**
```bash
docs/proposer-improvements-from-error-analysis.md
# Error patterns → specific fixes
```

---

## Conclusion

**We learned:**
- Complexity formula may be correct, but validation test is broken
- 100% build failure is the real problem, not formula accuracy
- Dimensional scores are more actionable than correlation coefficients
- Root cause analysis > theoretical validation

**Next focus:**
- Analyze WHY builds fail
- Create static test suite
- Track dimensional improvements
- Fix proposer based on patterns

**Formula validation:** Deferred until clean baseline available.
