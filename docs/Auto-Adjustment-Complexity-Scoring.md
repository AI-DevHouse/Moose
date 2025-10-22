# Auto-Adjustment of Complexity Scoring
## Based on Multi-Dimensional Implementation Success

**Date:** 2025-10-11
**Status:** Design Document
**Context:** Extending self-learning feedback loop to auto-tune complexity scoring

---

## Executive Summary

**Problem:** Complexity scoring is currently static and over-estimates task difficulty (avg 0.81), leading to inefficient model routing (Claude 4.5 used 3x more than GPT-4o-mini).

**Solution:** Build a feedback loop that adjusts complexity scoring weights and thresholds based on actual implementation outcomes across multiple dimensions:
- Code writing success (TypeScript errors, contract violations)
- Test success (unit tests, integration tests)
- Build success (compilation, bundling)
- PR merge success (approvals, CI/CD passage)
- Production stability (post-deployment errors)

**Key Innovation:** Use multi-dimensional outcome signals, not just "success/failure", to understand which complexity factors matter most for which dimensions.

---

## Current Architecture

### Existing Data Sources (From Production Schema)

**1. outcome_vectors (Code Writing Outcomes)**
```sql
CREATE TABLE IF NOT EXISTS outcome_vectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  cost DECIMAL(10, 4) NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  model_used TEXT NOT NULL,
  diff_size_lines INTEGER,
  failure_classes JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  route_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**2. github_events (Implementation Outcomes)**
```sql
CREATE TABLE IF NOT EXISTS github_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  workflow_name TEXT,
  status TEXT,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**3. decision_logs (Routing Decisions)**
```sql
CREATE TABLE decision_logs (
  id UUID,
  agent_type TEXT,
  decision_type TEXT,
  input_context JSONB,  -- Includes complexity_score used
  decision_output JSONB,
  confidence DECIMAL(5, 2),
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ
);
```

**4. work_orders (Task Context)**
```sql
CREATE TABLE work_orders (
  id UUID,
  title TEXT,
  description TEXT,
  status TEXT,
  complexity_score DECIMAL(5, 2),  -- Current score
  proposer_id UUID,
  actual_cost DECIMAL(10, 2),
  metadata JSONB,
  created_at TIMESTAMPTZ
);
```

### Current Complexity Scoring

**File:** `src/lib/complexity-analyzer.ts`

**ComplexityWeights Interface:**
```typescript
export interface ComplexityWeights {
  codeComplexity: number;
  contextRequirements: number;
  securityImplications: number;
  architecturalImpact: number;
  reasoningDepth: number;
  memoryPressure: number;
  coordinationComplexity: number;
}
```

**Current Default Weights:**
```typescript
{
  codeComplexity: 0.20,
  contextRequirements: 0.10,
  securityImplications: 0.20,
  architecturalImpact: 0.20,
  reasoningDepth: 0.10,
  memoryPressure: 0.10,
  coordinationComplexity: 0.10
}
```

**Scoring Method:** Pattern matching with additive weights

**Problem:** No feedback loop - weights are static

**Supabase Client Pattern:**
```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

---

## Design: Multi-Dimensional Feedback Loop

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Work Order Execution                      │
│  1. Complexity scoring → 2. Model routing → 3. Code gen     │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│              Multi-Dimensional Outcome Tracking              │
│                                                              │
│  Code Writing    Tests      Build      PR/CI      Production │
│   (outcome_    (github_   (github_   (github_   (monitoring) │
│    vectors)     events)    events)    events)                │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│           Complexity Feedback Analyzer (NEW)                 │
│                                                              │
│  - Correlate complexity score with each outcome dimension   │
│  - Identify mis-scored tasks (predicted vs actual)          │
│  - Calculate adjustment signals per factor                   │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│         Complexity Weight Adjuster (NEW)                     │
│                                                              │
│  - Apply gradient descent on weights                        │
│  - Update factor baselines                                  │
│  - Adjust proposer thresholds                               │
│  - Log all adjustments for audit                            │
└─────────────────────────────────────────────────────────────┘
```

### Key Principle: Separation of Concerns

**Complexity scoring should predict:**
1. **Code generation difficulty** → correlate with outcome_vectors.success
2. **Test coverage needs** → correlate with github_events (test workflows)
3. **Build complexity** → correlate with github_events (build workflows)
4. **Integration risk** → correlate with github_events (PR merge success)

**Current problem:** Scoring predicts only #1 (code generation), ignoring #2-4.

---

## New Database Schema

### Table: complexity_learning_samples

**Purpose:** Store training samples for complexity adjustment

