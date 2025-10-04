export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Complexity Analytics API - Phase 2.2.4
// Performance monitoring and threshold tuning interface

import { NextResponse } from 'next/server';
import { complexityAnalyzer } from '@/lib/complexity-analyzer';
import { enhancedProposerService } from '@/lib/enhanced-proposer-service';

export async function GET() {
  try {
    // Get routing accuracy data
    const routingAccuracy = await complexityAnalyzer.getRoutingAccuracyByComplexity();
    
    // Get overall performance report
    const performanceReport = await enhancedProposerService.getPerformanceReport();
    
    // Get current weights
    const currentWeights = complexityAnalyzer.getWeights();
    
    // Generate threshold recommendations
    const recommendations = generateThresholdRecommendations(routingAccuracy);

    return NextResponse.json({
      success: true,
      phase: '2.2.4',
      component: 'Complexity Analytics',
      data: {
        routing_accuracy: routingAccuracy,
        performance_summary: performanceReport,
        current_weights: currentWeights,
        threshold_recommendations: recommendations,
        analysis_timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Complexity analytics error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        phase: '2.2.4'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, weights } = body;

    if (action === 'update_weights') {
      // Validate weights
      if (!weights || typeof weights !== 'object') {
        return NextResponse.json(
          { success: false, error: 'Invalid weights object' },
          { status: 400 }
        );
      }

      // Update weights
      complexityAnalyzer.updateWeights(weights);
      
      const updatedWeights = complexityAnalyzer.getWeights();

      return NextResponse.json({
        success: true,
        message: 'Complexity weights updated',
        weights: updatedWeights,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'test_complexity') {
      const { task_description, context, security_context, expected_output_type } = body;

      if (!task_description) {
        return NextResponse.json(
          { success: false, error: 'task_description required' },
          { status: 400 }
        );
      }

      const analysis = await complexityAnalyzer.analyze({
        task_description,
        context: context || [],
        security_context: security_context || 'low',
        expected_output_type: expected_output_type || 'code'
      });

      return NextResponse.json({
        success: true,
        analysis,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action. Use "update_weights" or "test_complexity"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Complexity analytics POST error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function generateThresholdRecommendations(
  routingData: any
): {
  current_performance: string;
  recommendations: Array<{
    threshold_type: string;
    current_value: number;
    recommended_value: number;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
  overall_assessment: string;
} {
  const recommendations: any[] = [];
  const bands = routingData.complexity_bands || [];

  // Analyze low complexity band (0-0.3) - should use gpt-4o-mini
  const lowBand = bands.find((b: any) => b.min === 0 && b.max === 0.3);
  if (lowBand && lowBand.total_requests > 10) {
    if (lowBand.accuracy < 0.85) {
      recommendations.push({
        threshold_type: 'gpt-4o-mini_max_complexity',
        current_value: 0.3,
        recommended_value: 0.35,
        reason: `Low complexity routing accuracy is ${(lowBand.accuracy * 100).toFixed(1)}%. Increasing threshold may improve cost optimization.`,
        confidence: lowBand.total_requests > 50 ? 'high' : 'medium'
      });
    } else if (lowBand.accuracy > 0.95) {
      recommendations.push({
        threshold_type: 'gpt-4o-mini_max_complexity',
        current_value: 0.3,
        recommended_value: 0.28,
        reason: `Excellent low complexity accuracy (${(lowBand.accuracy * 100).toFixed(1)}%). Can tighten threshold for precision.`,
        confidence: 'medium'
      });
    }
  }

  // Analyze medium complexity band (0.3-0.5)
  const mediumBand = bands.find((b: any) => b.min === 0.3 && b.max === 0.5);
  if (mediumBand && mediumBand.total_requests > 10) {
    if (mediumBand.accuracy < 0.70) {
      recommendations.push({
        threshold_type: 'routing_boundary',
        current_value: 0.3,
        recommended_value: 0.25,
        reason: `Medium complexity band showing ${(mediumBand.accuracy * 100).toFixed(1)}% accuracy. Lower boundary may reduce misrouting.`,
        confidence: mediumBand.total_requests > 30 ? 'high' : 'medium'
      });
    }
  }

  // Overall assessment
  const totalRequests = bands.reduce((sum: number, b: any) => sum + b.total_requests, 0);
  const avgAccuracy = totalRequests > 0
    ? bands.reduce((sum: number, b: any) => sum + (b.accuracy * b.total_requests), 0) / totalRequests
    : 0;

  let overallAssessment = '';
  if (totalRequests < 20) {
    overallAssessment = `Insufficient data (${totalRequests} requests). Continue monitoring for 30+ requests before tuning.`;
  } else if (avgAccuracy > 0.90) {
    overallAssessment = `Excellent routing performance (${(avgAccuracy * 100).toFixed(1)}% accuracy). Current thresholds are well-calibrated.`;
  } else if (avgAccuracy > 0.75) {
    overallAssessment = `Good routing performance (${(avgAccuracy * 100).toFixed(1)}% accuracy). Minor tuning recommended.`;
  } else {
    overallAssessment = `Routing accuracy needs improvement (${(avgAccuracy * 100).toFixed(1)}%). Review threshold recommendations.`;
  }

  const performanceSummary = totalRequests > 0 
    ? `${totalRequests} requests analyzed, ${(avgAccuracy * 100).toFixed(1)}% routing accuracy`
    : 'No data available';

  return {
    current_performance: performanceSummary,
    recommendations: recommendations.length > 0 ? recommendations : [{
      threshold_type: 'no_changes',
      current_value: 0.3,
      recommended_value: 0.3,
      reason: 'Current thresholds performing well or insufficient data.',
      confidence: 'medium'
    }],
    overall_assessment: overallAssessment
  };
}