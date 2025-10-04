export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// src/app/api/llm/route.ts - FIXED TO MATCH LLM SERVICE INTERFACE
import { NextRequest, NextResponse } from 'next/server';
import { llmService } from '@/lib/llm-service';
import { WorkOrderGenerationRequest, ContractValidationRequest } from '@/types/llm';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...requestData } = body;

    switch (action) {
      case 'generate_work_order':
        return await handleWorkOrderGeneration(requestData as WorkOrderGenerationRequest, user.id);
      
      case 'validate_contracts':
        return await handleContractValidation(requestData as ContractValidationRequest);
      
      case 'get_status':
        return await handleGetStatus();
      
      case 'test_connection':
        return await handleTestConnection();
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('LLM API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Public status endpoint for Mission Control dashboard
    return await handleGetStatus();
  } catch (error) {
    console.error('LLM status check error:', error);
    return NextResponse.json(
      { error: 'Failed to get LLM status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function handleWorkOrderGeneration(request: WorkOrderGenerationRequest, userId: string): Promise<NextResponse> {
  try {
    // FIXED: Pass object as expected by updated LLM service
    const enhancedRequest = { 
      userRequest: request.userRequest, 
      userId,
      context: request.context
    };
    
    const response = await llmService.generateWorkOrder(enhancedRequest);
    
    if (!response.success) {
      return NextResponse.json({
        error: 'Work order generation failed',
        details: response.error
      }, { status: 500 });
    }

    // Parse the JSON response from the LLM
    let workOrderSpec;
    try {
      workOrderSpec = JSON.parse(response.content);
    } catch (parseError) {
      return NextResponse.json({
        error: 'Invalid work order format returned by LLM',
        details: response.content.substring(0, 200) + '...'
      }, { status: 500 });
    }

    // Log cost and usage
    await logCostTracking('work_order_generation', response);

    return NextResponse.json({
      success: true,
      workOrderSpec,
      metadata: {
        executionTime: response.execution_time,  // FIXED: Use correct property name
        cost: response.cost,
        tokenUsage: response.token_usage,  // FIXED: Use correct property name
        provider: response.provider,
        model: response.model
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Work order generation error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function handleContractValidation(request: ContractValidationRequest): Promise<NextResponse> {
  try {
    // FIXED: Use correct method name (validateContracts)
    const response = await llmService.validateContracts(request);
    
    if (!response.success) {
      return NextResponse.json({
        error: 'Contract validation failed',
        details: response.error
      }, { status: 500 });
    }

    // Parse the JSON response from the LLM
    let validationResult;
    try {
      validationResult = JSON.parse(response.content);
    } catch (parseError) {
      return NextResponse.json({
        error: 'Invalid validation result format returned by LLM',
        details: response.content.substring(0, 200) + '...'
      }, { status: 500 });
    }

    // Log cost and usage
    await logCostTracking('contract_validation', response);

    return NextResponse.json({
      success: true,
      validationResult,
      metadata: {
        executionTime: response.execution_time,  // FIXED: Use correct property name
        cost: response.cost,
        tokenUsage: response.token_usage,  // FIXED: Use correct property name
        provider: response.provider,
        model: response.model
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Contract validation error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function handleGetStatus(): Promise<NextResponse> {
  try {
    // Check if API keys are configured
    const anthropicConfigured = !!process.env.ANTHROPIC_API_KEY;
    const openaiConfigured = !!process.env.OPENAI_API_KEY;

    // Get today's usage stats (this would come from your database)
    const today = new Date().toISOString().split('T')[0];
    const dailyStats = await getDailyUsageStats(today);

    const status = {
      anthropic: {
        available: anthropicConfigured,
        rate_limit_remaining: anthropicConfigured ? 45 : 0, // Mock value
        last_request_time: dailyStats.lastAnthropicRequest,
        error: anthropicConfigured ? null : 'API key not configured'
      },
      openai: {
        available: openaiConfigured,
        rate_limit_remaining: openaiConfigured ? 55 : 0, // Mock value
        last_request_time: dailyStats.lastOpenAIRequest,
        error: openaiConfigured ? null : 'API key not configured'
      },
      total_requests_today: dailyStats.totalRequests,
      total_cost_today: dailyStats.totalCost,
      budget_remaining: Math.max(0, 10.00 - dailyStats.totalCost), // $10 daily budget
      overall_status: (anthropicConfigured || openaiConfigured) ? 'operational' : 'degraded'
    };

    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to get LLM service status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function handleTestConnection(): Promise<NextResponse> {
  try {
    // FIXED: Pass object as expected by updated LLM service
    const testRequest = {
      userRequest: "Generate a test work order for a simple hello world API endpoint",
      userId: "test-user"
    };

    const response = await llmService.generateWorkOrder(testRequest);
    
    return NextResponse.json({
      success: response.success,
      connectionTest: {
        provider: response.provider,
        model: response.model,
        executionTime: response.execution_time,  // FIXED: Use correct property name
        cost: response.cost,
        mockResponse: response.metadata?.mockResponse || false
      },
      error: response.error
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed'
    });
  }
}

async function logCostTracking(serviceType: string, response: any): Promise<void> {
  try {
    // This would insert into your cost_tracking table
    const costData = {
      service_name: `llm-${response.provider}`,
      cost: response.cost,
      metadata: {
        service_type: serviceType,
        model: response.model,
        execution_time: response.execution_time,  // FIXED: Use correct property name
        token_usage: response.token_usage,  // FIXED: Use correct property name
        success: response.success
      }
    };

    // For now, just log to console - you'd integrate with your Supabase API
    console.log('Cost tracking:', costData);
  } catch (error) {
    console.error('Failed to log cost tracking:', error);
  }
}

async function getDailyUsageStats(date: string) {
  try {
    // This would query your cost_tracking and decision_logs tables
    // For now, return mock data
    return {
      totalRequests: 0,
      totalCost: 0.00,
      lastAnthropicRequest: null,
      lastOpenAIRequest: null
    };
  } catch (error) {
    console.error('Failed to get daily usage stats:', error);
    return {
      totalRequests: 0,
      totalCost: 0.00,
      lastAnthropicRequest: null,
      lastOpenAIRequest: null
    };
  }
}