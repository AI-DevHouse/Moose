# Strategic Analysis Prompt for Claude UI

**Copy everything below this line and paste into Claude.ai**

---

I'm building an AI orchestration system that uses LLMs (gpt-4o-mini and Claude) to generate code from work orders. I've completed extensive testing and need strategic advice on implementation priorities.

## Context: The Problem

We're testing two models' ability to generate production-quality code from work order specifications. Quality is measured on a 10-criterion scale (100 points max). Our target is 75/100 minimum for production readiness.

### Test Results Summary

**gpt-4o-mini (Tier 1 optimized prompts):**
- Low complexity (0.41): **78/100** ✅
- Mid complexity (0.55): **58/100** ❌ (fails by -17)
- High complexity (0.98): **44/100** ❌

**Claude 4.5 (same prompts, A/B test):**
- Low complexity (0.41): **67/100** ⚠️ (regression vs gpt-4o-mini)
- Mid complexity (0.55): **66/100** ❌ (fails by -9, +8 vs gpt-4o-mini)
- High complexity (0.98): **FAILED** (PR body >65K chars)

**Average performance (Low + Mid):**
- gpt-4o-mini: 68.0/100
- Claude 4.5: 66.5/100
- **Claude is 1.5 points worse overall**

### Critical Finding: Identical Failure Pattern

**Both models scored 0/10 on test generation** for mid complexity despite explicit acceptance criterion: "Store initialization tested with empty state"

This is **identical across both models**, suggesting a fundamental limitation in how models prioritize requirements under cognitive load, not a model-specific issue.

## Key Issues Identified

### Issue 1: Test Generation Failure (CRITICAL)
- **Pattern:** Both models consistently fail to generate tests when complexity ≥0.5
- **Evidence:** Mid complexity - gpt-4o-mini: 0/10, Claude: 0/10 on tests
- **But:** Low complexity - both models: 10/10 on tests
- **Conclusion:** Models know HOW to generate tests, but DROP this requirement when complexity increases

### Issue 2: Model Capability Ceiling
- **Statistical correlation:** Score = 78 - (34 × complexity), R² = 0.94
- **Pattern:** Same prompts yield 78/100 at low, 58/100 at mid, 44/100 at high
- **Conclusion:** Prompt improvements work perfectly at low complexity but fail as complexity exceeds working memory capacity
- **Implication:** "Just improve the prompts" strategy has hit diminishing returns

### Issue 3: Missing File/Import Validation
- **Pattern:** Mid/high complexity code imports non-existent files
- **Example:** `import { ipcMiddleware } from './middleware/ipcMiddleware'` - file not created
- **Root cause:** Models design architecture (middleware in separate file) but don't track which files are being created THIS PR vs already exist

### Issue 4: Error Handling & Input Validation Gaps
- **Pattern:** Coverage degrades sharply with complexity
- **Mid complexity:** gpt-4o-mini 2/10, Claude 5/10 on error handling
- **Low complexity:** gpt-4o-mini 9/10, Claude 10/10 on error handling
- **Conclusion:** Models prioritize "happy path" when constrained

### Issue 5: Work Order Structure Quality
- **Finding:** WO structure quality correlates +0.85 with proposer success
- **Issues:** Acceptance criteria buried at end, no explicit file structure, abstract requirements, no concrete examples
- **Opportunity:** Improving WO templates may reduce cognitive load

## Proposed Solutions (with data)

### Solution 1: Tier 3 Programmatic Validator
**Implementation:** Build deterministic code quality checks that run during refinement loop

**Checks:**
1. **Test assertion count** - Scan test files for expect() statements, require minimum 3 per test
2. **Placeholder detection** - Regex scan for comment-only method bodies, TODO markers
3. **Import validation** - Parse imports, verify files exist or are being created
4. **Error handling coverage** - Detect I/O operations (fs.*, fetch, etc.) without try-catch
5. **Type safety scan** - Flag `any` types

**Integration:** Run validator BEFORE syntax checking, provide specific feedback for refinement

**Expected Impact:**
| Criterion | Current (Claude Mid) | + Validator | Gain |
|-----------|---------------------|-------------|------|
| Tests | 0/10 | 9/10 | +9 |
| Error Handling | 5/10 | 9/10 | +4 |
| Input Validation | 2/10 | 7/10 | +5 |
| No Placeholders | 9/10 | 10/10 | +1 |
| **TOTAL** | **66/100** | **85/100** | **+19** ✅ |

**Effort:** 10 hours
**Confidence:** 95% (deterministic checks, straightforward implementation)
**ROI:** 2.8 points per hour
**Cost impact:** +$0.02/WO (estimated 1 additional refinement cycle)