```sql
CREATE TABLE complexity_learning_samples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id),

  -- Inputs (what was predicted)
  predicted_complexity DECIMAL(5, 2) NOT NULL,
  complexity_factors JSONB NOT NULL,  -- Full factor breakdown
  complexity_weights JSONB NOT NULL,   -- Weights used at time of prediction
  selected_model TEXT NOT NULL,

  -- Outcomes (what actually happened) - Multi-dimensional
  code_writing_success BOOLEAN,
  code_writing_errors INTEGER,
  code_writing_failure_class TEXT,

  tests_success BOOLEAN,
  tests_passed INTEGER,
  tests_failed INTEGER,
  tests_execution_time_ms INTEGER,

  build_success BOOLEAN,
  build_time_ms INTEGER,
  build_error_count INTEGER,

  pr_merged BOOLEAN,
  pr_review_comments INTEGER,
  pr_merge_time_hours DECIMAL(10, 2),
  ci_checks_passed INTEGER,
  ci_checks_failed INTEGER,

  production_errors_24h INTEGER,  -- For future monitoring integration

  -- Derived metrics
  overall_success BOOLEAN,  -- All dimensions passed
  success_dimensions JSONB,  -- Which dimensions succeeded

  -- Learning metadata
  model_performance_score DECIMAL(5, 2),  -- 0-1 composite score
  was_correctly_routed BOOLEAN,
  routing_error_magnitude DECIMAL(5, 2),  -- How far off was complexity score

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_learning_samples_wo ON complexity_learning_samples(work_order_id);
CREATE INDEX idx_learning_samples_complexity ON complexity_learning_samples(predicted_complexity);
CREATE INDEX idx_learning_samples_model ON complexity_learning_samples(selected_model);
CREATE INDEX idx_learning_samples_routing ON complexity_learning_samples(was_correctly_routed);
```

### Table: complexity_weight_history

**Purpose:** Track how complexity weights evolve over time

```sql
CREATE TABLE complexity_weight_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Weights snapshot
  weights JSONB NOT NULL,  -- { codeComplexity: 0.20, ... }

  -- Adjustment metadata
  adjustment_reason TEXT NOT NULL,  -- 'manual', 'auto_gradient', 'calibration'
  triggered_by TEXT,  -- work_order_id or 'scheduled_calibration'

  -- Performance before adjustment
  performance_before JSONB,  -- { routing_accuracy: 0.65, avg_cost: 2.5, ... }

  -- Expected impact
  expected_improvement TEXT,

  -- Actual impact (filled after next calibration)
  performance_after JSONB,
  actual_improvement DECIMAL(5, 2),  -- % improvement in routing accuracy

  approved_by TEXT,  -- 'system' or 'human'
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weight_history_applied ON complexity_weight_history(applied_at DESC);
```

### Table: proposer_threshold_history

**Purpose:** Track threshold adjustments (complement to weight adjustments)

```sql
CREATE TABLE proposer_threshold_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposer_id UUID NOT NULL REFERENCES proposer_configs(id),

  old_threshold DECIMAL(5, 2) NOT NULL,
  new_threshold DECIMAL(5, 2) NOT NULL,

  adjustment_reason TEXT NOT NULL,
  performance_metrics JSONB,  -- Success rate, cost efficiency, etc.

  approved_by TEXT,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_threshold_history_proposer ON proposer_threshold_history(proposer_id);
```

---

## Component Design

### Component 1: Outcome Aggregator

**File:** `src/lib/learning/outcome-aggregator.ts`

**Purpose:** Collect multi-dimensional outcomes for a work order

