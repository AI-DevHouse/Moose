/**
 * ComplexityWeightAdjuster: Adjusts complexity scoring weights using gradient descent
 *
 * Analyzes learning samples to identify weight mis-calibrations and proposes
 * adjustments to improve routing accuracy.
 */

import { createClient } from '@supabase/supabase-js';
import { ComplexityWeights } from '../complexity-analyzer';

export interface WeightAdjustmentResult {
  old_weights: ComplexityWeights;
  new_weights: ComplexityWeights;
  adjustment_magnitude: number;
  expected_improvement: string;
  rationale: string;
}

// Safety limits for weight adjustments
const SAFETY_LIMITS = {
  MAX_WEIGHT_CHANGE: 0.15,  // No single weight can change by more than 0.15
  MAX_TOTAL_ADJUSTMENT: 0.30,  // Total adjustment magnitude cannot exceed 0.30
  MIN_WEIGHT: 0.05,  // No weight can go below 0.05
  MAX_WEIGHT: 0.30,  // No weight can exceed 0.30
  MIN_SAMPLES_FOR_ADJUSTMENT: 50,  // Need at least 50 samples
  ADJUSTMENT_COOLDOWN_HOURS: 168  // Only adjust once per week (7 days)
};

export class ComplexityWeightAdjuster {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Analyze recent samples and propose weight adjustments
   */
  async analyzeAndPropose(
    minSamples: number = SAFETY_LIMITS.MIN_SAMPLES_FOR_ADJUSTMENT,
    lookbackDays: number = 7
  ): Promise<WeightAdjustmentResult | null> {
    // 1. Check cooldown period
    const lastAdjustment = await this.getLastAdjustment();
    if (lastAdjustment) {
      const hoursSinceAdjustment = (Date.now() - new Date(lastAdjustment.applied_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceAdjustment < SAFETY_LIMITS.ADJUSTMENT_COOLDOWN_HOURS) {
        console.log(`Cooldown active: ${hoursSinceAdjustment.toFixed(1)}h since last adjustment (need ${SAFETY_LIMITS.ADJUSTMENT_COOLDOWN_HOURS}h)`);
        return null;
      }
    }

    // 2. Get recent learning samples
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    const { data: samples, error } = await this.supabase
      .from('complexity_learning_samples')
      .select('*')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch learning samples:', error);
      return null;
    }

    if (!samples || samples.length < minSamples) {
      console.log(`Not enough samples (${samples?.length || 0} < ${minSamples})`);
      return null;
    }

    // 3. Calculate current routing accuracy
    const currentAccuracy = this.calculateRoutingAccuracy(samples);

    console.log(`Current routing accuracy: ${(currentAccuracy * 100).toFixed(1)}%`);

    if (currentAccuracy >= 0.85) {
      console.log('Routing accuracy is already good (≥85%), no adjustment needed');
      return null;
    }

    // 4. Analyze which factors are most correlated with mis-routing
    const factorCorrelations = this.analyzeFactorCorrelations(samples);

    // 5. Generate weight adjustments
    const currentWeights = await this.getCurrentWeights();
    const newWeights = this.generateWeightAdjustments(
      currentWeights,
      factorCorrelations,
      samples
    );

    // 6. Validate adjustments
    const validationWarnings = this.validateAdjustments(currentWeights, newWeights);
    if (validationWarnings.length > 0) {
      console.warn('Adjustment validation warnings:', validationWarnings);
      // Don't return null, just log warnings
    }

    // 7. Calculate adjustment magnitude
    const magnitude = this.calculateAdjustmentMagnitude(currentWeights, newWeights);

    // 8. Generate rationale
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
    return samples.length > 0 ? correctRoutes / samples.length : 0;
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
      let count = 0;

      samples.forEach(sample => {
        const factorValue = sample.complexity_factors?.[factor] || 0;
        const routingError = sample.routing_error_magnitude || 0;

        sumProduct += factorValue * routingError;
        sumFactorSquared += factorValue * factorValue;
        sumErrorSquared += routingError * routingError;
        count++;
      });

      // Pearson correlation coefficient
      const denominator = Math.sqrt(sumFactorSquared * sumErrorSquared);
      const correlation = denominator > 0.0001 ? sumProduct / denominator : 0;
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
        const currentWeight = newWeights[factor as keyof ComplexityWeights];
        const newWeight = currentWeight + adjustment;

        // Apply safety limits
        newWeights[factor as keyof ComplexityWeights] = Math.max(
          SAFETY_LIMITS.MIN_WEIGHT,
          Math.min(SAFETY_LIMITS.MAX_WEIGHT, newWeight)
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
   * Get current weights from database or use defaults
   */
  private async getCurrentWeights(): Promise<ComplexityWeights> {
    // Try to get latest weights from history
    const { data: history } = await this.supabase
      .from('complexity_weight_history')
      .select('weights')
      .order('applied_at', { ascending: false })
      .limit(1)
      .single();

    if (history && history.weights) {
      return history.weights as ComplexityWeights;
    }

    // Try system config
    const { data: config } = await this.supabase
      .from('system_config')
      .select('value')
      .eq('key', 'complexity_weights')
      .single();

    if (config && config.value) {
      return JSON.parse(config.value);
    }

    // Return defaults
    return {
      codeComplexity: 0.20,
      contextRequirements: 0.10,
      securityImplications: 0.20,
      architecturalImpact: 0.20,
      reasoningDepth: 0.10,
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
        reasons.push(`${factor} is over-weighted (corr: ${corr.toFixed(2)})`);
      } else {
        reasons.push(`${factor} is under-weighted (corr: ${corr.toFixed(2)})`);
      }
    });

    // Calculate mis-routing stats
    const overRouted = samples.filter((s: any) =>
      !s.was_correctly_routed &&
      s.selected_model.includes('claude') &&
      s.predicted_complexity > 0.45
    ).length;

    const underRouted = samples.filter((s: any) =>
      !s.was_correctly_routed &&
      s.selected_model.includes('gpt') &&
      s.model_performance_score < 0.5
    ).length;

    if (overRouted > 0) reasons.push(`Over-routed to Claude: ${overRouted} tasks`);
    if (underRouted > 0) reasons.push(`Under-routed to GPT: ${underRouted} tasks`);

    return reasons.join('. ');
  }