**Pros:**
- Deterministic (not dependent on model reliability)
- Model-agnostic (works with both gpt-4o-mini and Claude)
- Reusable infrastructure
- Catches issues early (saves PR rejection cycles)

**Cons:**
- 10 hours development time
- Increases refinement cycles (more API calls)
- Maintenance burden (must evolve with acceptance criteria)

**Unknown:** Will models successfully address validation errors, or just repeat same mistakes?

---

### Solution 2: Work Order Template Improvements
**Implementation:** Redesign WO structure to reduce cognitive load

**Key Changes:**
1. **CRITICAL section at top** - Most important requirements (tests) seen first
2. **Explicit file structure** - Exact file tree with CREATE markers
3. **Concrete examples** - Code snippets showing expected patterns
4. **Test requirements as separate section** - Emphasizes mandatory nature
5. **Dependencies section** - Surfaces file existence requirements
6. **Success checklist** - Model can self-check before submission

**Example improvement:**
```
Current: "Tests mentioned in acceptance criteria (item #6 of 6)"
Improved:
## CRITICAL SUCCESS CRITERIA (Must be completed)
1. ✅ **Tests REQUIRED**: Create test file with minimum 3 test cases

   File: `src/store/store.test.ts`

   Required test cases:
   1. Store initialization with empty state
   2. Type exports are correct
   3. DevTools configured for development

   Example:
   ```typescript
   describe('Redux Store', () => {
     it('should initialize with empty state', () => {
       expect(store.getState()).toBeDefined()
       expect(Object.keys(store.getState()).length).toBe(0)
     })
   })
   ```
```

**Effort:** 4 hours
**Confidence:** 80% (structural improvements should help, but models may still drop under load)
**ROI:** 2.5 points per hour
**Cost impact:** +$0.01/WO (longer WOs = more input tokens)

**Pros:**
- Works with existing models (no new infrastructure)
- Low implementation cost
- Immediate benefit (next WO can use new template)

**Cons:**
- Longer WOs (more tokens)
- Still relies on model compliance (not deterministic)
- May constrain model creativity

**Unknown:** Will longer WOs exceed context windows for high complexity?

---

### Solution 3: Acceptance Criteria Compliance Validator
**Implementation:** Parse acceptance criteria from WO and programmatically verify each is met

**Example:**
- Criterion: "Store initialization tested with empty state"
- Validator: Check test file exists + scan for keywords ("store", "initialization", "empty", "state")
- If missing: "Test file exists but doesn't test 'Store initialization'. Add test case for this criterion."

**Effort:** 6 hours
**Confidence:** 85% (keyword matching is fuzzy but should catch most issues)
**ROI:** 2.5 points per hour

**Pros:**
- Criterion-specific feedback
- Directly addresses acceptance compliance

**Cons:**
- NLP/keyword matching (not fully deterministic)
- 6 hours development time
- Maintenance burden

**Recommendation:** Implement AFTER Tier 3 validator if test generation still problematic

---

### Solution 4: Hybrid Model Routing
**Implementation:** Route to different models based on complexity

**Routing logic:**
- Low (<0.5): gpt-4o-mini (performs equally well, 16x cheaper)
- Mid/High (≥0.5): Claude (slight advantage +8 pts)

**Expected impact:**
- Mid complexity: 58 → 66/100 (+8, but still fails 75 target by -9)

