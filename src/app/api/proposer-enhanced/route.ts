export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Enhanced Proposer API Route - Phase 2.2.3
// Exposes performance monitoring and fallback optimization

import { NextRequest, NextResponse } from 'next/server';
import { enhancedProposerService } from '@/lib/enhanced-proposer-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.task_description || !body.expected_output_type) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: task_description, expected_output_type'
      }, { status: 400 });
    }

    // Set defaults for optional fields
    const proposerRequest = {
      task_description: body.task_description,
      context: body.context || [],
      security_context: body.security_context || 'low',
      expected_output_type: body.expected_output_type,
      priority: body.priority || 'medium',
      retry_config: body.retry_config || {
        max_retries: 3,
        retry_delay_ms: 1000,
        escalation_threshold: 2,
        fallback_on_failure: true
      }
    };

    // Execute with enhanced monitoring
    const response = await enhancedProposerService.executeWithMonitoring(proposerRequest);

    return NextResponse.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
      service: 'enhanced_proposer_service',
      phase: '2.2.3'
    });

  } catch (error) {
    console.error('Enhanced proposer execution error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
      service: 'enhanced_proposer_service',
      phase: '2.2.3'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'performance-report') {
      // Get comprehensive performance report
      const report = await enhancedProposerService.getPerformanceReport();
      
      return NextResponse.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
        service: 'enhanced_proposer_service',
        phase: '2.2.3'
      });
    }

    // Default GET - return service status
    return NextResponse.json({
      success: true,
      status: 'operational',
      phase: '2.2.3',
      component: 'Enhanced Proposer Service',
      features: {
        performance_monitoring: 'enabled',
        fallback_optimization: 'enabled',
        retry_logic: 'enabled',
        cost_tracking: 'enabled'
      },
      endpoints: {
        execute: 'POST /api/proposer-enhanced',
        status: 'GET /api/proposer-enhanced',
        performance_report: 'GET /api/proposer-enhanced?action=performance-report'
      },
      usage: {
        execute_request: {
          method: 'POST',
          required_fields: ['task_description', 'expected_output_type'],
          optional_fields: ['context', 'security_context', 'priority', 'retry_config'],
          example: {
            task_description: 'Create a simple utility function',
            context: ['JavaScript project', 'Node.js environment'],
            security_context: 'low',
            expected_output_type: 'code',
            priority: 'medium',
            retry_config: {
              max_retries: 3,
              retry_delay_ms: 1000,
              escalation_threshold: 2,
              fallback_on_failure: true
            }
          }
        }
      }
    });

  } catch (error) {
    console.error('Enhanced proposer GET error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
      service: 'enhanced_proposer_service',
      phase: '2.2.3'
    }, { status: 500 });
  }
}