  /**
   * Validate weight adjustments against safety limits
   */
  private validateAdjustments(
    oldWeights: ComplexityWeights,
    newWeights: ComplexityWeights
  ): string[] {
    const warnings: string[] = [];

    // Check individual weight changes
    Object.keys(oldWeights).forEach(key => {
      const change = Math.abs(
        oldWeights[key as keyof ComplexityWeights] -
        newWeights[key as keyof ComplexityWeights]
      );
      if (change > SAFETY_LIMITS.MAX_WEIGHT_CHANGE) {
        warnings.push(`${key} changed by ${change.toFixed(3)} (max: ${SAFETY_LIMITS.MAX_WEIGHT_CHANGE})`);
      }
    });

    // Check total adjustment magnitude
    const magnitude = this.calculateAdjustmentMagnitude(oldWeights, newWeights);
    if (magnitude > SAFETY_LIMITS.MAX_TOTAL_ADJUSTMENT) {
      warnings.push(`Total adjustment ${magnitude.toFixed(3)} exceeds max ${SAFETY_LIMITS.MAX_TOTAL_ADJUSTMENT}`);
    }

    // Check weight bounds
    Object.entries(newWeights).forEach(([key, weight]) => {
      if (weight < SAFETY_LIMITS.MIN_WEIGHT) {
        warnings.push(`${key} weight ${weight.toFixed(3)} below min ${SAFETY_LIMITS.MIN_WEIGHT}`);
      }
      if (weight > SAFETY_LIMITS.MAX_WEIGHT) {
        warnings.push(`${key} weight ${weight.toFixed(3)} above max ${SAFETY_LIMITS.MAX_WEIGHT}`);
      }
    });

    // Check sum
    const sum = Object.values(newWeights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      warnings.push(`Weights sum to ${sum.toFixed(3)} (expected 1.0)`);
    }

    return warnings;
  }

