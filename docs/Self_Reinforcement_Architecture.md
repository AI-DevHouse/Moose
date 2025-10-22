# Moose Self-Reinforcement Architecture
**Version:** v1.0-refined
**Date:** 2025-10-16
**Status:** Design Complete - Ready for Implementation
**Author:** Claude Code + Court + GPT Review

---

## Purpose

This document defines the complete self-reinforcement learning architecture for Moose Mission Control, integrating two complementary feedback loops:

1. **Proposer Learning (Micro Loop)** - WO-level code quality improvement
2. **Iterative Improvement (Macro Loop)** - System-level quality evolution

The architecture enables Moose to autonomously improve both individual work order quality and overall orchestration capabilities through data-driven feedback and supervised human governance.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Two-Loop Design](#two-loop-design)
3. [GPT Refinements](#gpt-refinements)
4. [Database Schema](#database-schema)
5. [Implementation Phases](#implementation-phases)
6. [Integration Points](#integration-points)
7. [Success Metrics](#success-metrics)
8. [Governance Model](#governance-model)
9. [Reference Documentation](#reference-documentation)

---

## Architecture Overview

### The Core Problem

**Current State:**
- ✅ Proposer generates code that compiles (TypeScript error checking)
- ❌ No measurement of code quality (architecture, readability, completeness)
- ❌ No test execution validation
- ❌ No learning from patterns across work orders
- ❌ No system-level quality measurement

**Goal State:**
- ✅ Multi-dimensional quality measurement (5 rubrics)
- ✅ Automated test execution and validation
- ✅ Pattern learning from failures
- ✅ Automatic prompt improvement
- ✅ System evolution through supervised iteration

---

## Two-Loop Design

### Visual Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  TWO-LOOP SELF-REINFORCEMENT ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LEFT LOOP: Proposer/Trainer (Micro)                            │
│  ┌──────────────────────────────────┐                           │
│  │ WO Execution → Acceptance Check  │ ← Per-dimension scores    │
│  │    ↓                             │   (Architecture, Tests,   │
│  │ dimension_scores < 7/10?         │    Completeness, etc.)    │
│  │    ↓                             │                           │
│  │ Generate Delta Enhancement       │                           │
│  │    ↓                             │                           │
│  │ Inject into next WO prompt       │                           │
│  └──────────────────────────────────┘                           │
│                                                                  │
│  CENTER: Main WO Flow                                            │
│  Tech Spec → Decompose → Complexity → Proposer → Code → PR →   │
│  Acceptance → Logs → Performance Benchmarks                      │
│                                                                  │
│  RIGHT LOOP: Iterative Improvement (Macro)                       │
│  ┌──────────────────────────────────┐                           │
│  │ Build Full App (10-15 WOs)       │                           │
│  │    ↓                             │                           │
│  │ Score with 1-10 Rubric           │ ← Same 5 dimensions       │
│  │    ↓                             │                           │
│  │ Analyze: What failed?            │                           │
│  │    ↓                             │                           │
│  │ Propose Moose Code Changes       │                           │
│  │    ↓                             │                           │
│  │ [Human Approval Gate]            │ ← Supervised mode         │
│  │    ↓                             │                           │
│  │ Apply Changes → Next Iteration   │                           │
│  └──────────────────────────────────┘                           │
│                                                                  │
│  FEEDBACK CONNECTION:                                            │
│  Macro findings → prompt_enhancements DB → Micro loop injection │
└─────────────────────────────────────────────────────────────────┘
```

### Loop Comparison

| Aspect | Micro Loop (Proposer Learning) | Macro Loop (Iterative Improvement) |
|--------|--------------------------------|------------------------------------|
| **Scope** | Individual WO | Full application (10-15 WOs) |
| **Frequency** | After each WO | Weekly/on-demand |
| **Metric** | TypeScript errors, compile success, acceptance scores | 1-10 rubric across 5 dimensions |
| **Feedback Delay** | Immediate | After full build |
| **Trainer** | Claude Sonnet 4.5 (meta-AI) | Claude Code + Human |
| **Output** | Prompt enhancements in DB | Code changes to Moose |
| **Automation** | Fully automated | Supervised (human approval) |
| **Data Source** | `proposer_failures`, `work_orders.acceptance_result` | `test_iterations`, `iteration_work_order_logs` |

---

## GPT Refinements

Five critical refinements from GPT review (incorporated into design):

### 1. **Per-Dimension Acceptance Scoring** 🔥 CRITICAL

**Problem:** Single aggregate score loses granularity
**Solution:** Calculate 5 sub-scores matching macro rubric

**Implementation:**
```typescript
interface AcceptanceResult {
  dimension_scores: {
    architecture: number;      // 1-10 based on file sizes, complexity
    readability: number;        // 1-10 based on complexity, lint warnings
    completeness: number;       // 1-10 based on TODO count, build success
    test_coverage: number;      // 1-10 based on % coverage, tests passed
    build_success: number;      // 10 if builds, 0 if fails
  };
  acceptance_score: number;     // Weighted aggregate (matches macro weights)
  build_passed: boolean;
  tests_passed: boolean;
  lint_errors: number;
  todo_count: number;
  test_coverage_percent: number;
  timestamp: string;
}
```

**Benefits:**
- ✅ Immediate rubric-based feedback at WO level
- ✅ Micro/macro alignment (same 5 dimensions)
- ✅ Enables targeted prompt enhancements ("Architecture: 4/10 → focus on file size")

### 2. **Delta-Only Prompt Enhancement** 🔥 CRITICAL

**Problem:** Injecting all enhancements → prompt bloat → context overflow
**Solution:** Only inject improvements/regressions from last WO

**Logic:**
```typescript
async function getRelevantEnhancements(request: ProposerRequest): Promise<string[]> {
  // 1. Base enhancements (general-purpose, always active)
  const baseEnhancements = await getActiveBaseEnhancements();

  // 2. Delta enhancements (only for dimensions that scored <7/10 last time)
  const lastWoAcceptance = await getLastWorkOrderAcceptance(request.expected_output_type);

  if (lastWoAcceptance) {
    const deltaEnhancements = [];

    if (lastWoAcceptance.dimension_scores.completeness < 7) {
      deltaEnhancements.push(
        `⚠️ Last WO had ${lastWoAcceptance.todo_count} TODOs. Implement all functionality completely.`
      );
    }

    if (lastWoAcceptance.dimension_scores.test_coverage < 7) {
      deltaEnhancements.push(
        `⚠️ Last WO had ${lastWoAcceptance.test_coverage_percent}% test coverage. Generate comprehensive tests.`
      );
    }

    return [...baseEnhancements, ...deltaEnhancements];
  }

  return baseEnhancements;
}
```

**Benefits:**
- ✅ Prevents context overflow (inject 5 items, not 50)
- ✅ Context-aware (learns from own recent mistakes)
- ✅ Convergence (fewer enhancements as quality improves)

### 3. **WO Lifecycle Status Refinement**

**Problem:** `needs_rework` used for both execution failures and acceptance failures
**Solution:** Separate semantic statuses

**Status Definitions:**
- `needs_review` - WO executed successfully but failed acceptance criteria (score <7/10)
- `needs_rework` - WO execution failed (compilation error, Aider crash, etc.)
- `completed` - Passed acceptance threshold (≥7/10)

**Implementation:**
```typescript
await supabase.from('work_orders').update({
  acceptance_result: acceptance,
  status: acceptance.acceptance_score >= 7 ? 'completed' : 'needs_review'
}).eq('id', workOrderId);
```

**Benefits:**
- ✅ Semantic clarity (review vs rework distinction)
- ✅ Trainer queue (Manager queries `WHERE status = 'needs_review'`)
- ✅ Human workflow (Court reviews low-scoring WOs)

### 4. **Principle Promotion Governance** 🔥 CRITICAL

**Problem:** Auto-promoting enhancements to base prompt risks quality
**Solution:** Queue for human approval (supervised mode consistency)

**Promotion Criteria:**
- `reduction_rate >= 0.70` (70% error reduction)
- `applications_count >= 30` (statistically significant)
- `consecutive_iterations_active >= 3` (proven over time)

**Workflow:**
1. Weekly cron identifies promotion-worthy enhancements
2. Creates entry in `moose_improvements` table with `status: 'pending_approval'`
3. Court reviews effectiveness data
4. Court approves → enhancement hardcoded into base prompt
5. Court rejects → enhancement stays dynamic

**Implementation:**
```typescript
// In prompt-enhancement-analyzer.ts weekly cron
if (enhancement.reduction_rate >= 0.70 &&
    enhancement.applications_count >= 30 &&
    enhancement.consecutive_iterations_active >= 3) {

  await supabase.from('moose_improvements').insert({
    improvement_type: 'prompt_tuning',
    description: `Promote enhancement "${enhancement.enhancement_text}" to base prompt`,
    expected_impact: `Reduction rate: ${enhancement.reduction_rate}`,
    proposal_details: { enhancement_id: enhancement.id, effectiveness_data: enhancement },
    status: 'pending_approval'
  });
}
```

**Benefits:**
- ✅ Governance consistency (matches supervised loop)
- ✅ Quality gate (human validates before permanent changes)
- ✅ Rollback safety (easier to deactivate in DB than revert code)

### 5. **Documentation Alignment**

**Change:** Update all workflow diagrams to label:
- Left loop: "Proposer/Trainer (Micro)"
- Right loop: "Iterative Improvement (Macro)"

**Benefit:** Self-documenting architecture for future developers

---

## Database Schema

### Existing Tables (Phase 1-2 Complete)

#### `proposer_failures` (Migration 003)
Logs all WO refinement outcomes (100% failures, 10% successes)

**Key Fields:**
- `work_order_id` - Links to WO
- `proposer_name` - Which proposer generated code
- `complexity_score` - 0.0-1.0
- `complexity_band` - "0.3-0.4", etc.
- `initial_errors`, `final_errors` - TypeScript error counts
- `refinement_count` - How many cycles
- `error_codes` - Array of TS error codes
- `sanitizer_changes` - What code-sanitizer fixed
- `is_success` - TRUE for sampled successes
- `failure_category` - Classified error type

#### `prompt_enhancements` (Migration 003)
Stores error-specific prompt improvements managed by meta-AI

**Key Fields:**
- `error_code` - "TS1443", "TS2304", "COMPLETENESS_TODO", etc.
- `enhancement_text` - Prompt text to inject
- `is_active` - TRUE if currently in use
- `reduction_rate` - Effectiveness (0-1)
- `applications_count` - How many times used
- `success_count`, `failure_count` - Outcome tracking
- `target_proposer_names` - NULL = all proposers, or array of specific ones
- `target_complexity_min/max` - Optional targeting

#### `proposer_success_metrics` (Migration 003)
Aggregated performance by proposer + complexity band

#### `proposer_attempts` (Migration 003)
Rolling 50-record window per complexity band

#### `prompt_versions` (Migration 003)
Versioned prompt registry for A/B testing

#### `threshold_experiments` (Migration 003)
A/B testing for complexity threshold increases

### New Tables (Phase 4-5)

#### `work_orders` - Enhanced Schema
**New Field:** `acceptance_result` (JSONB)

```sql
ALTER TABLE work_orders
ADD COLUMN acceptance_result JSONB;

-- Example data structure:
{
  "dimension_scores": {
    "architecture": 7,
    "readability": 8,
    "completeness": 5,
    "test_coverage": 4,
    "build_success": 10
  },
  "acceptance_score": 6.3,
  "build_passed": true,
  "tests_passed": false,
  "lint_errors": 3,
  "todo_count": 5,
  "test_coverage_percent": 42,
  "timestamp": "2025-10-16T10:30:00Z"
}
```

#### `test_iterations` (Phase 5)
Stores quality metrics for each full-app iteration

**Key Fields:**
- `iteration_number` - Sequential counter
- `project_name` - "multi-llm-discussion"
- `moose_version` - Git commit hash
- `status` - 'running', 'completed', 'failed'
- `total_work_orders`, `work_orders_succeeded`, `work_orders_failed`
- `builds_successfully`, `tests_pass`, `lint_errors`
- `human_quality_score` - 1-10 aggregate
- `scoring_details` - JSONB with per-dimension scores
- `analysis_details` - JSONB with Claude Code analysis
- `what_worked`, `what_failed`, `improvements_made` - Text summaries

#### `iteration_work_order_logs` (Phase 5)
Detailed logs for each WO execution within an iteration

**Key Fields:**
- `iteration_id` - Links to test_iterations
- `work_order_id` - Links to work_orders
- `execution_order` - 1st, 2nd, 3rd WO
- `files_modified`, `lines_added`, `lines_deleted`
- `proposer_used`, `aider_model`
- `cost_usd`, `prompt_tokens`, `completion_tokens`
- `compilation_errors`, `test_results` (JSONB)

#### `moose_improvements` (Phase 5)
Tracks changes made to Moose between iterations

**Key Fields:**
- `from_iteration_id`, `to_iteration_id`
- `improvement_type` - 'bug_fix', 'feature_add', 'prompt_tuning', etc.
- `description` - What was changed and why
- `files_changed` - Array of file paths
- `git_commit_hash` - Reference to commit
- `expected_impact`, `actual_impact` - Text descriptions
- `proposal_details` - JSONB with full proposal
- `status` - **NEW:** 'pending_approval', 'approved', 'rejected', 'applied'

---

## Implementation Phases

### Phase 1: Code Sanitizer ✅ COMPLETE
**Status:** Implemented (commit bb1f946)

**Deliverables:**
- ✅ `src/lib/code-sanitizer.ts` (13 correction functions)
- ✅ Integration into `proposer-refinement-rules.ts`
- ✅ Telemetry logging

### Phase 2: Learning Pipeline ✅ 90% COMPLETE
**Status:** Database + logger implemented, migration needs verification

**Deliverables:**
- ✅ Migration 003 (6 tables) created
- ✅ `src/lib/proposer-failure-logger.ts` implemented
- ✅ Integration into `enhanced-proposer-service.ts:372`
- ⚠️ **TODO:** Verify migration applied to Supabase

### Phase 3: Proposer Learning (Micro Loop) 🔨 READY TO START
**Timeline:** Week 1 (5-7 days)
**Complexity:** Medium

**Tasks:**

#### 3.1 Verify Database Setup
```bash
# Run check script
npx tsx scripts/check-proposer-learning.ts

# If tables missing, apply migration:
# 1. Open Supabase SQL Editor
# 2. Paste scripts/migrations/003_proposer_learning_system.sql
# 3. Execute
# 4. Verify 6 tables created
```

#### 3.2 Create Prompt Enhancement Analyzer
**File:** `src/lib/prompt-enhancement-analyzer.ts`

**Functions:**
1. `analyzeEnhancementEffectiveness()` - Compare error rates WITH vs WITHOUT each enhancement
2. `generateNewEnhancement()` - Ask Claude Sonnet 4.5 to create prompts for uncovered patterns
3. `improveIneffectiveEnhancement()` - Rewrite enhancements with <50% reduction rate
4. `runAutoImprovement()` - Weekly cron orchestrator

**Example Logic:**
```typescript
export async function analyzeEnhancementEffectiveness(): Promise<AnalysisReport> {
  const activeEnhancements = await getActiveEnhancements();
  const results = [];

  for (const enhancement of activeEnhancements) {
    // Get WOs where enhancement was applied
    const withEnhancement = await getWorkOrdersWithEnhancement(enhancement.id);

    // Get comparable WOs without enhancement (same complexity band, same proposer)
    const withoutEnhancement = await getComparableWorkOrdersWithout(enhancement.id);

    // Calculate reduction rate
    const errorFreqWith = calculateErrorFrequency(withEnhancement, enhancement.error_code);
    const errorFreqWithout = calculateErrorFrequency(withoutEnhancement, enhancement.error_code);

    const reduction_rate = (errorFreqWithout - errorFreqWith) / errorFreqWithout;

    // Update database
    await supabase.from('prompt_enhancements').update({
      reduction_rate,
      last_effectiveness_check: new Date().toISOString()
    }).eq('id', enhancement.id);

    results.push({ enhancement_id: enhancement.id, reduction_rate, recommendation: ... });
  }

  return { results, summary: ... };
}
```

#### 3.3 Create Prompt Injector (Delta-Aware)
**File:** `src/lib/prompt-injector.ts`

**Function:** `getRelevantEnhancements(request: ProposerRequest): Promise<string[]>`

**Integration:** Modify `enhanced-proposer-service.ts:689, 700`
```typescript
private async buildClaudePrompt(request: ProposerRequest): Promise<string> {
  const basePrompt = `Task: ${request.task_description}
Context: ${request.context.join('\n')}
Expected Output Type: ${request.expected_output_type}`;

  // NEW: Inject relevant enhancements (base + delta)
  const enhancements = await getRelevantEnhancements(request);
  const enhancementText = enhancements.join('\n\n');

  return `${basePrompt}\n\n${enhancementText ?
    `IMPORTANT GUIDELINES:\n${enhancementText}` : ''}`;
}
```

#### 3.4 Wire Weekly Cron Job
**Options:**
- GitHub Actions (`.github/workflows/weekly-meta-ai.yml`)
- Vercel Cron (if deployed)
- Local cron job (for testing)

**Trigger:** `runAutoImprovement()` every Sunday at 00:00 UTC

### Phase 4: Acceptance Criteria (Micro Loop Enhancement) 🔨 READY TO START
**Timeline:** Week 2 (5-7 days)
**Complexity:** Medium

**Tasks:**

#### 4.1 Create Acceptance Validator
**File:** `src/lib/acceptance-validator.ts`

**Functions:**
1. `validateWorkOrderAcceptance(woId, prUrl): Promise<AcceptanceResult>`
2. `calculateArchitectureScore(fileSizes, complexity): number`
3. `calculateReadabilityScore(complexity, lintWarnings): number`
4. `calculateCompletenessScore(todoCount, buildSuccess): number`
5. `calculateTestCoverageScore(coverage, testsPassed): number`

**Example Implementation:**
```typescript
export async function validateWorkOrderAcceptance(
  woId: string,
  prUrl: string
): Promise<AcceptanceResult> {
  const projectPath = await getProjectPathFromWO(woId);

  // Run automated checks
  const buildResult = await runCommand('npm run build', projectPath);
  const testResult = await runCommand('npm test -- --coverage', projectPath);
  const lintResult = await runCommand('npm run lint', projectPath);

  // Extract metrics
  const todoCount = await countTodosInChangedFiles(prUrl);
  const testCoverage = await extractCoveragePercent(testResult.output);
  const fileSizes = await analyzeFileSizes(prUrl);
  const complexity = await calculateCyclomaticComplexity(prUrl);

  // Calculate per-dimension scores
  const dimensionScores = {
    architecture: calculateArchitectureScore(fileSizes, complexity),
    readability: calculateReadabilityScore(complexity, lintResult.warnings),
    completeness: calculateCompletenessScore(todoCount, buildResult.success),
    test_coverage: calculateTestCoverageScore(testCoverage, testResult.passed),
    build_success: buildResult.success ? 10 : 0
  };

  // Weighted aggregate (matches macro rubric)
  const acceptance_score = (
    dimensionScores.architecture * 0.25 +
    dimensionScores.readability * 0.15 +
    dimensionScores.completeness * 0.25 +
    dimensionScores.test_coverage * 0.20 +
    dimensionScores.build_success * 0.15
  );

  return {
    dimension_scores: dimensionScores,
    acceptance_score,
    build_passed: buildResult.success,
    tests_passed: testResult.success,
    lint_errors: lintResult.errorCount,
    todo_count: todoCount,
    test_coverage_percent: testCoverage,
    timestamp: new Date().toISOString()
  };
}
```

#### 4.2 Integrate into Aider Executor
**File:** `src/lib/orchestrator/aider-executor.ts`

**Integration Point:** After PR creation (around line 250)

```typescript
// After PR created successfully
if (prUrl) {
  console.log('✅ PR created:', prUrl);

  // NEW: Run acceptance validation
  const acceptance = await validateWorkOrderAcceptance(workOrderId, prUrl);

  // Store result and update status
  await supabase.from('work_orders').update({
    acceptance_result: acceptance,
    status: acceptance.acceptance_score >= 7 ? 'completed' : 'needs_review'
  }).eq('id', workOrderId);

  // Log results
  console.log('📊 ACCEPTANCE VALIDATION:', {
    score: acceptance.acceptance_score.toFixed(1),
    dimensions: acceptance.dimension_scores,
    status: acceptance.acceptance_score >= 7 ? 'PASSED' : 'NEEDS REVIEW'
  });
}
```

#### 4.3 Update Database Schema
```sql
-- Add acceptance_result field
ALTER TABLE work_orders
ADD COLUMN acceptance_result JSONB;

-- Create index for querying low-scoring WOs
CREATE INDEX idx_work_orders_acceptance_score
ON work_orders ((acceptance_result->>'acceptance_score')::numeric)
WHERE acceptance_result IS NOT NULL;

-- Update status enum if needed
ALTER TYPE work_order_status ADD VALUE IF NOT EXISTS 'needs_review';
```

#### 4.4 Create Delta Enhancement Generator
**File:** `src/lib/delta-enhancement-generator.ts`

**Function:** `generateDeltaEnhancements(lastWoAcceptance): string[]`

**Logic:** See Refinement #2 above

#### 4.5 Testing Checklist
- [ ] Run WO, verify `acceptance_result` populated in DB
- [ ] Verify dimension scores calculated correctly
- [ ] Verify status set to `needs_review` when score <7/10
- [ ] Verify delta enhancements injected into next WO prompt
- [ ] Verify no enhancements injected when score ≥7/10

### Phase 5: Iterative Improvement System (Macro Loop) 🔨 FUTURE
**Timeline:** Weeks 3-4 (10-14 days)
**Complexity:** High
**Prerequisite:** Phases 3-4 complete and validated

**Tasks:**

#### 5.1 Create Database Tables
**File:** `scripts/migrations/004_iterative_improvement_system.sql`

- `test_iterations`
- `iteration_work_order_logs`
- `moose_improvements` (add `status` field)

#### 5.2 Create Iteration Test Script
**File:** `scripts/run-iteration-test.mjs`

**Functions:**
1. Record Moose version (git commit)
2. Clean up previous iteration
3. Initialize project via API
4. Decompose spec via API
5. Execute all WOs sequentially
6. Verify isolation (Moose files unchanged)
7. Run build, test, lint on generated app
8. Save metrics to `test_iterations`

#### 5.3 Create Scoring Script
**File:** `scripts/score-iteration.mjs`

**Apply 5-dimension rubric:**
1. Architecture (1-10) - Separation of concerns, file structure
2. Readability (1-10) - Naming, comments, complexity
3. Completeness (1-10) - TODO count, features implemented
4. Test Coverage (1-10) - % coverage, test quality
5. User Experience (1-10) - Error handling, loading states

**Output:** JSON with per-dimension scores + aggregate

#### 5.4 Create Supervised Loop
**File:** `scripts/supervised-improvement-loop.mjs`

**Workflow:**
1. Run iteration test
2. Score results
3. Analyze failures (call Claude Code)
4. Generate proposals (call Claude Code)
5. Create detailed report
6. **[Human Approval Gate]**
7. Apply approved changes
8. Commit to git
9. Next iteration

**Report includes:**
- Iteration summary (scores, metrics)
- Analysis (what failed and why)
- Proposals (file, diff, rationale, testing plan)
- Approval checklist

#### 5.5 Testing Checklist
- [ ] Can run full iteration end-to-end
- [ ] Scores calculated correctly
- [ ] Reports generated and readable
- [ ] Proposals actionable
- [ ] Approval workflow functions
- [ ] Changes applied correctly
- [ ] Rollback works

---

## Integration Points

### Micro → Macro: Acceptance Scores Feed Iterations

```typescript
// In scripts/run-iteration-test.mjs
for (const wo of workOrders) {
  await executeWorkOrder(wo.id);

  // Acceptance validation happens automatically in aider-executor.ts
  const { data: completedWo } = await supabase
    .from('work_orders')
    .select('acceptance_result, status')
    .eq('id', wo.id)
    .single();

  // Log to iteration_work_order_logs
  await supabase.from('iteration_work_order_logs').insert({
    iteration_id: currentIterationId,
    work_order_id: wo.id,
    acceptance_result: completedWo.acceptance_result,
    status: completedWo.status
  });
}

// After all WOs complete, aggregate scores
const iterationScore = calculateIterationScore(workOrderAcceptanceResults);
```

### Macro → Micro: Iteration Findings Feed Prompt Enhancements

```typescript
// In scripts/supervised-improvement-loop.mjs - after human approval
async function applyApprovedProposals(proposals: Proposal[]) {
  for (const proposal of proposals) {
    if (proposal.improvement_type === 'prompt_tuning') {
      // Add to prompt_enhancements table
      await supabase.from('prompt_enhancements').insert({
        error_code: proposal.addresses_error_code,
        enhancement_text: proposal.enhancement_text,
        is_active: true,
        improvement_reason: `From iteration ${currentIterationNumber}: ${proposal.rationale}`,
        applications_count: 0,
        success_count: 0,
        failure_count: 0
      });
    } else if (proposal.improvement_type === 'code_change') {
      // Apply code changes to Moose
      await applyCodeChanges(proposal.file_path, proposal.diff);
      await gitCommit(proposal.description);
    }
  }
}
```

### Meta-AI → Governance: Promotion Workflow

```typescript
// In src/lib/prompt-enhancement-analyzer.ts - weekly cron
async function checkForPromotionCandidates() {
  const candidates = await supabase
    .from('prompt_enhancements')
    .select('*')
    .eq('is_active', true)
    .gte('reduction_rate', 0.70)
    .gte('applications_count', 30)
    .order('reduction_rate', { ascending: false });

  for (const candidate of candidates.data || []) {
    // Check consecutive iterations active
    const iterationCount = await countConsecutiveIterationsActive(candidate.id);

    if (iterationCount >= 3) {
      // Queue for human approval
      await supabase.from('moose_improvements').insert({
        improvement_type: 'prompt_tuning',
        description: `Promote enhancement to base prompt: "${candidate.enhancement_text}"`,
        expected_impact: `Proven ${(candidate.reduction_rate * 100).toFixed(0)}% error reduction over ${candidate.applications_count} applications`,
        proposal_details: {
          enhancement_id: candidate.id,
          effectiveness_data: candidate,
          recommendation: 'Hardcode into buildClaudePrompt base template'
        },
        status: 'pending_approval'
      });

      console.log(`📋 Queued for promotion review: Enhancement ${candidate.id}`);
    }
  }
}
```

---

## Success Metrics

### Micro Loop (Proposer Learning) Targets

| Metric | Baseline | Target (3 months) | Measurement |
|--------|----------|-------------------|-------------|
| **WO Acceptance Rate** | ~60% (compile only) | 80% (≥7/10 score) | `COUNT(*) WHERE acceptance_score >= 7 / COUNT(*)` |
| **Average Acceptance Score** | N/A (not measured) | 7.5/10 | `AVG(acceptance_score)` |
| **Test Coverage** | 0% (not generated) | 60%+ average | `AVG(test_coverage_percent)` |
| **TODO Count** | ~8 per WO | <2 per WO | `AVG(todo_count)` |
| **Enhancement Effectiveness** | N/A | 70%+ reduction rate | `AVG(reduction_rate) WHERE is_active = TRUE` |
| **GPT-4o-mini Coverage** | 30% of WOs | 80% of WOs | `COUNT(*) WHERE proposer = 'gpt-4o-mini' / COUNT(*)` |

### Macro Loop (Iterative Improvement) Targets

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| **Overall Quality Score** | 5-6/10 (estimated) | 8+/10 for 3 consecutive iterations | From `test_iterations.human_quality_score` |
| **Build Success Rate** | 100% (already working) | 100% maintained | `builds_successfully` |
| **Test Pass Rate** | Unknown (not run) | 100% | `tests_pass` |
| **Architecture Score** | Estimated 6/10 | 8+/10 | From scoring rubric |
| **Completeness Score** | Estimated 5/10 | 8+/10 | From scoring rubric |
| **Iterations to Target** | N/A | 10-15 iterations | Count until 3 consecutive 8+/10 |

### System-Wide Targets

| Metric | Target | Timeline |
|--------|--------|----------|
| **Cost Reduction** | 50% (via 4o-mini optimization) | 3 months |
| **WO Execution Time** | <5 min average | 3 months |
| **Human Intervention Rate** | <10% of WOs need manual fixes | 6 months |
| **Autonomous Operation** | Macro loop autonomous (human approves quarterly) | 6 months |

---

## Governance Model

### Supervised Mode (Default)

**Applies To:**
- Macro loop (always supervised initially)
- Prompt enhancement promotion (always supervised)

**Human Approval Required For:**
- ✅ Code changes to Moose
- ✅ Promoting enhancements to base prompt
- ✅ Switching proposer complexity thresholds
- ✅ Major architectural changes

**Auto-Approved (No Human Gate):**
- ✅ Adding enhancements to `prompt_enhancements` table
- ✅ Updating `reduction_rate` statistics
- ✅ Logging WO acceptance results
- ✅ Micro loop operation (fully automated)

### Transition to Autonomous (Future)

**Criteria for Autonomous Macro Loop:**
- ✅ 10+ supervised iterations completed successfully
- ✅ 80%+ approval rate on proposals (human agrees with analysis)
- ✅ No regressions (scores don't decrease after approved changes)
- ✅ Human explicitly opts in

**Safeguards in Autonomous Mode:**
- ⚠️ Changes still committed with descriptive messages (review via git log)
- ⚠️ Build verification after each change (auto-rollback on failure)
- ⚠️ Weekly reports emailed to Court
- ⚠️ Can switch back to supervised at any time

---

## Reference Documentation

### Source Documents
1. `docs/Discussion - Proposer_Code_Improvement(2).txt` - Phase 1-3 plan
2. `docs/Discussion_Self_Reinforcement_Learning.txt` - Macro loop (Iterative Improvement)
3. `docs/Discussion_Self_Reinforcement_Learning(2).txt` - Original two-loop proposal
4. `docs/Discussion_Self_Reinforcement_Learning(3).txt` - GPT refinements

### Implementation Files
1. ✅ `src/lib/code-sanitizer.ts` - Phase 1 complete
2. ✅ `src/lib/proposer-failure-logger.ts` - Phase 2 complete
3. ✅ `scripts/migrations/003_proposer_learning_system.sql` - Phase 2 database
4. 🔨 `src/lib/prompt-enhancement-analyzer.ts` - Phase 3 TODO
5. 🔨 `src/lib/prompt-injector.ts` - Phase 3 TODO
6. 🔨 `src/lib/acceptance-validator.ts` - Phase 4 TODO
7. 🔨 `src/lib/delta-enhancement-generator.ts` - Phase 4 TODO
8. 🔨 `scripts/migrations/004_iterative_improvement_system.sql` - Phase 5 TODO
9. 🔨 `scripts/run-iteration-test.mjs` - Phase 5 TODO
10. 🔨 `scripts/score-iteration.mjs` - Phase 5 TODO
11. 🔨 `scripts/supervised-improvement-loop.mjs` - Phase 5 TODO

### Related Documentation
- `docs/SCORING_RUBRICS.md` - Detailed 1-10 rubrics for each dimension (TODO - Phase 5)
- `docs/SUPERVISED_LOOP_GUIDE.md` - How to use the supervised loop (TODO - Phase 5)
- `docs/session_updates/SESSION_HANDOVER_MASTER.md` - §5.1 Working Behaviour Standards

---

## Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| v1.0-refined | 2025-10-16 | Initial comprehensive design incorporating GPT refinements | Claude Code + Court |

---

**Status:** Ready for Phase 3 implementation. Phases 1-2 complete, database verified pending.

**Next Action:** Run `npx tsx scripts/check-proposer-learning.ts` to verify migration 003 applied, then begin Phase 3.1.
