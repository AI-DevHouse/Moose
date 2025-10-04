export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Check stuck work orders (>24 hours old, not in terminal state)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: stuckWorkOrders, error: stuckError } = await supabase
      .from('work_orders')
      .select('id, title, status, created_at')
      .lt('created_at', twentyFourHoursAgo)
      .not('status', 'in', '(completed,failed,cancelled)')
      .order('created_at', { ascending: true });

    if (stuckError) throw stuckError;

    // 2. Check open escalations
    const { data: pendingEscalations, error: escalationsError } = await supabase
      .from('escalations')
      .select('id, trigger_type, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    if (escalationsError) throw escalationsError;

    // 3. Check today's budget usage
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: costRecords, error: costError } = await supabase
      .from('cost_tracking')
      .select('cost')
      .gte('created_at', todayStart.toISOString());

    if (costError) throw costError;

    const dailySpend = costRecords?.reduce((sum, record) => sum + Number(record.cost), 0) || 0;
    const dailyLimit = 100.0;

    // 4. Check recent failures from outcome_vectors (last 24 hours)
    const { data: recentErrors, error: errorsError } = await supabase
      .from('outcome_vectors')
      .select('id, failure_classes, created_at, work_order_id')
      .eq('success', false)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(20);

    if (errorsError) throw errorsError;

    // 5. Get work order state distribution
    const { data: stateDistribution, error: stateError } = await supabase
      .from('work_orders')
      .select('status');

    if (stateError) throw stateError;

    const stateCounts = stateDistribution?.reduce((acc, wo) => {
      acc[wo.status] = (acc[wo.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Determine overall health status
    const hasStuckWorkOrders = (stuckWorkOrders?.length || 0) > 0;
    const hasPendingEscalations = (pendingEscalations?.length || 0) > 0;
    const budgetNearLimit = dailySpend > dailyLimit * 0.8;
    const recentErrorCount = recentErrors?.length || 0;

    let status: 'healthy' | 'warning' | 'error';
    if (hasStuckWorkOrders || hasPendingEscalations) {
      status = 'error';
    } else if (budgetNearLimit || recentErrorCount > 10) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      checks: {
        stuckWorkOrders: {
          status: hasStuckWorkOrders ? 'error' : 'healthy',
          count: stuckWorkOrders?.length || 0,
          details: stuckWorkOrders?.slice(0, 5) || []
        },
        pendingEscalations: {
          status: hasPendingEscalations ? 'error' : 'healthy',
          count: pendingEscalations?.length || 0,
          details: pendingEscalations || []
        },
        budgetUsage: {
          status: budgetNearLimit ? 'warning' : 'healthy',
          dailySpend,
          dailyLimit,
          percentUsed: (dailySpend / dailyLimit) * 100
        },
        recentErrors: {
          status: recentErrorCount > 10 ? 'warning' : 'healthy',
          count: recentErrorCount,
          details: recentErrors || []
        },
        workOrderStates: stateCounts
      }
    });

  } catch (error) {
    console.error('Health check failed:', error);
    let errorMessage = 'Unknown error';

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = JSON.stringify(error);
    } else {
      errorMessage = String(error);
    }

    console.error('Error details:', { errorMessage, stack: error instanceof Error ? error.stack : undefined });
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: errorMessage
    }, { status: 500 });
  }
}
