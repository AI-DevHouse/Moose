# Phase 2 Implementation Plan - v149

**Session:** v149 (2025-10-30)
**Status:** Ready to Start
**Prerequisites:** Phase 1 Complete (Direct Aider Architecture)

---

## Overview

Phase 2 extends the direct Aider architecture with:
1. **Claude Review System** - Error analysis and fixing for compilation failures
2. **Test Generation** - Automated test creation for all WOs
3. **Compilation Warning Tracking** - Structured logging for 1-5 error threshold
4. **Acceptance Validator Improvements** - 4 critical fixes + safety enhancements

---

## Implementation Order & Dependencies

### **Week 1: Core Infrastructure**

#### **Priority 1: Test Generation (CRITICAL - Blocks Everything)**

**Rationale:** Tests must be generated BEFORE we can validate them. This unblocks Acceptance Validator improvements and Sentinel enhancements.

**Tasks:**
1. ✅ **Add test generation to Aider prompt** (`src/lib/orchestrator/aider-executor.ts:89-102`)
   - Add instructions to write comprehensive tests
   - Specify 80%+ coverage target
   - Include test file naming conventions
   - **Estimated Time:** 30 minutes
   - **Risk:** Low (additive change)

2. ✅ **Update Architect decomposition rules** (`src/lib/architect-decomposition-rules.ts:110-160`)
   - Include test files in `files_in_scope` examples
   - Update prompt to specify test file patterns
   - Add test file generation instruction
   - **Estimated Time:** 1 hour
   - **Risk:** Medium (affects all future decompositions)

3. ✅ **Create validation script** (`scripts/validate-test-generation.ts`)
   - Test WO execution with new prompts
   - Verify test files created
   - Verify tests run and pass
   - Verify coverage measured
   - **Estimated Time:** 1 hour
   - **Risk:** Low (testing only)

**Validation:**
```bash
# Run test validation
npx tsx scripts/validate-test-generation.ts

# Expected output:
# ✅ Test file created: lib/math.test.ts
# ✅ Tests pass: 5/5
# ✅ Coverage: 92%
```

---

#### **Priority 2: Database Schema (Foundation for Tracking)**

**Tasks:**
4. ✅ **Create `compilation_warnings` table**
   ```sql
   CREATE TABLE compilation_warnings (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     work_order_id UUID REFERENCES work_orders(id),
     error_count INT NOT NULL,
     errors JSONB NOT NULL,
     fixed_at TIMESTAMPTZ,
     fix_commit_hash TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```
   - **Location:** `supabase/migrations/20251030_compilation_warnings.sql`
   - **Estimated Time:** 30 minutes
   - **Risk:** Low (additive schema)

5. ✅ **Create `claude_reviews` table**
   ```sql
   CREATE TABLE claude_reviews (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     work_order_id UUID REFERENCES work_orders(id),
     success BOOLEAN NOT NULL,
     iterations INT NOT NULL,
     initial_errors INT NOT NULL,
     final_errors INT NOT NULL,
     error_analysis JSONB,
     fixes_applied JSONB,
     execution_time_ms INT,
     cost_usd NUMERIC,
     escalation_reason TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```
   - **Location:** `supabase/migrations/20251030_claude_reviews.sql`
   - **Estimated Time:** 30 minutes
   - **Risk:** Low (additive schema)

**Validation:**
```bash
# Apply migrations
supabase db push

# Verify tables
npx tsx scripts/check-schema.ts
```

---

### **Week 1: Claude Review System**

#### **Priority 3: Claude Review Service**

**Tasks:**
6. ✅ **Create review-service.ts** (`src/lib/orchestrator/review-service.ts`)
   - **Functions:**
     - `claudeReviewLoop()` - Main entry point (2-iteration limit)
     - `claudeAnalyzeAndFix()` - LLM call for error analysis
     - `applyFixes()` - Apply code changes
     - `checkProgress()` - Validate error reduction
   - **Error Handling:**
     - Immediate escalation if errors increase
     - Max 2 iterations before escalation
     - Timeout after 5 minutes per iteration
   - **Estimated Time:** 4-6 hours
   - **Risk:** High (complex logic, LLM integration)

