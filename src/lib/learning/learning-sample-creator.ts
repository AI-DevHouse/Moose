/**
 * LearningSampleCreator: Creates training samples from completed work orders
 *
 * Aggregates multi-dimensional outcomes and stores them as learning samples
 * for future complexity weight calibration.
 */

import { createClient } from '@supabase/supabase-js';
import { OutcomeAggregator, MultiDimensionalOutcome } from './outcome-aggregator';

export class LearningSampleCreator {
  private supabase;
  private aggregator: OutcomeAggregator;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.aggregator = new OutcomeAggregator();
  }

  /**
   * Create a learning sample for a completed work order
   */
  async createSample(workOrderId: string): Promise<void> {
    // 1. Get work order with complexity analysis
    const { data: wo, error: woError } = await this.supabase
      .from('work_orders')
      .select('*')
      .eq('id', workOrderId)
      .single();

    if (woError || !wo) {
      console.log(`Work order ${workOrderId} not found`);
      return;
    }

    // 2. Get routing decision
    const { data: routingDecision } = await this.supabase
      .from('decision_logs')
      .select('*')
      .eq('decision_type', 'routing')
      .order('created_at', { ascending: false })
      .limit(100);

    // Find the routing decision for this work order
    const decision = routingDecision?.find((d: any) => {
      const context = d.input_context;
      return context?.work_order_id === workOrderId ||
             context?.workOrderId === workOrderId ||
             context?.id === workOrderId;
    });

    // 3. Aggregate multi-dimensional outcomes
    const outcomes = await this.aggregator.aggregateOutcomes(workOrderId);

    if (!outcomes) {
      console.log(`No outcomes found for work order ${workOrderId}`);
      return;
    }

    // 4. Calculate composite success score
    const successScore = this.calculateSuccessScore(outcomes);

    // 5. Determine if routing was correct
    const wasCorrectlyRouted = this.evaluateRouting(
      wo.complexity_score || 0,
      outcomes.code_writing.model_used,
      successScore
    );

    // 6. Calculate routing error magnitude
    const routingError = this.calculateRoutingError(
      wo.complexity_score || 0,
      outcomes,
      successScore
    );

    // 7. Extract complexity factors and weights from metadata
    const complexityFactors = wo.metadata?.complexity_factors || {};
    const complexityWeights = wo.metadata?.complexity_weights || {};

    // 8. Insert learning sample
    const { error: insertError } = await this.supabase
      .from('complexity_learning_samples')
      .insert({
        work_order_id: workOrderId,
        predicted_complexity: wo.complexity_score || 0,
        complexity_factors: complexityFactors,
        complexity_weights: complexityWeights,
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

        // Production (future)
        production_errors_24h: null,

        // Derived
        overall_success: this.isOverallSuccess(outcomes),
        success_dimensions: this.getSuccessDimensions(outcomes),
        model_performance_score: successScore,
        was_correctly_routed: wasCorrectlyRouted,
        routing_error_magnitude: routingError
      });

    if (insertError) {
      console.error('Failed to insert learning sample:', insertError);
      throw insertError;
    }

    console.log(`✅ Learning sample created for work order ${workOrderId}`);
    console.log(`   Success score: ${successScore.toFixed(2)}`);
    console.log(`   Correctly routed: ${wasCorrectlyRouted ? 'Yes' : 'No'}`);
    console.log(`   Routing error: ${routingError.toFixed(3)}`);
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
      (outcomes.tests.passed + outcomes.tests.failed > 0)
        ? outcomes.tests.passed / (outcomes.tests.passed + outcomes.tests.failed)
        : 0.5; // neutral if no tests

    const buildScore = outcomes.build.success ? 1.0 : 0.0;

    const prScore = outcomes.pr_ci.pr_merged ? 1.0 :
      (outcomes.pr_ci.ci_checks_passed + outcomes.pr_ci.ci_checks_failed > 0)
        ? outcomes.pr_ci.ci_checks_passed / (outcomes.pr_ci.ci_checks_passed + outcomes.pr_ci.ci_checks_failed)
        : 0.5; // neutral if no PR

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
    const isGPT = actualModel.includes('gpt-4o-mini') || actualModel.includes('gpt-mini');
    const isClaude = actualModel.includes('claude');

    // If GPT-4o-mini was used and succeeded → good routing
    if (isGPT && successScore >= 0.8) {
      return true;
    }

    // If Claude 4.5 was used and task was truly complex → good routing
    if (isClaude && predictedComplexity >= 0.45) {
      return true;
    }

    // If GPT-4o-mini failed on complex task → bad routing (under-estimated)
    if (isGPT && successScore < 0.5 && predictedComplexity < 0.45) {
      return false;
    }

    // If Claude 4.5 was used on simple task that succeeded → bad routing (over-estimated)
    if (isClaude && successScore >= 0.8 && predictedComplexity < 0.45) {
      return false;
    }

    // Default: neutral (consider correct)
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

    // Default: use success score as proxy (inverted)
    return Math.max(0.1, 1.0 - successScore);
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
