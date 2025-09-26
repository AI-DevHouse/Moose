import { NextRequest, NextResponse } from 'next/server';
import { claudeSonnetProposer, type ProposerRequest } from '@/lib/claude-sonnet-proposer';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body: ProposerRequest = await request.json();

    // Validate required fields
    if (!body.task_description || !body.expected_output_type) {
      return NextResponse.json(
        { error: 'Missing required fields: task_description, expected_output_type' },
        { status: 400 }
      );
    }

    // Execute with Claude Sonnet 4 proposer routing
    const result = await claudeSonnetProposer.routeAndExecute(body);

    // Log the execution to cost tracking
    await supabase.from('cost_tracking').insert({
      service_name: result.proposer_used,
      cost: result.cost,
      metadata: {
        task_description: body.task_description,
        complexity_score: result.complexity_analysis.score,
        token_usage: result.token_usage,
        execution_time_ms: result.execution_time_ms,
        routing_reason: result.routing_decision.reason
      }
    });

    return NextResponse.json({
      success: true,
      result,
      phase: '2.2.2',
      component: 'Claude Sonnet 4 Primary Proposer'
    });

  } catch (error) {
    console.error('Proposer execution error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        phase: '2.2.2'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get proposer registry status
    const registryResponse = await fetch('http://localhost:3000/api/proposers');
    const registryData = await registryResponse.json();

    return NextResponse.json({
      status: 'operational',
      phase: '2.2.2',
      component: 'Claude Sonnet 4 Primary Proposer',
      features: {
        complexity_analysis: 'enabled',
        smart_routing: 'enabled',
        cost_optimization: 'enabled',
        fallback_support: 'enabled'
      },
      proposer_registry: registryData,
      endpoints: {
        execute: 'POST /api/proposer-execute',
        status: 'GET /api/proposer-execute'
      }
    });

  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}