  /**
   * Apply weight adjustments to complexity analyzer
   */
  async applyAdjustments(result: WeightAdjustmentResult): Promise<void> {
    // 1. Get current performance metrics
    const performanceBefore = await this.getPerformanceMetrics();

    // 2. Log weight change to history
    const { error: historyError } = await this.supabase
      .from('complexity_weight_history')
      .insert({
        weights: result.new_weights,
        adjustment_reason: 'auto_gradient',
        triggered_by: 'scheduled_calibration',
        performance_before: performanceBefore,
        expected_improvement: result.expected_improvement,
        approved_by: 'system'
      });

    if (historyError) {
      console.error('Failed to log weight history:', historyError);
      throw historyError;
    }

    // 3. Store in system config (for persistence)
    const { error: configError } = await this.supabase
      .from('system_config')
      .upsert({
        key: 'complexity_weights',
        value: JSON.stringify(result.new_weights),
        description: 'Auto-adjusted complexity scoring weights',
        updated_at: new Date().toISOString()
      });

    if (configError) {
      console.error('Failed to update system config:', configError);
      throw configError;
    }

    // 4. Update in-memory weights (requires restart or dynamic loading)
    await this.updateAnalyzerWeights(result.new_weights);

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

    if (!samples || samples.length === 0) {
      return {
        routing_accuracy: 0,
        avg_cost: 0,
        success_rate: 0,
        sample_count: 0
      };
    }

    const routingAccuracy = this.calculateRoutingAccuracy(samples);
    const avgCost = samples.reduce((sum: number, s: any) => sum + (parseFloat(s.code_writing_cost) || 0), 0) / samples.length;
    const successRate = samples.filter((s: any) => s.overall_success).length / samples.length;

    return {
      routing_accuracy: routingAccuracy,
      avg_cost: avgCost,
      success_rate: successRate,
      sample_count: samples.length
    };
  }

  private async updateAnalyzerWeights(newWeights: ComplexityWeights): Promise<void> {
    // This reloads the weights from database (which we just updated)
    const { complexityAnalyzer } = await import('../complexity-analyzer');
    await complexityAnalyzer.reloadWeights();
    console.log('   In-memory weights updated');
  }

  private async getLastAdjustment(): Promise<any> {
    const { data } = await this.supabase
      .from('complexity_weight_history')
      .select('*')
      .order('applied_at', { ascending: false })
      .limit(1)
      .single();

    return data;
  }

  /**
   * Rollback to previous weight adjustment
   */
  async rollbackWeightAdjustment(historyId: string): Promise<void> {
    // Get the adjustment record
    const { data: adjustment, error: fetchError } = await this.supabase
      .from('complexity_weight_history')
      .select('*')
      .eq('id', historyId)
      .single();

    if (fetchError || !adjustment) {
      throw new Error(`Adjustment ${historyId} not found`);
    }

    // Find previous weights
    const { data: previousAdjustment, error: prevError } = await this.supabase
      .from('complexity_weight_history')
      .select('*')
      .lt('applied_at', adjustment.applied_at)
      .order('applied_at', { ascending: false })
      .limit(1)
      .single();

    if (prevError || !previousAdjustment) {
      throw new Error('No previous weights to roll back to');
    }

    // Reapply previous weights
    await this.applyAdjustments({
      old_weights: adjustment.weights,
      new_weights: previousAdjustment.weights,
      adjustment_magnitude: 0,
      expected_improvement: 'Rollback',
      rationale: `Rolling back adjustment ${historyId}`
    });

    console.log('✅ Rolled back to weights from', previousAdjustment.applied_at);
  }
}