7. ✅ **Create review-error-analyzer.ts** (`src/lib/orchestrator/review-error-analyzer.ts`)
   - Parse TypeScript errors into structured format
   - Identify error patterns (import, type, syntax)
   - Generate fix strategies
   - **Estimated Time:** 2 hours
   - **Risk:** Medium

8. ✅ **Create review types** (`src/types/review.ts`)
   - `ClaudeReviewResult` interface
   - `ErrorPattern` interface
   - `ReviewConfig` interface
   - **Estimated Time:** 30 minutes
   - **Risk:** Low

**File Structure:**
```
src/lib/orchestrator/
├── review-service.ts          # Main Claude Review logic
├── review-error-analyzer.ts   # Error pattern analysis
└── types.ts                   # Extend with review types

src/types/
└── review.ts                  # Review-specific types
```

---

#### **Priority 4: Orchestrator Integration**

**Tasks:**
9. ✅ **Integrate Claude Review into orchestrator** (`src/lib/orchestrator/orchestrator-service.ts:319-356`)
   - Replace current "escalate" block with Claude Review call
   - Log compilation warnings (1-5 errors) to database
   - Update WO metadata with review outcomes
   - Handle escalation to Client Manager on review failure
   - **Estimated Time:** 2 hours
   - **Risk:** High (critical path, affects all WO executions)

**Code Changes:**
```typescript
// orchestrator-service.ts:319-356

if (compilationResult.decision === 'proceed') {
  // 0 errors → Continue to PR

} else if (compilationResult.decision === 'warn') {
  // 1-5 errors → Log + Continue + Queue for post-build fix
  await supabase.from('compilation_warnings').insert({
    work_order_id: workOrderId,
    error_count: compilationResult.error_count,
    errors: compilationResult.errors
  });

  await supabase.from('work_orders').update({
    metadata: {
      ...wo.metadata,
      has_compilation_warnings: true
    }
  }).eq('id', workOrderId);

  console.warn(`[Orchestrator] ${compilationResult.error_count} warnings logged, continuing to PR`);

} else if (compilationResult.decision === 'escalate') {
  // 6+ errors → Claude Review
  console.log(`[Orchestrator] Escalating to Claude Review...`);

  const reviewResult = await claudeReviewService.reviewAndFix(
    wo,
    compilationResult.errors,
    projectPath
  );

  if (reviewResult.success) {
    console.log(`[Orchestrator] Claude Review succeeded: ${reviewResult.initial_errors} → ${reviewResult.final_errors} errors`);
    // Continue to PR
  } else {
    console.error(`[Orchestrator] Claude Review failed: ${reviewResult.escalation_reason}`);
    await escalateToClientManager(wo, reviewResult);
    throw new Error(`Claude Review failed: ${reviewResult.escalation_reason}`);
  }

  // Log review outcome
  await supabase.from('claude_reviews').insert({
    work_order_id: workOrderId,
    success: reviewResult.success,
    iterations: reviewResult.iterations,
    initial_errors: reviewResult.initial_errors,
    final_errors: reviewResult.final_errors,
    error_analysis: reviewResult.error_analysis,
    execution_time_ms: reviewResult.execution_time_ms,
    cost_usd: reviewResult.cost_usd,
    escalation_reason: reviewResult.escalation_reason
  });
}
```

---

### **Week 2: Acceptance Validator Improvements**

#### **Priority 5: Critical Fixes**

**Tasks:**
10. ✅ **Fix Issue #1: Build safety wrapper** (`src/lib/acceptance-validator.ts:243-258`)
    - Validate package.json exists
    - Check for suspicious build scripts (rm -rf, curl, eval)
    - Add environment isolation
    - **Estimated Time:** 2 hours
    - **Risk:** Medium (security-critical)

11. ✅ **Fix Issue #2: Improve coverage extraction** (`src/lib/acceptance-validator.ts:377-394`)
    - Return `CoverageResult` with confidence score
    - Distinguish "no tests" from "failed to parse"
    - Support multiple test frameworks (Jest, Vitest, Istanbul)
    - **Estimated Time:** 1.5 hours
    - **Risk:** Low

