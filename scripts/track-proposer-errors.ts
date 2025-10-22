import { createClient } from '@supabase/supabase-js';

/**
 * Track Proposer Error Metrics
 *
 * NOTE: This script is a placeholder for future learning system integration.
 * Currently tracks basic proposer execution metrics from work_orders.metadata.
 *
 * TODO (Learning System Implementation):
 * 1. Add error tracking fields to proposer_response metadata:
 *    - initial_error_count: Proposer output errors before sanitization
 *    - final_error_count: Errors after sanitization
 *    - sanitizer_changes: Number of code fixes applied
 *    - error_types: Breakdown by error category (syntax, type, semantic)
 *
 * 2. Integrate with enhanced-proposer-service.ts to capture:
 *    - TypeScript compilation errors from initial output
 *    - Sanitizer fixes applied per cycle
 *    - Refinement cycles required
 *
 * 3. Store in proposer_learning_samples table (if it exists) or work_orders.metadata
 *
 * For now, tracks: refinement cycles, execution time, token usage, success rate
 */
async function trackProposerErrors() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get recent work orders with metadata
  const { data: workOrders, error } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata, github_pr_url, created_at, completed_at')
    .not('metadata', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error querying work orders:', error);
    return;
  }

  if (!workOrders || workOrders.length === 0) {
    console.log('No work orders with metadata found');
    return;
  }

  // Filter to WOs with proposer execution data
  const samples = workOrders.filter((wo: any) =>
    wo.metadata?.proposer_response || wo.metadata?.aider_execution
  );

  console.log(`\n📊 Proposer Execution Metrics (Last ${samples.length} WOs)\n`);
  console.log('='.repeat(80));

  let totalRefinementCycles = 0;
  let totalExecutionTime = 0;
  let totalTokens = 0;
  let successCount = 0;
  let failedCount = 0;

  const refinementDistribution: { [key: string]: number } = {};
  const woDetails: Array<{
    wo_id: string;
    status: string;
    refinement_cycles: number;
    execution_time_s: number;
    tokens: number;
    proposer: string;
    has_pr: boolean;
  }> = [];

  for (const sample of samples) {
    const metadata = sample.metadata as any;
    const proposerResp = metadata?.proposer_response;
    const aiderExec = metadata?.aider_execution;

    const refinementCycles = proposerResp?.refinement_cycles || 0;
    const executionTime = proposerResp?.execution_time_ms || 0;
    const tokens = proposerResp?.token_usage?.total || 0;
    const proposer = proposerResp?.proposer_used || metadata?.routing_decision?.selected_proposer || 'unknown';
    const hasPR = !!sample.github_pr_url;
    const status = sample.status;

    if (aiderExec?.success) successCount++;
    if (status === 'failed') failedCount++;

    totalRefinementCycles += refinementCycles;
    totalExecutionTime += executionTime;
    totalTokens += tokens;

    // Track refinement distribution
    const cycleRange = refinementCycles === 0 ? '0' :
                       refinementCycles === 1 ? '1' :
                       refinementCycles === 2 ? '2' :
                       refinementCycles === 3 ? '3' : '4+';
    refinementDistribution[cycleRange] = (refinementDistribution[cycleRange] || 0) + 1;

    woDetails.push({
      wo_id: sample.id ? sample.id.substring(0, 8) : 'unknown',
      status,
      refinement_cycles: refinementCycles,
      execution_time_s: Math.round(executionTime / 1000),
      tokens,
      proposer,
      has_pr: hasPR
    });
  }

  const avgRefinementCycles = totalRefinementCycles / samples.length;
  const avgExecutionTime = totalExecutionTime / samples.length / 1000; // seconds
  const avgTokens = totalTokens / samples.length;
  const successRate = (successCount / samples.length) * 100;

  console.log('\n📈 Summary Statistics:');
  console.log(`   Total WOs analyzed: ${samples.length}`);
  console.log(`   Success rate: ${successRate.toFixed(1)}% (${successCount}/${samples.length} succeeded)`);
  console.log(`   Failed: ${failedCount}`);
  console.log(`   Avg refinement cycles: ${avgRefinementCycles.toFixed(2)}`);
  console.log(`   Avg execution time: ${avgExecutionTime.toFixed(1)}s`);
  console.log(`   Avg tokens: ${avgTokens.toFixed(0)}`);

  console.log('\n📊 Refinement Cycle Distribution:');
  Object.entries(refinementDistribution)
    .sort((a, b) => {
      const order = ['0', '1', '2', '3', '4+'];
      return order.indexOf(a[0]) - order.indexOf(b[0]);
    })
    .forEach(([cycles, count]) => {
      const percentage = ((count / samples.length) * 100).toFixed(1);
      const bar = '█'.repeat(Math.round(count / 2));
      console.log(`   ${cycles.padEnd(8)} cycles: ${bar} ${count} WOs (${percentage}%)`);
    });

  console.log('\n🔍 Recent WOs (showing top 20):');
  console.log('   WO ID    | Status      | Cycles | Time(s) | Tokens | Proposer       | PR');
  console.log('   ' + '-'.repeat(85));

  woDetails.slice(0, 20).forEach(wo => {
    const prIcon = wo.has_pr ? '✓' : '✗';
    console.log(`   ${wo.wo_id} | ${wo.status.padEnd(11)} | ${String(wo.refinement_cycles).padStart(6)} | ${String(wo.execution_time_s).padStart(7)} | ${String(wo.tokens).padStart(6)} | ${wo.proposer.padEnd(14)} | ${prIcon}`);
  });

  console.log('\n💡 Observations:');
  console.log(`   ℹ️  ERROR TRACKING NOT YET IMPLEMENTED`);
  console.log(`   ℹ️  Current metrics: refinement cycles, execution time, token usage`);
  console.log(`   ℹ️  Future metrics: initial errors, final errors, sanitizer fixes`);
  console.log('');

  if (successRate < 90) {
    console.log(`   ⚠️  Success rate ${successRate.toFixed(1)}% is below target (90%)`);
  } else {
    console.log(`   ✅ Success rate ${successRate.toFixed(1)}% meets target (≥90%)`);
  }

  if (avgRefinementCycles > 2) {
    console.log('   ⚠️  HIGH refinement cycles (>2 avg) - Proposer may need better prompts');
  } else {
    console.log('   ✅ Good refinement efficiency (≤2 avg cycles)');
  }

  console.log('\n📝 Next Steps:');
  console.log('   1. Implement error tracking in enhanced-proposer-service.ts');
  console.log('   2. Capture TypeScript compilation errors before/after sanitization');
  console.log('   3. Track sanitizer fixes per refinement cycle');
  console.log('   4. Store in proposer_response metadata or separate table');
  console.log('   5. Run this script again after 20+ WOs with error tracking enabled');

  console.log('\n' + '='.repeat(80));
}

trackProposerErrors().catch(console.error);
