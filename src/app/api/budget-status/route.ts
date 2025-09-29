import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { configService } from '@/lib/config-services';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/budget-status - Current spend tracking vs budget limits
export async function GET() {
  try {
    // Get current budget limits
    const limits = await configService.getBudgetLimits();

    // Calculate current date boundaries
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Query daily spend
    const { data: dailySpend, error: dailyError } = await supabase
      .from('cost_tracking')
      .select('cost')
      .gte('created_at', startOfDay.toISOString());

    if (dailyError) throw dailyError;

    // Query monthly spend
    const { data: monthlySpend, error: monthlyError } = await supabase
      .from('cost_tracking')
      .select('cost')
      .gte('created_at', startOfMonth.toISOString());

    if (monthlyError) throw monthlyError;

    // Calculate totals
    const dailyTotal = dailySpend?.reduce((sum, record) => sum + Number(record.cost), 0) || 0;
    const monthlyTotal = monthlySpend?.reduce((sum, record) => sum + Number(record.cost), 0) || 0;

    // Calculate percentages
    const dailyPercentage = limits.daily_hard_cap > 0 
      ? (dailyTotal / limits.daily_hard_cap) * 100 
      : 0;
    const monthlyPercentage = limits.monthly_hard_cap > 0
      ? (monthlyTotal / limits.monthly_hard_cap) * 100
      : 0;

    // Determine status
    let dailyStatus: 'normal' | 'warning' | 'critical' | 'emergency' = 'normal';
    if (dailyTotal >= limits.emergency_kill) {
      dailyStatus = 'emergency';
    } else if (dailyTotal >= limits.daily_hard_cap) {
      dailyStatus = 'critical';
    } else if (dailyTotal >= limits.daily_soft_cap) {
      dailyStatus = 'warning';
    }

    let monthlyStatus: 'normal' | 'warning' | 'critical' = 'normal';
    if (monthlyTotal >= limits.monthly_hard_cap) {
      monthlyStatus = 'critical';
    } else if (monthlyTotal >= limits.monthly_target) {
      monthlyStatus = 'warning';
    }

    // Calculate remaining budgets
    const dailyRemaining = Math.max(0, limits.daily_hard_cap - dailyTotal);
    const monthlyRemaining = Math.max(0, limits.monthly_hard_cap - monthlyTotal);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      daily: {
        spent: Number(dailyTotal.toFixed(6)),
        limit_soft: limits.daily_soft_cap,
        limit_hard: limits.daily_hard_cap,
        emergency_kill: limits.emergency_kill,
        remaining: Number(dailyRemaining.toFixed(6)),
        percentage: Number(dailyPercentage.toFixed(2)),
        status: dailyStatus,
        request_count: dailySpend?.length || 0
      },
      monthly: {
        spent: Number(monthlyTotal.toFixed(6)),
        target: limits.monthly_target,
        limit: limits.monthly_hard_cap,
        remaining: Number(monthlyRemaining.toFixed(6)),
        percentage: Number(monthlyPercentage.toFixed(2)),
        status: monthlyStatus,
        request_count: monthlySpend?.length || 0
      },
      alerts: {
        daily_soft_cap_exceeded: dailyTotal >= limits.daily_soft_cap,
        daily_hard_cap_exceeded: dailyTotal >= limits.daily_hard_cap,
        emergency_kill_triggered: dailyTotal >= limits.emergency_kill,
        monthly_target_exceeded: monthlyTotal >= limits.monthly_target,
        monthly_hard_cap_exceeded: monthlyTotal >= limits.monthly_hard_cap
      },
      projections: {
        daily_projected_eod: dailyTotal, // Simple projection - could be enhanced
        monthly_projected_eom: monthlyTotal * (new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() / now.getDate())
      }
    });
  } catch (error) {
    console.error('[Budget Status API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve budget status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}