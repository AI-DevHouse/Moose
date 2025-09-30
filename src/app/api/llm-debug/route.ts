// src/app/api/llm-debug/route.ts
// Debug test to see actual LLM response content

import { NextResponse } from 'next/server';
import { createLLMService } from '@/lib/llm-service';
import { WorkOrderGenerationRequest } from '@/types/llm';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Development only' }, { status: 403 });
  }

  try {
    console.log('🔍 Debug: Starting LLM response analysis...');
    
    const llmService = createLLMService();
    
    // FIXED: Use correct interface structure
    const testRequest: WorkOrderGenerationRequest = {
      userRequest: "Add a simple hello world function to utils.js",
      userId: "debug-user",
      context: {
        currentRepository: "test-repo"
      }
    };

    console.log('📄 Debug: Calling generateWorkOrder...');
    
    try {
      const result = await llmService.generateWorkOrder(testRequest);
      console.log('✅ Debug: Work order generated successfully');
      return NextResponse.json({
        status: 'SUCCESS',
        result: result
      });
    } catch (error) {
      console.log('❌ Debug: Error caught, examining details...');
      
      // Create a mock proposer for debugging
      const proposer = {
        id: "debug",
        name: "claude-sonnet-4-5",
        provider: "anthropic" as const,
        endpoint: "https://api.anthropic.com/v1/messages",
        context_limit: 200000,
        cost_profile: { input_cost_per_token: 0.000003, output_cost_per_token: 0.000015 },
        strengths: ["debugging"],
        complexity_threshold: 0.30,
        success_patterns: null,
        notes: "Debug proposer",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const systemPrompt = `You are the Manager LLM for Moose Mission Control. Generate ONLY valid JSON for this work order:

{
  "id": "wo_${Date.now()}",
  "title": "Add Hello World Function",
  "description": "Create a simple hello world function in utils.js",
  "risk_level": "low",
  "estimated_cost": 0.50,
  "pattern_confidence": 0.8,
  "complexity_score": 0.3,
  "acceptance_criteria": ["Function returns 'Hello World'", "Function exported from utils.js"],
  "metadata": {
    "complexity_factors": ["simple_function"],
    "affected_contracts": ["api"],
    "estimated_time_hours": 1
  }
}

Respond with ONLY the JSON above, no other text.`;

      const llmRequest = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: testRequest.userRequest }
        ],
        maxTokens: 1000,
        temperature: 0.1,
        metadata: {
          requestType: 'work_order_generation'
        }
      };

      console.log('📄 Debug: Making direct processRequest call...');
      
      try {
        const rawResponse = await (llmService as any).processRequest(llmRequest, proposer);
        
        console.log('🔍 Debug: Raw LLM response received');
        console.log('Response success:', rawResponse.success);
        console.log('Response content length:', rawResponse.content?.length || 0);
        console.log('Response content preview:', rawResponse.content?.slice(0, 500));
        
        return NextResponse.json({
          status: 'DEBUG_INFO',
          original_error: error instanceof Error ? error.message : 'Unknown error',
          raw_response: {
            success: rawResponse.success,
            content: rawResponse.content,
            content_length: rawResponse.content?.length || 0,
            provider: rawResponse.provider,
            model: rawResponse.model,
            execution_time: rawResponse.executionTime,
            token_usage: rawResponse.tokenUsage,
            cost: rawResponse.cost,
            metadata: rawResponse.metadata
          },
          json_parse_attempt: (() => {
            try {
              return JSON.parse(rawResponse.content);
            } catch (parseError) {
              return {
                error: parseError instanceof Error ? parseError.message : 'Parse failed',
                content_sample: rawResponse.content?.slice(0, 200) + '...'
              };
            }
          })()
        });
      } catch (processError) {
        return NextResponse.json({
          status: 'PROCESS_REQUEST_FAILED',
          original_error: error instanceof Error ? error.message : 'Unknown error',
          process_error: processError instanceof Error ? processError.message : 'Process request failed',
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }
    }

  } catch (error) {
    console.error('💥 Debug: Complete failure:', error);
    
    return NextResponse.json({
      status: 'COMPLETE_FAILURE',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}