#!/usr/bin/env ts-node
/**
 * Monitor Work Order Execution Progress
 *
 * Real-time monitoring of:
 * - Work order status counts
 * - Active executions
 * - Worktree pool utilization
 * - Execution rate and timing
 */

import { createSupabaseServiceClient } from '../src/lib/supabase';

interface StatusCount {
  status: string;
  count: number;
}

interface ActiveExecution {
  id: string;
  title: string;
  status: string;
  updated_at: string;
}

async function monitorExecution() {
  const supabase = createSupabaseServiceClient();

  console.log('📊 Work Order Execution Monitor');
  console.log('================================\n');

  // Get status counts for each status
  const statuses = ['pending', 'in_progress', 'completed', 'failed'];
  const statusCounts: { [key: string]: number } = {};

  for (const status of statuses) {
    const { count, error } = await supabase
      .from('work_orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', status);

    if (!error && count !== null) {
      statusCounts[status] = count;
    }
  }

  console.log('📋 Status Summary:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    const emoji =
      status === 'completed' ? '✅' :
      status === 'in_progress' ? '⏳' :
      status === 'failed' ? '❌' :
      status === 'pending' ? '⏸️' : '🔹';
    console.log(`   ${emoji} ${status.padEnd(15)}: ${count}`);
  });
  console.log();

  // Get active executions
  const { data: activeWOs, error: activeError } = await supabase
    .from('work_orders')
    .select('id, title, status, updated_at')
    .eq('status', 'in_progress')
    .order('updated_at', { ascending: false })
    .limit(15);

  if (activeError) {
    console.error('❌ Error fetching active WOs:', activeError);
  } else if (activeWOs && activeWOs.length > 0) {
    console.log(`⏳ Active Executions (${activeWOs.length}):`);
    activeWOs.forEach((wo: ActiveExecution, idx: number) => {
      const elapsed = Math.floor((Date.now() - new Date(wo.updated_at).getTime()) / 1000);
      console.log(`   ${idx + 1}. ${wo.id.substring(0, 8)}... - ${wo.title.substring(0, 50)}`);
      console.log(`      Running for ${elapsed}s`);
    });
    console.log();
  }

  // Get recent completions (last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentCompletions, error: recentError } = await supabase
    .from('work_orders')
    .select('id, title, status, updated_at, metadata')
    .in('status', ['completed', 'failed'])
    .gte('updated_at', fiveMinutesAgo)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (recentError) {
    console.error('❌ Error fetching recent completions:', recentError);
  } else if (recentCompletions && recentCompletions.length > 0) {
    console.log(`📈 Recent Completions (last 5 min):`);
    recentCompletions.forEach((wo: any, idx: number) => {
      const emoji = wo.status === 'completed' ? '✅' : '❌';
      const time = new Date(wo.updated_at).toLocaleTimeString();
      console.log(`   ${emoji} ${time} - ${wo.title.substring(0, 50)}`);
    });
    console.log();
  }

  // Calculate execution rate
  const { data: last10Minutes, error: rateError } = await supabase
    .from('work_orders')
    .select('id')
    .in('status', ['completed', 'failed'])
    .gte('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

  if (!rateError && last10Minutes) {
    const rate = (last10Minutes.length / 10).toFixed(1);
    console.log(`📊 Execution Rate: ${rate} WOs/minute (${last10Minutes.length} in last 10 min)`);
    console.log();
  }

  console.log('================================');
  console.log('Monitor updated at:', new Date().toLocaleString());
}

// Run immediately
monitorExecution().catch(console.error);
