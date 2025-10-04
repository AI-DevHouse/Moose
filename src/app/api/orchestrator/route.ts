export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Orchestrator API - Status and control endpoints

import { NextRequest, NextResponse } from 'next/server';
import { orchestratorService } from '@/lib/orchestrator/orchestrator-service';

/**
 * GET /api/orchestrator
 *
 * Get Orchestrator status
 */
export async function GET(request: NextRequest) {
  try {
    const status = orchestratorService.getStatus();

    return NextResponse.json({
      success: true,
      status
    });
  } catch (error: any) {
    console.error('[API /api/orchestrator GET] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get orchestrator status'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orchestrator
 *
 * Control Orchestrator (start/stop polling)
 *
 * Body:
 * {
 *   action: 'start' | 'stop',
 *   interval_ms?: number  // Only for 'start' action
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, interval_ms } = body;

    if (!action) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required field: action'
        },
        { status: 400 }
      );
    }

    if (action === 'start') {
      const intervalMs = interval_ms || parseInt(process.env.ORCHESTRATOR_POLLING_INTERVAL_MS || '10000', 10);
      orchestratorService.startPolling(intervalMs);

      return NextResponse.json({
        success: true,
        message: 'Orchestrator polling started',
        interval_ms: intervalMs
      });
    } else if (action === 'stop') {
      orchestratorService.stopPolling();

      return NextResponse.json({
        success: true,
        message: 'Orchestrator polling stopped'
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid action: ${action}. Must be 'start' or 'stop'`
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[API /api/orchestrator POST] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to control orchestrator'
      },
      { status: 500 }
    );
  }
}