```typescript
import { createClient } from '@supabase/supabase-js';

export interface MultiDimensionalOutcome {
  work_order_id: string;

  // Code writing dimension
  code_writing: {
    success: boolean;
    errors: number;
    failure_class?: string;
    execution_time_ms: number;
    model_used: string;
    cost: number;
  };

  // Test dimension
  tests: {
    success: boolean;
    passed: number;
    failed: number;
    execution_time_ms: number;
    coverage_percent?: number;
  };

  // Build dimension
  build: {
    success: boolean;
    time_ms: number;
    error_count: number;
    warnings: number;
  };

  // PR/CI dimension
  pr_ci: {
    pr_merged: boolean;
    review_comments: number;
    merge_time_hours: number;
    ci_checks_passed: number;
    ci_checks_failed: number;
  };

  // Production dimension (future)
  production?: {
    errors_24h: number;
    uptime_percent: number;
  };
}

export class OutcomeAggregator {
  private supabase = createClient(/* ... */);

  /**
   * Aggregate all outcome dimensions for a work order
   */
  async aggregateOutcomes(workOrderId: string): Promise<MultiDimensionalOutcome | null> {
    // 1. Get code writing outcomes
    const { data: outcomeVector } = await this.supabase
      .from('outcome_vectors')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!outcomeVector) return null;

    // 2. Get GitHub events for this WO
    const { data: githubEvents } = await this.supabase
      .from('github_events')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: true });

    // 3. Parse test results
    const testResults = this.parseTestResults(githubEvents);

    // 4. Parse build results
    const buildResults = this.parseBuildResults(githubEvents);

    // 5. Parse PR/CI results
    const prCiResults = this.parsePRResults(githubEvents);

    return {
      work_order_id: workOrderId,
      code_writing: {
        success: outcomeVector.success,
        errors: this.countErrors(outcomeVector.failure_classes),
        failure_class: outcomeVector.failure_classes?.[0],
        execution_time_ms: outcomeVector.execution_time_ms,
        model_used: outcomeVector.model_used,
        cost: outcomeVector.cost
      },
      tests: testResults,
      build: buildResults,
      pr_ci: prCiResults
    };
  }

  private parseTestResults(events: any[]): MultiDimensionalOutcome['tests'] {
    // Find test workflow events
    const testEvents = events.filter(e =>
      e.event_type === 'workflow_run' &&
      (e.workflow_name?.includes('test') || e.workflow_name?.includes('vitest'))
    );

    if (testEvents.length === 0) {
      return { success: false, passed: 0, failed: 0, execution_time_ms: 0 };
    }

    // Get most recent test run
    const latestTest = testEvents[testEvents.length - 1];

    return {
      success: latestTest.status === 'success',
      passed: latestTest.payload?.test_stats?.passed || 0,
      failed: latestTest.payload?.test_stats?.failed || 0,
      execution_time_ms: latestTest.payload?.duration_ms || 0,
      coverage_percent: latestTest.payload?.coverage?.total
    };
  }

  private parseBuildResults(events: any[]): MultiDimensionalOutcome['build'] {
    // Find build workflow events
    const buildEvents = events.filter(e =>
      e.event_type === 'workflow_run' &&
      e.workflow_name?.includes('build')
    );

    if (buildEvents.length === 0) {
      return { success: false, time_ms: 0, error_count: 0, warnings: 0 };
    }

    const latestBuild = buildEvents[buildEvents.length - 1];

    return {
      success: latestBuild.status === 'success',
      time_ms: latestBuild.payload?.duration_ms || 0,
      error_count: latestBuild.payload?.error_count || 0,
      warnings: latestBuild.payload?.warning_count || 0
    };
  }

  private parsePRResults(events: any[]): MultiDimensionalOutcome['pr_ci'] {
    // Find PR events
    const prEvents = events.filter(e => e.event_type === 'pull_request');
    const ciEvents = events.filter(e => e.event_type === 'check_suite');

    if (prEvents.length === 0) {
      return {
        pr_merged: false,
        review_comments: 0,
        merge_time_hours: 0,
        ci_checks_passed: 0,
        ci_checks_failed: 0
      };
    }

    const prEvent = prEvents[prEvents.length - 1];
    const pr = prEvent.payload;

    // Calculate merge time
    const createdAt = new Date(pr.created_at);
    const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null;
    const mergeTimeHours = mergedAt
      ? (mergedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
      : 0;

    // Count CI checks
    const ciPassed = ciEvents.filter(e => e.status === 'success').length;
    const ciFailed = ciEvents.filter(e => e.status === 'failure').length;

    return {
      pr_merged: pr.merged === true,
      review_comments: pr.review_comments || 0,
      merge_time_hours: mergeTimeHours,
      ci_checks_passed: ciPassed,
      ci_checks_failed: ciFailed
    };
  }

  private countErrors(failureClasses: any): number {
    if (!failureClasses || !Array.isArray(failureClasses)) return 0;
    return failureClasses.length;
  }
}
```

### Component 2: Learning Sample Creator

**File:** `src/lib/learning/learning-sample-creator.ts`

**Purpose:** Create training samples from completed work orders

