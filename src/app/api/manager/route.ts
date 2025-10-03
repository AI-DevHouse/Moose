// src/app/api/manager/route.ts
// Manager API endpoint - Work Order routing

import { NextRequest, NextResponse } from 'next/server';
import { routeWorkOrder, getRetryStrategy } from '@/lib/manager-service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/manager/route
 * Route a Work Order to appropriate Proposer
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      work_order_id,
      task_description,
      context_requirements,
      complexity_score,
      approved_by_director
    } = body;

    // Validate required fields
    if (!work_order_id || !task_description || !complexity_score) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: work_order_id, task_description, complexity_score'
        },
        { status: 400 }
      );
    }

    if (!approved_by_director) {
      return NextResponse.json(
        {
          success: false,
          error: 'Work Order must be approved by Director before routing'
        },
        { status: 403 }
      );
    }

    // Route Work Order
    const response = await routeWorkOrder({
      work_order_id,
      task_description,
      context_requirements: context_requirements || [],
      complexity_score,
      approved_by_director
    });

    if (!response.success) {
      return NextResponse.json(response, { status: 500 });
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Manager API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/manager/retry?work_order_id=xxx&current_proposer=xxx&attempt=1
 * Get retry strategy for failed Work Order
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const work_order_id = searchParams.get('work_order_id');
    const current_proposer = searchParams.get('current_proposer');
    const attempt = searchParams.get('attempt');
    const failure_reason = searchParams.get('failure_reason') || 'Unknown failure';

    if (!work_order_id || !current_proposer || !attempt) {
      return NextResponse.json(
        {
          error: 'Missing required query params: work_order_id, current_proposer, attempt'
        },
        { status: 400 }
      );
    }

    const retryStrategy = await getRetryStrategy(
      work_order_id,
      current_proposer,
      parseInt(attempt, 10),
      failure_reason
    );

    return NextResponse.json(retryStrategy, { status: 200 });
  } catch (error) {
    console.error('Manager retry API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
