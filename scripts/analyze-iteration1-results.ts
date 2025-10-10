import { createSupabaseServiceClient } from '../src/lib/supabase';

const supabase = createSupabaseServiceClient();
const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951';

async function analyzeResults() {
  // Get status distribution
  const { data: wos } = await supabase
    .from('work_orders')
    .select('id, title, status, result_summary')
    .eq('project_id', projectId);

  const statusCounts: Record<string, number> = {};
  wos?.forEach(wo => {
    statusCounts[wo.status] = (statusCounts[wo.status] || 0) + 1;
  });

  console.log('\n📊 ITERATION 1 RESULTS - Work Order Status Distribution:');
  console.log('=' .repeat(60));
  console.log('Total Work Orders:', wos?.length);
  Object.entries(statusCounts).sort().forEach(([status, count]) => {
    const pct = ((count / (wos?.length || 1)) * 100).toFixed(1);
    const emoji = status === 'completed' ? '✅' : status === 'failed' ? '❌' : status === 'in_progress' ? '⏳' : '⏸️';
    console.log(`  ${emoji} ${status}: ${count} (${pct}%)`);
  });

  // Calculate success rate
  const completed = statusCounts['completed'] || 0;
  const failed = statusCounts['failed'] || 0;
  const attempted = completed + failed;
  const successRate = attempted > 0 ? ((completed / attempted) * 100).toFixed(1) : '0.0';

  console.log('\n📈 Success Rate:');
  console.log(`  ${completed} completed / ${attempted} attempted = ${successRate}%`);

  // Get failure details
  const failures = wos?.filter(w => w.status === 'failed') || [];
  console.log('\n❌ Failed Work Orders (' + failures.length + '):');
  console.log('=' .repeat(60));
  failures.slice(0, 10).forEach((f, i) => {
    console.log(`\n${i+1}. ${f.title}`);
    const summary = f.result_summary || 'No summary available';
    const shortSummary = summary.length > 150 ? summary.substring(0, 150) + '...' : summary;
    console.log(`   ${shortSummary}`);
  });

  // Get completed work orders
  const completed_wos = wos?.filter(w => w.status === 'completed') || [];
  console.log('\n\n✅ Completed Work Orders (' + completed_wos.length + '):');
  console.log('=' .repeat(60));
  completed_wos.slice(0, 10).forEach((wo, i) => {
    console.log(`${i+1}. ${wo.title}`);
  });

  // Get cost data
  const woIds = wos?.map(w => w.id) || [];
  const { data: outcomes } = await supabase
    .from('outcome_vectors')
    .select('work_order_id, cost, duration_ms')
    .in('work_order_id', woIds);

  const totalCost = outcomes?.reduce((sum, o) => sum + (o.cost || 0), 0) || 0;
  const avgDuration = outcomes?.length
    ? outcomes.reduce((sum, o) => sum + (o.duration_ms || 0), 0) / outcomes.length
    : 0;

  console.log('\n\n💰 Cost Analysis:');
  console.log('=' .repeat(60));
  console.log(`  Total Spent: $${totalCost.toFixed(2)}`);
  console.log(`  Budget Remaining: $${(150 - totalCost).toFixed(2)} / $150.00`);
  console.log(`  Budget Used: ${((totalCost / 150) * 100).toFixed(1)}%`);

  console.log('\n⏱️  Performance:');
  console.log('=' .repeat(60));
  console.log(`  Average Duration: ${(avgDuration / 1000 / 60).toFixed(1)} minutes per WO`);
  console.log(`  Total Execution Time: ${(outcomes?.reduce((sum, o) => sum + (o.duration_ms || 0), 0) || 0) / 1000 / 60 / 60} hours`);

  // Decision tree
  console.log('\n\n🎯 DECISION TREE:');
  console.log('=' .repeat(60));
  const rate = parseFloat(successRate);
  if (rate >= 60) {
    console.log('✅ Success rate ≥ 60% - GOOD RESULTS!');
    console.log('Next Steps:');
    console.log('  1. Review generated code quality');
    console.log('  2. Fix critical bugs (especially schema issue)');
    console.log('  3. Consider production deployment');
  } else if (rate >= 20) {
    console.log('⚠️  Success rate 20-60% - NEEDS IMPROVEMENT');
    console.log('Next Steps:');
    console.log('  1. Fix all 5 critical bugs identified');
    console.log('  2. Re-run failed work orders');
    console.log('  3. Prepare for iteration 2');
  } else {
    console.log('❌ Success rate < 20% - CRITICAL ISSUES');
    console.log('Next Steps:');
    console.log('  1. Stop and analyze root causes');
    console.log('  2. Fix ALL critical bugs');
    console.log('  3. Consider fresh restart');
  }
}

analyzeResults().catch(console.error);
