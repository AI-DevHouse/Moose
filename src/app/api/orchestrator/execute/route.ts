export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Orchestrator Execute API - Manual Work Order execution

import { NextRequest, NextResponse } from 'next/server';
import { orchestratorService } from '@/lib/orchestrator/orchestrator-service';

/**
 * POST /api/orchestrator/execute
 *
 * Manually trigger execution of a specific Work Order
 *
 * Body:
 * {
 *   work_order_id: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { work_order_id } = body;

    if (!work_order_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: work_order_id'
        },
        { status: 400 }
      );
    }

    console.log(`[API /api/orchestrator/execute] Executing Work Order: ${work_order_id}`);

    const result = await orchestratorService.executeWorkOrder(work_order_id);

    if (result.success) {
      return NextResponse.json({
        success: true,
        result: {
          work_order_id: result.work_order_id,
          pr_url: result.pr_url,
          pr_number: result.pr_number,
          branch_name: result.branch_name,
          execution_time_ms: result.execution_time_ms
        }
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error?.message || 'Work Order execution failed',
          error_stage: result.error?.stage,
          work_order_id: result.work_order_id
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[API /api/orchestrator/execute] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to execute Work Order'
      },
      { status: 500 }
    );
  }
}