```typescript
export class LearningSampleCreator {
  private supabase = createClient(/* ... */);
  private aggregator = new OutcomeAggregator();

  /**
   * Create a learning sample for a completed work order
   */
  async createSample(workOrderId: string): Promise<void> {
    // 1. Get work order with complexity analysis
    const { data: wo } = await this.supabase
      .from('work_orders')
      .select('*')
      .eq('id', workOrderId)
      .single();

    if (!wo) return;

    // 2. Get routing decision
    const { data: routingDecision } = await this.supabase
      .from('decision_logs')
      .select('*')
      .eq('input_context->work_order_id', workOrderId)
      .eq('decision_type', 'routing')
      .single();

    // 3. Aggregate multi-dimensional outcomes
    const outcomes = await this.aggregator.aggregateOutcomes(workOrderId);

    if (!outcomes) return;

    // 4. Calculate composite success score
    const successScore = this.calculateSuccessScore(outcomes);

    // 5. Determine if routing was correct
    const wasCorrectlyRouted = this.evaluateRouting(
      wo.complexity_score,
      outcomes.code_writing.model_used,
      successScore
    );

    // 6. Calculate routing error magnitude
    const routingError = this.calculateRoutingError(
      wo.complexity_score,
      outcomes,
      successScore
    );

    // 7. Insert learning sample
    await this.supabase
      .from('complexity_learning_samples')
      .insert({
        work_order_id: workOrderId,
        predicted_complexity: wo.complexity_score,
        complexity_factors: wo.metadata?.complexity_factors,
        complexity_weights: wo.metadata?.complexity_weights,
        selected_model: outcomes.code_writing.model_used,

        // Code writing outcomes
        code_writing_success: outcomes.code_writing.success,
        code_writing_errors: outcomes.code_writing.errors,
        code_writing_failure_class: outcomes.code_writing.failure_class,

        // Test outcomes
        tests_success: outcomes.tests.success,
        tests_passed: outcomes.tests.passed,
        tests_failed: outcomes.tests.failed,
        tests_execution_time_ms: outcomes.tests.execution_time_ms,

        // Build outcomes
        build_success: outcomes.build.success,
        build_time_ms: outcomes.build.time_ms,
        build_error_count: outcomes.build.error_count,

        // PR/CI outcomes
        pr_merged: outcomes.pr_ci.pr_merged,
        pr_review_comments: outcomes.pr_ci.review_comments,
        pr_merge_time_hours: outcomes.pr_ci.merge_time_hours,
        ci_checks_passed: outcomes.pr_ci.ci_checks_passed,
        ci_checks_failed: outcomes.pr_ci.ci_checks_failed,

        // Derived
        overall_success: this.isOverallSuccess(outcomes),
        success_dimensions: this.getSuccessDimensions(outcomes),
        model_performance_score: successScore,
        was_correctly_routed: wasCorrectlyRouted,
        routing_error_magnitude: routingError
      });
  }

  /**
   * Calculate composite success score (0-1) across all dimensions
   */
  private calculateSuccessScore(outcomes: MultiDimensionalOutcome): number {
    const weights = {
      code_writing: 0.4,  // Most important
      tests: 0.25,
      build: 0.20,
      pr_ci: 0.15
    };

    const codeScore = outcomes.code_writing.success ? 1.0 : 0.0;
    const testScore = outcomes.tests.success ? 1.0 :
      outcomes.tests.passed / (outcomes.tests.passed + outcomes.tests.failed);
    const buildScore = outcomes.build.success ? 1.0 : 0.0;
    const prScore = outcomes.pr_ci.pr_merged ? 1.0 :
      (outcomes.pr_ci.ci_checks_passed /
       (outcomes.pr_ci.ci_checks_passed + outcomes.pr_ci.ci_checks_failed + 1));

    return (
      codeScore * weights.code_writing +
      testScore * weights.tests +
      buildScore * weights.build +
      prScore * weights.pr_ci
    );
  }

  /**
   * Determine if model selection was appropriate for complexity
   */
  private evaluateRouting(
    predictedComplexity: number,
    actualModel: string,
    successScore: number
  ): boolean {
    // If GPT-4o-mini was used and succeeded → good routing
    if (actualModel === 'gpt-4o-mini' && successScore >= 0.8) {
      return true;
    }

    // If Claude 4.5 was used and task was truly complex → good routing
    if (actualModel.includes('claude') && predictedComplexity >= 0.45) {
      return true;
    }

    // If GPT-4o-mini failed on complex task → bad routing (under-estimated)
    if (actualModel === 'gpt-4o-mini' && successScore < 0.5 && predictedComplexity < 0.45) {
      return false;
    }

    // If Claude 4.5 was used on simple task → bad routing (over-estimated)
    if (actualModel.includes('claude') && successScore >= 0.8 && predictedComplexity < 0.45) {
      return false;
    }

    // Default: neutral
    return true;
  }

  /**
   * Calculate how far off the routing was (for gradient descent)
   */
  private calculateRoutingError(
    predictedComplexity: number,
    outcomes: MultiDimensionalOutcome,
    successScore: number
  ): number {
    // Estimate what complexity SHOULD have been based on outcomes
    const actualComplexity = this.estimateActualComplexity(outcomes, successScore);

    // Return absolute error
    return Math.abs(predictedComplexity - actualComplexity);
  }

  /**
   * Reverse-engineer what complexity score should have been
   */
  private estimateActualComplexity(
    outcomes: MultiDimensionalOutcome,
    successScore: number
  ): number {
    // If everything succeeded easily → probably low complexity
    if (successScore >= 0.95 &&
        outcomes.code_writing.execution_time_ms < 30000 &&
        outcomes.build.time_ms < 60000) {
      return 0.2;
    }

    // If code writing failed but tests/build passed → medium-low
    if (!outcomes.code_writing.success && outcomes.build.success) {
      return 0.4;
    }

    // If tests failed but build passed → medium
    if (!outcomes.tests.success && outcomes.build.success) {
      return 0.5;
    }

    // If build failed → medium-high
    if (!outcomes.build.success) {
      return 0.7;
    }

    // If PR had issues → high
    if (!outcomes.pr_ci.pr_merged || outcomes.pr_ci.review_comments > 5) {
      return 0.8;
    }

    // Default: use success score as proxy
    return 1.0 - successScore;
  }

  private isOverallSuccess(outcomes: MultiDimensionalOutcome): boolean {
    return (
      outcomes.code_writing.success &&
      outcomes.tests.success &&
      outcomes.build.success &&
      outcomes.pr_ci.pr_merged
    );
  }

  private getSuccessDimensions(outcomes: MultiDimensionalOutcome): string[] {
    const dimensions: string[] = [];

    if (outcomes.code_writing.success) dimensions.push('code_writing');
    if (outcomes.tests.success) dimensions.push('tests');
    if (outcomes.build.success) dimensions.push('build');
    if (outcomes.pr_ci.pr_merged) dimensions.push('pr_merged');

    return dimensions;
  }
}
```

### Component 3: Complexity Weight Adjuster

**File:** `src/lib/learning/complexity-weight-adjuster.ts`

**Purpose:** Adjust complexity scoring weights using gradient descent

