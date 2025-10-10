// Analyze failures and routing decisions
import { createSupabaseServiceClient } from '@/lib/supabase';

async function analyzeFailures() {
  const supabase = createSupabaseServiceClient();

  // Get all work orders with details
  const { data: wos, error } = await supabase
    .from('work_orders')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching work orders:', error);
    return;
  }

  console.log('='.repeat(80));
  console.log('ROUTING ANALYSIS');
  console.log('='.repeat(80));
  console.log('\nProposer Thresholds:');
  console.log('  gpt-4o-mini: complexity <= 0.3');
  console.log('  claude-sonnet-4-5: complexity > 0.3');
  console.log('');

  const byStatus: Record<string, any[]> = {
    failed: [],
    in_progress: [],
    pending: [],
    completed: []
  };

  wos?.forEach(wo => {
    byStatus[wo.status]?.push(wo);
  });

  // Analyze routing for all WOs
  console.log('\n' + '='.repeat(80));
  console.log('FAILED WORK ORDERS - ROUTING & ERROR ANALYSIS');
  console.log('='.repeat(80));

  byStatus.failed.forEach((wo, idx) => {
    const routing = wo.metadata?.routing_decision;
    const error = wo.metadata?.orchestrator_error;
    const complexity = wo.complexity_score || routing?.routing_metadata?.complexity_score;

    console.log(`\n${idx + 1}. ${wo.title}`);
    console.log(`   ID: ${wo.id.substring(0, 8)}`);
    console.log(`   Complexity: ${complexity?.toFixed(2) || 'N/A'}`);
    console.log(`   Routed to: ${routing?.selected_proposer || 'NOT ROUTED'}`);

    // Check if routing is correct
    if (complexity !== null && complexity !== undefined) {
      const expectedProposer = complexity <= 0.3 ? 'gpt-4o-mini' : 'claude-sonnet-4-5';
      const actualProposer = routing?.selected_proposer;

      if (actualProposer && actualProposer !== expectedProposer) {
        console.log(`   ⚠️  ROUTING MISMATCH! Expected: ${expectedProposer}, Got: ${actualProposer}`);
      }
    }

    if (error) {
      console.log(`   Error Stage: ${error.stage}`);
      console.log(`   Error Class: ${error.failure_class || 'unclassified'}`);
      console.log(`   Error Message: ${error.message?.substring(0, 100)}...`);
    }
  });

  // Analyze in-progress WOs
  console.log('\n' + '='.repeat(80));
  console.log('IN-PROGRESS WORK ORDERS - ROUTING VERIFICATION');
  console.log('='.repeat(80));

  byStatus.in_progress.forEach((wo, idx) => {
    const routing = wo.metadata?.routing_decision;
    const complexity = wo.complexity_score || routing?.routing_metadata?.complexity_score;

    console.log(`\n${idx + 1}. ${wo.title}`);
    console.log(`   ID: ${wo.id.substring(0, 8)}`);
    console.log(`   Complexity: ${complexity?.toFixed(2) || 'N/A'}`);
    console.log(`   Routed to: ${routing?.selected_proposer || 'NOT ROUTED'}`);

    if (complexity !== null && complexity !== undefined) {
      const expectedProposer = complexity <= 0.3 ? 'gpt-4o-mini' : 'claude-sonnet-4-5';
      const actualProposer = routing?.selected_proposer;

      if (actualProposer && actualProposer !== expectedProposer) {
        console.log(`   ⚠️  ROUTING MISMATCH! Expected: ${expectedProposer}, Got: ${actualProposer}`);
      }
    }
  });

  // Summary statistics
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY STATISTICS');
  console.log('='.repeat(80));

  const failureStages: Record<string, number> = {};
  const failureClasses: Record<string, number> = {};

  byStatus.failed.forEach(wo => {
    const error = wo.metadata?.orchestrator_error;
    if (error?.stage) {
      failureStages[error.stage] = (failureStages[error.stage] || 0) + 1;
    }
    if (error?.failure_class) {
      failureClasses[error.failure_class] = (failureClasses[error.failure_class] || 0) + 1;
    }
  });

  console.log('\nFailures by Stage:');
  Object.entries(failureStages).forEach(([stage, count]) => {
    console.log(`  ${stage}: ${count}`);
  });

  console.log('\nFailures by Class:');
  Object.entries(failureClasses).forEach(([cls, count]) => {
    console.log(`  ${cls}: ${count}`);
  });

  console.log('\nStatus Summary:');
  console.log(`  Failed: ${byStatus.failed.length}`);
  console.log(`  In Progress: ${byStatus.in_progress.length}`);
  console.log(`  Pending: ${byStatus.pending.length}`);
  console.log(`  Completed: ${byStatus.completed.length}`);
}

analyzeFailures().catch(console.error);