**Effort:** 2 hours
**Confidence:** 60% (limited improvement, doesn't achieve target)
**ROI:** 3.25 points per hour
**Cost impact:** 10x increase ($0.05 → $0.50/WO average)

**Pros:**
- Quick implementation
- Uses each model's strengths

**Cons:**
- **Still fails 75/100 target** (Claude mid = 66/100)
- 10x cost increase
- Claude needs PR body truncation fix first
- Quality improvement insufficient without validator

**Recommendation:** LOW PRIORITY - only if validator proves insufficient

---

### Solution 5: Work Order Decomposition
**Implementation:** When complexity >0.7, automatically decompose into smaller sub-WOs

**Example:**
- Current: "Build Clipboard Coordination" (0.98) → 44/100
- Decomposed:
  1. "Create Coordinator class" (0.45)
  2. "Implement FocusManager" (0.35)
  3. "Add IPC handlers" (0.30)
  4. "Integration tests" (0.40)

**Effort:** Ongoing research
**Confidence:** 70% (may not reduce actual complexity, just split it)
**Expected impact:** Unknown

**Pros:**
- Each sub-WO within model capability range
- Can execute in parallel

**Cons:**
- Requires decomposition logic (human or AI)
- Dependencies between sub-WOs must be managed
- Overhead of multiple PR reviews

**Recommendation:** RESEARCH NEEDED - test on 2-3 high-complexity WOs first

---

## Implementation Paths

### Path A: Conservative (Data-Driven) - 2 weeks

**Phase 1: Quick Wins (2 days)**
1. PR body truncation fix (2 hrs) - unblock Claude high-complexity testing
2. WO template pilot (4 hrs) - test on 2 WOs, measure impact
3. Validation prototype (10 hrs) - test assertion counter only, validate refinement loop works

**Phase 2: Core Infrastructure (1 week)** - Only proceed if Phase 1 validates assumptions
1. Full Tier 3 Validator (10 hrs) - all 5 validation checks
2. Integration & testing (4 hrs) - test on 10 WOs across complexities
3. Tuning (2 hrs) - optimize thresholds

**Expected:** 75-85/100 on mid complexity

**Phase 3: Optimization (Conditional)** - Only if Phase 2 doesn't meet targets
- Acceptance validator, routing, decomposition

---

### Path B: Aggressive (Fast Track) - 3 days

**Day 1:** PR body fix (2 hrs) + Full Tier 3 Validator (10 hrs)
**Day 2:** Testing & tuning (6 hrs) + WO templates (4 hrs)
**Day 3:** Production rollout + monitoring (8 hrs)

**Risk:** Skips feasibility validation, may need rework if assumptions wrong

---

## Cost Context

**Current costs per work order:**
- gpt-4o-mini: $0.05
- Claude 4.5: $1.00

**Projected with Tier 3 Validator:**
- gpt-4o-mini: $0.07 (+40% for additional refinement)
- Claude 4.5: $1.05 (+5%)

**Break-even analysis:**
If validator reduces manual review time by 15 minutes:
- Manual review cost: $50/hr → $12.50 per 15 min
- Validator cost increase: $0.02/WO
- **Net savings: $12.48 per WO**

**Hybrid routing cost:**
- Would increase average cost to $0.50/WO (10x current)
- Only justified if quality improvement is critical

---

## Questions for You

As an experienced AI strategist, please help me think through:

### Priority & Sequencing
1. **Which solution should be implemented first?** Tier 3 Validator (95% confidence, 10 hrs) or WO Template improvements (80% confidence, 4 hrs)?

2. **Is the Conservative path worth the 2-week timeline**, or should I take the Aggressive 3-day path given 95% confidence in the validator?

3. **Should I implement solutions in sequence or parallel?** For example, could WO templates + validator be done concurrently, or does one inform the other?

### Risk Assessment
4. **What's the biggest risk I'm not seeing?** Given the identical test generation failure (0/10) across both models, what does this tell us about the root cause?

5. **The "unknown" about refinement loop effectiveness** - if models receive "missing test assertions" feedback, will they actually fix it, or repeat mistakes? How would you de-risk this before full implementation?

6. **Work order template improvements** - I'm concerned longer WOs might exceed context windows. How would you pilot test this safely?

### Cost vs Quality Trade-offs
7. **Is gpt-4o-mini + Tier 3 Validator (75-80/100, $0.07/WO) the right choice** vs Claude + Tier 3 Validator (80-85/100, $1.05/WO)? The 5-10 point difference costs 15x more.

8. **Hybrid routing** costs 10x more but only improves mid-complexity by +8 points (still fails target by -9). When, if ever, does this make sense?

### Strategic Direction
9. **Given the statistical correlation (R²=0.94) between complexity and failure**, should I focus more on reducing WO complexity (decomposition) rather than trying to make models handle high complexity?

10. **The test generation failure is identical across models** - does this suggest it's a fundamental limitation of current LLMs under cognitive load? If so, is programmatic validation the ONLY reliable solution?

### Validation Strategy
11. **Should the validator be strict (reject immediately) or lenient (multiple chances)?** What's the optimal refinement limit before escalation - 3 attempts? 5? 7?

12. **What metrics should I track during pilot testing** to know if the validator is working? Beyond score improvement, what leading indicators matter?

### Long-term Thinking
13. **Is there a fundamental ceiling here?** If both gpt-4o-mini and Claude fail similarly at mid complexity, and prompts show diminishing returns, what does this mean for scaling to high complexity work?

14. **Should I be thinking about this differently?** Am I solving the right problem, or is there a better framing (e.g., focus on human-AI collaboration rather than full automation)?

---

## What I Need From You

Please provide:

1. **Your recommendation on implementation path** (Conservative vs Aggressive) with reasoning
2. **Priority ranking of the 5 solutions** (1-5, with rationale)
3. **Biggest risks I should mitigate** before proceeding
4. **Any alternative approaches** I haven't considered
5. **Metrics/experiments to run** in Phase 1 to validate assumptions

Please think step-by-step and challenge my assumptions where appropriate. I want to make sure I'm solving the right problem in the right way.