```typescript
export interface WeightAdjustmentResult {
  old_weights: ComplexityWeights;
  new_weights: ComplexityWeights;
  adjustment_magnitude: number;
  expected_improvement: string;
  rationale: string;
}

export class ComplexityWeightAdjuster {
  private supabase = createClient(/* ... */);

  /**
   * Analyze recent samples and propose weight adjustments
   */
  async analyzeAndPropose(
    minSamples: number = 50,
    lookbackDays: number = 7
  ): Promise<WeightAdjustmentResult | null> {
    // 1. Get recent learning samples
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    const { data: samples } = await this.supabase
      .from('complexity_learning_samples')
      .select('*')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false });

    if (!samples || samples.length < minSamples) {
      console.log(`Not enough samples (${samples?.length || 0} < ${minSamples})`);
      return null;
    }

    // 2. Calculate current routing accuracy
    const currentAccuracy = this.calculateRoutingAccuracy(samples);

    console.log(`Current routing accuracy: ${(currentAccuracy * 100).toFixed(1)}%`);

    if (currentAccuracy >= 0.85) {
      console.log('Routing accuracy is already good, no adjustment needed');
      return null;
    }

    // 3. Analyze which factors are most correlated with mis-routing
    const factorCorrelations = this.analyzeFactorCorrelations(samples);

    // 4. Generate weight adjustments
    const currentWeights = await this.getCurrentWeights();
    const newWeights = this.generateWeightAdjustments(
      currentWeights,
      factorCorrelations,
      samples
    );

    // 5. Calculate adjustment magnitude
    const magnitude = this.calculateAdjustmentMagnitude(currentWeights, newWeights);

    // 6. Generate rationale
    const rationale = this.generateRationale(factorCorrelations, samples);

    return {
      old_weights: currentWeights,
      new_weights: newWeights,
      adjustment_magnitude: magnitude,
      expected_improvement: `Routing accuracy: ${(currentAccuracy * 100).toFixed(1)}% → ${((currentAccuracy + 0.1) * 100).toFixed(1)}%`,
      rationale
    };
  }

  /**
   * Calculate current routing accuracy
   */
  private calculateRoutingAccuracy(samples: any[]): number {
    const correctRoutes = samples.filter(s => s.was_correctly_routed).length;
    return correctRoutes / samples.length;
  }

  /**
   * Analyze which complexity factors correlate with routing errors
   */
  private analyzeFactorCorrelations(samples: any[]): Record<string, number> {
    const factors = [
      'codeComplexity',
      'contextRequirements',
      'securityImplications',
      'architecturalImpact',
      'reasoningDepth',
      'memoryPressure',
      'coordinationComplexity'
    ];

    const correlations: Record<string, number> = {};

    // For each factor, calculate correlation with routing errors
    factors.forEach(factor => {
      let sumProduct = 0;
      let sumFactorSquared = 0;
      let sumErrorSquared = 0;

      samples.forEach(sample => {
        const factorValue = sample.complexity_factors?.[factor] || 0;
        const routingError = sample.routing_error_magnitude || 0;

        sumProduct += factorValue * routingError;
        sumFactorSquared += factorValue * factorValue;
        sumErrorSquared += routingError * routingError;
      });

      // Pearson correlation coefficient
      const correlation = sumProduct / (Math.sqrt(sumFactorSquared * sumErrorSquared) + 0.0001);
      correlations[factor] = correlation;
    });

    return correlations;
  }

  /**
   * Generate new weights using gradient descent
   */
  private generateWeightAdjustments(
    currentWeights: ComplexityWeights,
    correlations: Record<string, number>,
    samples: any[]
  ): ComplexityWeights {
    const learningRate = 0.05;  // Conservative adjustment
    const newWeights = { ...currentWeights };

    // Adjust each weight based on correlation with routing errors
    Object.keys(correlations).forEach(factor => {
      const correlation = correlations[factor];

      // If factor has high correlation with errors, reduce its weight
      // (it's over-weighted and causing mis-routing)
      if (Math.abs(correlation) > 0.3) {
        const adjustment = -learningRate * correlation;
        newWeights[factor as keyof ComplexityWeights] = Math.max(
          0.05,  // Min weight
          Math.min(
            0.30,  // Max weight
            newWeights[factor as keyof ComplexityWeights] + adjustment
          )
        );
      }
    });

    // Normalize weights to sum to 1.0
    const sum = Object.values(newWeights).reduce((a, b) => a + b, 0);
    Object.keys(newWeights).forEach(key => {
      newWeights[key as keyof ComplexityWeights] /= sum;
    });

    return newWeights;
  }

  /**
   * Get current weights from complexity analyzer
   */
  private async getCurrentWeights(): Promise<ComplexityWeights> {
    // Read from complexity-analyzer.ts or database
    // For now, return default
    return {
      codeComplexity: 0.20,
      contextRequirements: 0.15,
      securityImplications: 0.20,
      architecturalImpact: 0.20,
      reasoningDepth: 0.05,
      memoryPressure: 0.10,
      coordinationComplexity: 0.10
    };
  }

  private calculateAdjustmentMagnitude(
    oldWeights: ComplexityWeights,
    newWeights: ComplexityWeights
  ): number {
    let sumDiff = 0;
    Object.keys(oldWeights).forEach(key => {
      const diff = Math.abs(
        oldWeights[key as keyof ComplexityWeights] -
        newWeights[key as keyof ComplexityWeights]
      );
      sumDiff += diff;
    });
    return sumDiff;
  }

  private generateRationale(
    correlations: Record<string, number>,
    samples: any[]
  ): string {
    const highCorrelations = Object.entries(correlations)
      .filter(([_, corr]) => Math.abs(corr) > 0.3)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    if (highCorrelations.length === 0) {
      return 'No strong correlations found. Minor adjustments based on overall routing accuracy.';
    }

    const reasons: string[] = [];

    highCorrelations.forEach(([factor, corr]) => {
      if (corr > 0) {
        reasons.push(`${factor} is over-weighted (correlation: ${corr.toFixed(2)})`);
      } else {
        reasons.push(`${factor} is under-weighted (correlation: ${corr.toFixed(2)})`);
      }
    });

    // Calculate mis-routing stats
    const overRouted = samples.filter(s =>
      !s.was_correctly_routed &&
      s.selected_model.includes('claude') &&
      s.predicted_complexity > 0.45
    ).length;

    const underRouted = samples.filter(s =>
      !s.was_correctly_routed &&
      s.selected_model === 'gpt-4o-mini' &&
      s.model_performance_score < 0.5
    ).length;

    reasons.push(`Over-routed to Claude: ${overRouted} tasks`);
    reasons.push(`Under-routed to GPT: ${underRouted} tasks`);

    return reasons.join('. ');
  }

  /**
   * Apply weight adjustments to complexity analyzer
   */
  async applyAdjustments(result: WeightAdjustmentResult): Promise<void> {
    // 1. Get current performance metrics
    const performanceBefore = await this.getPerformanceMetrics();

    // 2. Log weight change to history
    const { data: historyRecord } = await this.supabase
      .from('complexity_weight_history')
      .insert({
        weights: result.new_weights,
        adjustment_reason: 'auto_gradient',
        triggered_by: 'scheduled_calibration',
        performance_before: performanceBefore,
        expected_improvement: result.expected_improvement,
        approved_by: 'system'
      })
      .select()
      .single();

    // 3. Update complexity analyzer (multiple approaches)

    // Option A: Update in-memory (requires restart)
    await this.updateAnalyzerWeights(result.new_weights);

    // Option B: Store in database and read on each analysis
    await this.supabase
      .from('system_config')
      .upsert({
        key: 'complexity_weights',
        value: JSON.stringify(result.new_weights),
        description: 'Auto-adjusted complexity scoring weights',
        updated_at: new Date().toISOString()
      });

    console.log('✅ Weight adjustments applied');
    console.log('   Adjustment magnitude:', result.adjustment_magnitude.toFixed(3));
    console.log('   Rationale:', result.rationale);
  }

  private async getPerformanceMetrics(): Promise<any> {
    // Query recent routing accuracy, cost efficiency, etc.
    const { data: samples } = await this.supabase
      .from('complexity_learning_samples')
      .select('*')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (!samples) return {};

    const routingAccuracy = this.calculateRoutingAccuracy(samples);
    const avgCost = samples.reduce((sum, s) => sum + (s.code_writing_cost || 0), 0) / samples.length;
    const successRate = samples.filter(s => s.overall_success).length / samples.length;

    return {
      routing_accuracy: routingAccuracy,
      avg_cost: avgCost,
      success_rate: successRate,
      sample_count: samples.length
    };
  }

  private async updateAnalyzerWeights(newWeights: ComplexityWeights): Promise<void> {
    // This would require modifying complexity-analyzer.ts to read from DB
    // OR using complexityAnalyzer.updateWeights() method (already exists!)

    const { complexityAnalyzer } = await import('../complexity-analyzer');
    complexityAnalyzer.updateWeights(newWeights);
  }
}
```

