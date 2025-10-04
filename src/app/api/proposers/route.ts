export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { proposerRegistry, ProposerConfig } from '@/lib/proposer-registry';
import { getOrCache, cache } from '@/lib/cache';

export async function GET() {
  try {
    // Cache proposers list for 60 seconds (they rarely change)
    const proposers = await getOrCache(
      'proposers-list',
      60 * 1000, // 60 seconds TTL
      async () => {
        await proposerRegistry.initialize();
        return proposerRegistry.listActiveProposers();
      }
    );

    return NextResponse.json({
      success: true,
      proposers,
      count: proposers.length,
      cached: true // Indicate response may be cached
    });
  } catch (error) {
    console.error('Error fetching proposers:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch proposers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['name', 'provider', 'endpoint', 'cost_profile'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Missing required field: ${field}` 
          },
          { status: 400 }
        );
      }
    }

    // Create proposer config with defaults
    const proposerConfig: ProposerConfig = {
      id: body.id || crypto.randomUUID(),
      name: body.name,
      provider: body.provider,
      endpoint: body.endpoint,
      context_limit: body.context_limit || 8000,
      cost_profile: body.cost_profile,
      strengths: body.strengths || [],
      complexity_threshold: body.complexity_threshold || 0.5,
      success_patterns: body.success_patterns,
      notes: body.notes,
      is_active: body.is_active !== undefined ? body.is_active : true
    };

    await proposerRegistry.registerProposer(proposerConfig);

    // Invalidate cache after modification
    cache.invalidate('proposers-list');

    return NextResponse.json({
      success: true,
      message: 'Proposer registered successfully',
      proposer: proposerConfig
    });
  } catch (error) {
    console.error('Error registering proposer:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to register proposer',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (body.fix_gpt4o === true) {
      // Fix the o3-mini to gpt-4o-mini directly
      const correctedConfig: ProposerConfig = {
        id: "f4b60e1b-e375-4796-aaa6-cdcc445a05b7", // Use existing ID
        name: "gpt-4o-mini",
        provider: "openai",
        endpoint: "https://api.openai.com/v1/chat/completions",
        context_limit: 128000,
        cost_profile: {
          input_cost_per_token: 0.15,  // $0.15 per 1M tokens
          output_cost_per_token: 0.60  // $0.60 per 1M tokens
        },
        strengths: ["fast-execution", "simple-tasks", "cost-effective"],
        complexity_threshold: 0.3,
        notes: "Cost-optimized fallback (44x cheaper than reasoning models)",
        is_active: true
      };

      await proposerRegistry.registerProposer(correctedConfig);

      // Invalidate cache after modification
      cache.invalidate('proposers-list');

      return NextResponse.json({
        success: true,
        message: "Fixed proposer configuration to gpt-4o-mini",
        proposer: correctedConfig
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid PUT request" },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating proposer:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update proposer',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

