/**
 * Complexity Learning Metrics API
 *
 * GET /api/admin/complexity-learning-metrics
 * Returns metrics about the complexity learning system performance
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get samples from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const { data: samples, error: samplesError } = await supabase
      .from('complexity_learning_samples')
      .select('*')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (samplesError) {
      return NextResponse.json(
        { error: 'Failed to fetch learning samples', details: samplesError.message },
        { status: 500 }
      );
    }

    // Calculate metrics
    const totalSamples = samples?.length || 0;
    const routingAccuracy = totalSamples > 0
      ? (samples?.filter(s => s.was_correctly_routed).length || 0) / totalSamples
      : 0;

    const avgCost = totalSamples > 0
      ? (samples?.reduce((sum, s) => sum + (parseFloat(s.code_writing_cost || '0')), 0) || 0) / totalSamples
      : 0;

    const successRate = totalSamples > 0
      ? (samples?.filter(s => s.overall_success).length || 0) / totalSamples
      : 0;

    // Model usage breakdown
    const modelUsage: Record<string, number> = {};
    samples?.forEach(s => {
      const model = s.selected_model || 'unknown';
      modelUsage[model] = (modelUsage[model] || 0) + 1;
    });

    // Calculate average routing error by model
    const routingErrorByModel: Record<string, { avgError: number; count: number }> = {};
    samples?.forEach(s => {
      const model = s.selected_model || 'unknown';
      if (!routingErrorByModel[model]) {
        routingErrorByModel[model] = { avgError: 0, count: 0 };
      }
      routingErrorByModel[model].avgError += s.routing_error_magnitude || 0;
      routingErrorByModel[model].count += 1;
    });
    Object.keys(routingErrorByModel).forEach(model => {
      routingErrorByModel[model].avgError /= routingErrorByModel[model].count;
    });

    // Factor correlations (simplified - just get averages for now)
    const factorAverages: Record<string, number> = {};
    const factorKeys = [
      'codeComplexity',
      'contextRequirements',
      'securityImplications',
      'architecturalImpact',
      'reasoningDepth',
      'memoryPressure',
      'coordinationComplexity'
    ];

    factorKeys.forEach(factor => {
      let sum = 0;
      let count = 0;
      samples?.forEach(s => {
        if (s.complexity_factors && s.complexity_factors[factor] !== undefined) {
          sum += s.complexity_factors[factor];
          count++;
        }
      });
      factorAverages[factor] = count > 0 ? sum / count : 0;
    });

    // Get weight history
    const { data: weightHistory, error: historyError } = await supabase
      .from('complexity_weight_history')
      .select('*')
      .order('applied_at', { ascending: false })
      .limit(10);

    if (historyError) {
      console.error('Failed to fetch weight history:', historyError);
    }

    // Get recent adjustments
    const recentAdjustments = weightHistory?.map(record => ({
      id: record.id,
      applied_at: record.applied_at,
      adjustment_reason: record.adjustment_reason,
      expected_improvement: record.expected_improvement,
      actual_improvement: record.actual_improvement,
      approved_by: record.approved_by
    }));

    // Success rate by dimension
    const dimensionStats = {
      code_writing: totalSamples > 0
        ? (samples?.filter(s => s.code_writing_success).length || 0) / totalSamples
        : 0,
      tests: totalSamples > 0
        ? (samples?.filter(s => s.tests_success).length || 0) / totalSamples
        : 0,
      build: totalSamples > 0
        ? (samples?.filter(s => s.build_success).length || 0) / totalSamples
        : 0,
      pr_merged: totalSamples > 0
        ? (samples?.filter(s => s.pr_merged).length || 0) / totalSamples
        : 0
    };

    // Trend over time (weekly buckets)
    const weeklyTrend: Array<{
      week: string;
      routing_accuracy: number;
      sample_count: number;
    }> = [];

    const now = new Date();
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);

      const weekSamples = samples?.filter(s => {
        const createdAt = new Date(s.created_at);
        return createdAt >= weekStart && createdAt < weekEnd;
      }) || [];

      weeklyTrend.unshift({
        week: `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`,
        routing_accuracy: weekSamples.length > 0
          ? weekSamples.filter(s => s.was_correctly_routed).length / weekSamples.length
          : 0,
        sample_count: weekSamples.length
      });
    }

    return NextResponse.json({
      routing_accuracy: routingAccuracy,
      avg_cost: avgCost,
      success_rate: successRate,
      sample_count: totalSamples,
      model_usage: modelUsage,
      routing_error_by_model: routingErrorByModel,
      factor_averages: factorAverages,
      dimension_stats: dimensionStats,
      weight_history: recentAdjustments || [],
      weekly_trend: weeklyTrend,
      last_updated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching learning metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