---

## Integration Points

### Integration 1: Automatic Sample Creation

**Trigger:** When work order status changes to 'completed' or 'failed'

**File:** `src/lib/orchestrator/result-tracker.ts`

**Add to existing `trackSuccessfulExecution` function:**

```typescript
export async function trackSuccessfulExecution(params: {
  workOrderId: string;
  proposerResponse: EnhancedProposerResponse;
  prResult: PRResult;
}) {
  // ... existing code

  // NEW: Create learning sample (async, don't block)
  createLearningSample(params.workOrderId).catch(err => {
    console.error('Failed to create learning sample:', err);
  });
}

async function createLearningSample(workOrderId: string) {
  // Wait for GitHub events to be recorded (give Sentinel time to process)
  await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute delay

  const sampleCreator = new LearningSampleCreator();
  await sampleCreator.createSample(workOrderId);
}
```

### Integration 2: Scheduled Weight Calibration

**File:** `scripts/calibrate-complexity-weights.ts`

```typescript
import { ComplexityWeightAdjuster } from '@/lib/learning/complexity-weight-adjuster';

async function calibrateWeights() {
  const adjuster = new ComplexityWeightAdjuster();

  console.log('🔬 Analyzing complexity scoring performance...');

  const proposal = await adjuster.analyzeAndPropose(
    50,  // Min 50 samples
    7    // Last 7 days
  );

  if (!proposal) {
    console.log('✅ No adjustments needed');
    return;
  }

  console.log('\n📊 Proposed Weight Adjustments:');
  console.log('Old weights:', proposal.old_weights);
  console.log('New weights:', proposal.new_weights);
  console.log('Magnitude:', proposal.adjustment_magnitude.toFixed(3));
  console.log('\nRationale:', proposal.rationale);
  console.log('Expected improvement:', proposal.expected_improvement);

  // Auto-apply if adjustment is small (< 0.1 magnitude)
  if (proposal.adjustment_magnitude < 0.1) {
    console.log('\n✅ Auto-applying (small adjustment)');
    await adjuster.applyAdjustments(proposal);
  } else {
    console.log('\n⚠️  Large adjustment detected');
    console.log('Review and apply manually via /api/admin/apply-weight-adjustment');
  }
}

calibrateWeights();
```