12. ✅ **Fix Issue #3: Use cyclomatic complexity** (`src/lib/acceptance-validator.ts:359-375`)
    - Replace simple grep heuristic with ESLint complexity check
    - Calculate average complexity per function
    - Fall back to simple heuristic on ESLint failure
    - **Estimated Time:** 2 hours
    - **Risk:** Medium (requires ESLint integration)

13. ✅ **Fix Issue #4: Add timeout recovery** (`src/lib/acceptance-validator.ts:243-258`)
    - Implement retry logic with increasing timeouts (2min, 5min)
    - Distinguish timeout errors from build failures
    - Log timeout occurrences for analysis
    - **Estimated Time:** 1 hour
    - **Risk:** Low

---

#### **Priority 6: Test Enforcement**

**Tasks:**
14. ⚠️ **Stricten Acceptance Validator** (`src/lib/acceptance-validator.ts:278-280`)
    - Change "no tests found" from success to failure
    - Update `calculateTestCoverageScore()` to penalize missing tests heavily
    - **DEPENDENCY:** Must deploy AFTER test generation (Priority 1) is working
    - **Estimated Time:** 30 minutes
    - **Risk:** High (will fail all WOs without tests)

**Validation:**
```bash
# Before deploying, verify test generation works:
npx tsx scripts/validate-test-generation.ts

# Then deploy strictness:
# Expected: Future WOs without tests will fail acceptance validation
```

---

### **Week 2: Supporting Features**

#### **Priority 7: Post-Build Fixes & Monitoring**

**Tasks:**
15. ✅ **Create post-build warning fix script** (`scripts/fix-compilation-warnings.ts`)
    - Query WOs with compilation warnings
    - Invoke Claude Review for each
    - Push fixes as amendment commits to existing PRs
    - Clear warning flags after successful fix
    - **Estimated Time:** 3 hours
    - **Risk:** Medium

16. ✅ **Enhance Sentinel test parsing** (`src/lib/sentinel/sentinel-service.ts`)
    - Parse GitHub Actions test output
    - Extract test counts (passed/failed/skipped)
    - Extract coverage percentage
    - Include in `SentinelDecision` output
    - **Estimated Time:** 2 hours
    - **Risk:** Low

---

### **Week 2: End-to-End Validation**

#### **Priority 8: Integration Testing**

**Tasks:**
17. ✅ **Test Phase 2 implementation end-to-end**
    - Create test WO with deliberate TS errors (6+)
    - Verify Claude Review triggers and fixes errors
    - Verify tests are generated
    - Verify Acceptance Validator scores correctly
    - Verify Sentinel parses test results
    - **Estimated Time:** 2-3 hours
    - **Risk:** Low (testing only)

**Test Cases:**
```typescript
// Test Case 1: Claude Review Success
// - WO with 8 TypeScript errors
// - Expected: Claude Review reduces to <5 errors, PR created

// Test Case 2: Claude Review Failure
// - WO with 15 TypeScript errors (complex types)
// - Expected: Claude Review fails after 2 iterations, escalates to human

// Test Case 3: Test Generation
// - WO for simple feature (add function)
// - Expected: Implementation + tests generated, coverage >80%

// Test Case 4: Acceptance Scoring
// - WO with tests, 0 errors
// - Expected: acceptance_score ≥7.0, status='completed'

// Test Case 5: Compilation Warnings
// - WO with 3 TypeScript errors
// - Expected: Logged to compilation_warnings, PR created
```

---

## Success Metrics

### **Phase 2 Targets:**

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| **Claude Review Success Rate** | N/A | 80%+ | `COUNT(success=true) / COUNT(*)` from claude_reviews |
| **Test Coverage** | 0% (not generated) | 70%+ average | `AVG(test_coverage_percent)` from work_orders |
| **Acceptance Pass Rate** | ~40% (estimated) | 70%+ | `COUNT(acceptance_score>=7) / COUNT(*)` |
| **Compilation Gate Escalations** | N/A | <20% of WOs | `COUNT(decision='escalate') / COUNT(*)` |
| **Cost per Claude Review** | N/A | <$0.02 | `AVG(cost_usd)` from claude_reviews |

### **Validation Criteria (Before Moving to Phase 3):**

