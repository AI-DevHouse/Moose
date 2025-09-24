// src/app/api/llm-test/route.ts - COMPLETE FINAL VERSION FOR 100% SUCCESS
import { NextResponse } from 'next/server';
import { createLLMService } from '@/lib/llm-service';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Development only' }, { status: 403 });
  }

  try {
    console.log('🚀 Starting LLM service test...');
    
    // Test 1: Service creation
    const llmService = createLLMService();
    console.log('✅ LLM service created successfully');

    // Test 2: Simple work order generation - FIXED TO USE NEW INTERFACE
    console.log('📄 Testing work order generation...');
    const startTime = Date.now();
    
    // Use the corrected interface: generateWorkOrder(string, options)
    const result = await llmService.generateWorkOrder(
      "Add a simple hello world function to utils.js",
      { test_mode: true }
    );
    
    const executionTime = Date.now() - startTime;
    console.log(`✅ Work order generated in ${executionTime}ms`);

    // Check if the result matches expected structure
    if (!result.success) {
      throw new Error(`Work order generation failed: ${result.error}`);
    }

    if (!result.work_order || !result.work_order.id) {
      throw new Error('Work order missing required fields');
    }

    return NextResponse.json({
      success: true,
      test_results: {
        service_creation: 'PASSED',
        work_order_generation: 'PASSED',
        execution_time_ms: executionTime,
        result_preview: {
          id: result.work_order.id,
          title: result.work_order.title,
          risk_level: result.work_order.risk_level,
          has_acceptance_criteria: Array.isArray(result.work_order.acceptance_criteria) && result.work_order.acceptance_criteria.length > 0
        },
        cost_tracking: {
          cost: result.cost,
          token_usage: result.token_usage,
          provider: result.provider
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ LLM test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}