**Run via cron:**
```bash
# Every Sunday at 2 AM
0 2 * * 0 node scripts/calibrate-complexity-weights.ts
```

### Integration 3: Sentinel GitHub Event Recording

**File:** `src/lib/sentinel/sentinel-service.ts`

**Ensure GitHub webhooks are being captured:**

```typescript
export async function handleGitHubWebhook(payload: any, eventType: string) {
  // Extract work order ID from PR branch name
  const workOrderId = extractWorkOrderId(payload);

  // Record event for learning
  await supabase
    .from('github_events')
    .insert({
      event_type: eventType,
      workflow_name: payload.workflow?.name,
      status: payload.conclusion || payload.state,
      work_order_id: workOrderId,
      payload: payload
    });
}
```

---

## Monitoring & Validation

### Dashboard: Complexity Learning Performance

**File:** `src/app/admin/complexity-learning/page.tsx`

```typescript
export default function ComplexityLearningDashboard() {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    fetch('/api/admin/complexity-learning-metrics')
      .then(res => res.json())
      .then(setMetrics);
  }, []);

  return (
    <div className="dashboard">
      <h1>Complexity Learning Performance</h1>

      <MetricCard
        title="Routing Accuracy"
        value={`${(metrics?.routing_accuracy * 100).toFixed(1)}%`}
        target="85%"
      />

      <MetricCard
        title="Cost Efficiency"
        value={`$${metrics?.avg_cost?.toFixed(2)}`}
        trend={metrics?.cost_trend}
      />

      <WeightHistoryChart data={metrics?.weight_history} />

      <CorrelationHeatmap data={metrics?.factor_correlations} />

      <RecentAdjustmentsTable data={metrics?.recent_adjustments} />
    </div>
  );
}
```

### API: Learning Metrics

**File:** `src/app/api/admin/complexity-learning-metrics/route.ts`

```typescript
export async function GET() {
  const supabase = createSupabaseServiceClient();

  // Get samples from last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { data: samples } = await supabase
    .from('complexity_learning_samples')
    .select('*')
    .gte('created_at', thirtyDaysAgo.toISOString());

  // Calculate metrics
  const routingAccuracy = samples?.filter(s => s.was_correctly_routed).length / samples.length;
  const avgCost = samples?.reduce((sum, s) => sum + (s.code_writing_cost || 0), 0) / samples.length;

  // Get weight history
  const { data: weightHistory } = await supabase
    .from('complexity_weight_history')
    .select('*')
    .order('applied_at', { ascending: false })
    .limit(10);

  return NextResponse.json({
    routing_accuracy: routingAccuracy,
    avg_cost: avgCost,
    sample_count: samples?.length,
    weight_history: weightHistory,
    // ... more metrics
  });
}
```

---

## Rollout Strategy

### Phase 1: Data Collection Only (Week 1)

**Goal:** Collect learning samples without adjusting weights

```typescript
// In learning-sample-creator.ts
const LEARNING_MODE = 'observe'; // 'observe' | 'adjust'

if (LEARNING_MODE === 'observe') {
  // Only create samples, don't adjust weights
  await createSample(workOrderId);
} else {
  // Full learning loop
  await createSample(workOrderId);
  await calibrateWeightsIfNeeded();
}
```

**Success Criteria:**
- [ ] 100+ learning samples collected
- [ ] All dimensions captured (code, tests, build, PR)
- [ ] Routing accuracy baseline established
- [ ] Factor correlations calculated

### Phase 2: Manual Weight Adjustments (Week 2)

**Goal:** Test weight adjustment logic with human approval

- Generate weight proposals weekly
- Human reviews and approves
- Monitor impact on next week's samples
- Validate improvement matches prediction

**Success Criteria:**
- [ ] At least 2 weight adjustments applied
- [ ] Routing accuracy improves by 5-10%
- [ ] No regression in success rate
- [ ] Adjustment rationale is understandable

### Phase 3: Automated Weight Adjustments (Week 3+)

**Goal:** Enable autonomous learning

- Auto-apply small adjustments (< 0.1 magnitude)
- Require approval for large adjustments
- Run calibration weekly
- Alert on anomalies

**Success Criteria:**
- [ ] Routing accuracy reaches 85%+
- [ ] Cost efficiency improves 20-30%
- [ ] System maintains stability
- [ ] Human understands all adjustments

---

## Safety Mechanisms

### 1. Adjustment Limits

```typescript
const SAFETY_LIMITS = {
  MAX_WEIGHT_CHANGE: 0.15,  // No single weight can change by more than 0.15
  MAX_TOTAL_ADJUSTMENT: 0.30,  // Total adjustment magnitude cannot exceed 0.30
  MIN_WEIGHT: 0.05,  // No weight can go below 0.05
  MAX_WEIGHT: 0.30,  // No weight can exceed 0.30
  MIN_SAMPLES_FOR_ADJUSTMENT: 50,  // Need at least 50 samples
  ADJUSTMENT_COOLDOWN_HOURS: 168  // Only adjust once per week
};
```

### 2. Rollback Capability