- ✅ 10+ WOs executed successfully with tests generated
- ✅ Claude Review reduces errors in 8/10 escalations
- ✅ Average test coverage >60%
- ✅ Acceptance Validator correctly scores all 5 dimensions
- ✅ No regressions (Phase 1 direct Aider architecture still works)

---

## Risk Mitigation

### **High-Risk Changes:**

1. **Strictening Acceptance Validator (Task 14)**
   - **Risk:** Will fail all WOs without tests
   - **Mitigation:** Deploy AFTER test generation proven working (Task 1-3)
   - **Rollback:** Revert single function change (acceptance-validator.ts:278)

2. **Orchestrator Integration (Task 9)**
   - **Risk:** Affects all WO executions, could block pipeline
   - **Mitigation:** Add feature flag `ENABLE_CLAUDE_REVIEW` (default: false)
   - **Rollback:** Set flag to false, redeploy

3. **Claude Review Loop (Task 6)**
   - **Risk:** Infinite loops, excessive cost, timeouts
   - **Mitigation:** Hard 2-iteration limit, 5-minute timeout per iteration
   - **Monitoring:** Log all iterations, costs to database

### **Feature Flag Configuration:**

```env
# .env.local
ENABLE_CLAUDE_REVIEW=true           # Enable Claude Review system
CLAUDE_REVIEW_MAX_ITERATIONS=2      # Max review iterations
CLAUDE_REVIEW_TIMEOUT_MS=300000     # 5 minute timeout
ENABLE_TEST_ENFORCEMENT=true        # Fail WOs without tests
COMPILATION_GATE_WARN_THRESHOLD=5   # 1-5 errors = warn
COMPILATION_GATE_ESCALATE_THRESHOLD=6  # 6+ errors = escalate
```

---

## Estimated Total Time

**Week 1:** 16-20 hours
- Test Generation: 2.5 hours
- Database Schema: 1 hour
- Claude Review Service: 8-10 hours
- Orchestrator Integration: 2 hours
- Testing: 2-3 hours

**Week 2:** 12-15 hours
- Acceptance Validator Fixes: 6.5 hours
- Post-Build Fixes: 3 hours
- Sentinel Enhancement: 2 hours
- End-to-End Testing: 2-3 hours

**Total:** 28-35 hours (1.5-2 weeks at 20 hrs/week)

---

## Phase 3 Preview (Future)

After Phase 2 validation complete:

1. **Micro Loop Adaptation** - Aider execution outcomes tracking
2. **Prompt Enhancement Generation** - Weekly analysis of error patterns
3. **Meta-AI Analyzer** - Pattern learning from Claude Review outcomes
4. **Delta Enhancement Injection** - Context-aware prompt improvements

---

## Files Created/Modified

### **New Files (11):**
```
src/lib/orchestrator/review-service.ts
src/lib/orchestrator/review-error-analyzer.ts
src/types/review.ts
supabase/migrations/20251030_compilation_warnings.sql
supabase/migrations/20251030_claude_reviews.sql
scripts/fix-compilation-warnings.ts
scripts/validate-test-generation.ts
scripts/check-schema.ts
docs/session_updates/PHASE_2_IMPLEMENTATION_PLAN.md  # This file
```

### **Modified Files (5):**
```
src/lib/orchestrator/aider-executor.ts              # Add test generation prompt
src/lib/architect-decomposition-rules.ts            # Include test files
src/lib/orchestrator/orchestrator-service.ts        # Integrate Claude Review
src/lib/acceptance-validator.ts                     # 4 fixes + strictness
src/lib/sentinel/sentinel-service.ts                # Parse test output
```

---

## Rollback Plan

If Phase 2 causes issues:

1. **Immediate:** Set `ENABLE_CLAUDE_REVIEW=false` and `ENABLE_TEST_ENFORCEMENT=false`
2. **Week 1:** Revert `orchestrator-service.ts` changes (compilation gate block)
3. **Week 2:** Revert `aider-executor.ts` test prompt additions
4. **Last Resort:** Revert to Phase 1 commit (eff76cd)

All database tables are additive (no drops), so rollback is safe.

---

**Status:** Ready for implementation. Proceed when approved.

**Next Action:** Begin Priority 1 (Test Generation) - estimated 2.5 hours.