```typescript
async function rollbackWeightAdjustment(historyId: string) {
  // Get the adjustment record
  const { data: adjustment } = await supabase
    .from('complexity_weight_history')
    .select('*')
    .eq('id', historyId)
    .single();

  // Find previous weights
  const { data: previousAdjustment } = await supabase
    .from('complexity_weight_history')
    .select('*')
    .lt('applied_at', adjustment.applied_at)
    .order('applied_at', { ascending: false })
    .limit(1)
    .single();

  if (!previousAdjustment) {
    throw new Error('No previous weights to roll back to');
  }

  // Reapply previous weights
  const adjuster = new ComplexityWeightAdjuster();
  await adjuster.applyAdjustments({
    old_weights: adjustment.weights,
    new_weights: previousAdjustment.weights,
    adjustment_magnitude: 0,
    expected_improvement: 'Rollback',
    rationale: `Rolling back adjustment ${historyId}`
  });

  console.log('✅ Rolled back to weights from', previousAdjustment.applied_at);
}
```

### 3. Anomaly Detection

```typescript
async function detectAnomalies(newWeights: ComplexityWeights): Promise<string[]> {
  const warnings: string[] = [];

  // Check for extreme weights
  Object.entries(newWeights).forEach(([factor, weight]) => {
    if (weight < 0.05) {
      warnings.push(`${factor} weight too low: ${weight}`);
    }
    if (weight > 0.30) {
      warnings.push(`${factor} weight too high: ${weight}`);
    }
  });

  // Check for imbalanced weights
  const maxWeight = Math.max(...Object.values(newWeights));
  const minWeight = Math.min(...Object.values(newWeights));
  if (maxWeight / minWeight > 6) {
    warnings.push(`Weight distribution too imbalanced: ${maxWeight}/${minWeight}`);
  }

  // Check if sum deviates from 1.0
  const sum = Object.values(newWeights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1.0) > 0.01) {
    warnings.push(`Weights don't sum to 1.0: ${sum}`);
  }

  return warnings;
}
```

---

## Expected Outcomes

### Before Auto-Adjustment

- **Routing Accuracy:** ~50% (guessing based on static weights)
- **Cost Efficiency:** Poor (over-routing to Claude 4.5)
- **GPT-4o-mini Usage:** 9.9%
- **Average Complexity Score:** 0.81
- **Iteration Time:** Manual recalibration required

### After Auto-Adjustment (Estimated)

- **Routing Accuracy:** 85-90%
- **Cost Efficiency:** 30-40% improvement
- **GPT-4o-mini Usage:** 40-50%
- **Average Complexity Score:** 0.45-0.55 (better calibrated)
- **Iteration Time:** Autonomous weekly adjustments

### Long-Term Benefits

1. **Adaptive to Workload Changes:** If work orders become more complex over time, weights automatically adjust
2. **Model-Specific Optimization:** Learn which factors matter most for each model
3. **Cost Optimization:** Continuously minimize cost while maintaining quality
4. **Reduced Human Intervention:** System self-calibrates based on real outcomes
5. **Audit Trail:** Complete history of all adjustments and their impacts

---

## Implementation Checklist

### Database Setup (2 hours)
- [ ] Create complexity_learning_samples table
- [ ] Create complexity_weight_history table
- [ ] Create proposer_threshold_history table
- [ ] Create indexes
- [ ] Run migrations

### Component Development (12-16 hours)
- [ ] Implement OutcomeAggregator (4 hours)
- [ ] Implement LearningSampleCreator (3 hours)
- [ ] Implement ComplexityWeightAdjuster (5 hours)
- [ ] Add integration hooks in result-tracker.ts (1 hour)
- [ ] Create calibration script (2 hours)

### Testing & Validation (6-8 hours)
- [ ] Unit tests for outcome aggregation
- [ ] Integration test for sample creation
- [ ] Test weight adjustment algorithm
- [ ] Validate rollback mechanism
- [ ] Test anomaly detection

### Monitoring & Dashboard (4-6 hours)
- [ ] Create learning metrics API
- [ ] Build dashboard page
- [ ] Add weight history visualization
- [ ] Add correlation heatmap
- [ ] Create alerts for anomalies

### Documentation (2-3 hours)
- [ ] Update SOURCE_OF_TRUTH with learning system
- [ ] Document weight adjustment algorithm
- [ ] Create runbook for interventions
- [ ] Add examples to iteration-1-changes-needed

**Total Estimated Effort:** 3-4 days

---

## Conclusion

This auto-adjustment system creates a true feedback loop where:

1. **Complexity scoring** → predicts difficulty
2. **Model routing** → selects appropriate proposer
3. **Multi-dimensional execution** → produces outcomes across code/tests/build/PR
4. **Outcome aggregation** → captures full picture of success/failure
5. **Learning sample creation** → stores training data
6. **Weight analysis** → identifies mis-calibrations
7. **Gradient descent** → adjusts weights
8. **Validation** → measures improvement
9. **Repeat** → continuous learning

**Key Innovation:** Using multi-dimensional outcomes (not just "success/failure") to understand nuanced relationships between complexity factors and actual task difficulty.

**Next Steps:**
1. Review this design
2. Validate assumptions about github_events data availability
3. Begin Phase 1 implementation (data collection)
4. Run for 1-2 weeks to gather baseline
5. Implement Phase 2 (manual adjustments)
6. Validate improvements
7. Enable Phase 3 (autonomous learning)

