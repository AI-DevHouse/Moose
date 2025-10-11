import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeWorkOrders() {
  // Get all work orders
  const { data: workOrders, error: woError } = await supabase
    .from('work_orders')
    .select('id, title, complexity_score, proposer_id, status')
    .order('created_at', { ascending: true });

  if (woError) {
    console.error('Error fetching work orders:', woError);
    return;
  }

  if (!workOrders || workOrders.length === 0) {
    console.log('No work orders found.');
    return;
  }

  // Get outcome vectors to see what model was actually used
  const { data: outcomes, error: outError } = await supabase
    .from('outcome_vectors')
    .select('work_order_id, model_used');

  if (outError) {
    console.error('Error fetching outcomes:', outError);
    return;
  }

  // Create lookup map for models actually used
  const woModelMap = new Map(outcomes?.map(o => [o.work_order_id, o.model_used]) || []);

  // Calculate statistics
  const complexityScores = workOrders
    .filter(wo => wo.complexity_score !== null)
    .map(wo => wo.complexity_score);

  const avgComplexity = complexityScores.length > 0
    ? complexityScores.reduce((a, b) => a + b, 0) / complexityScores.length
    : 0;

  // Count by model (based on actual execution)
  const modelCounts: Record<string, number> = {};
  const wosWithoutExecution: string[] = [];

  workOrders.forEach(wo => {
    const modelUsed = woModelMap.get(wo.id);
    if (modelUsed) {
      modelCounts[modelUsed] = (modelCounts[modelUsed] || 0) + 1;
    } else {
      modelCounts['not_executed'] = (modelCounts['not_executed'] || 0) + 1;
    }
  });

  // Display results
  console.log('\n📊 WORK ORDER ANALYSIS');
  console.log('='.repeat(60));
  console.log(`\nTotal Work Orders: ${workOrders.length}`);
  console.log(`WOs with execution data: ${outcomes?.length || 0}`);
  console.log(`\n📈 COMPLEXITY SCORES:`);
  if (complexityScores.length > 0) {
    console.log(`  Average: ${avgComplexity.toFixed(2)}`);
    console.log(`  Min: ${Math.min(...complexityScores).toFixed(2)}`);
    console.log(`  Max: ${Math.max(...complexityScores).toFixed(2)}`);
  } else {
    console.log(`  No complexity scores available`);
  }
  console.log(`  WOs with scores: ${complexityScores.length}/${workOrders.length}`);

  console.log(`\n🤖 MODEL DISTRIBUTION:`);
  Object.entries(modelCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([model, count]) => {
      const percentage = ((count / workOrders.length) * 100).toFixed(1);
      const modelDisplay = model.includes('gpt-4o-mini') ? 'GPT-4o-mini' :
                          model.includes('claude-sonnet-4-5') ? 'Claude Sonnet 4.5' :
                          model;
      console.log(`  ${modelDisplay}: ${count} (${percentage}%)`);
    });

  console.log(`\n📋 STATUS BREAKDOWN:`);
  const statusCounts: Record<string, number> = {};
  workOrders.forEach(wo => {
    statusCounts[wo.status] = (statusCounts[wo.status] || 0) + 1;
  });
  Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      const percentage = ((count / workOrders.length) * 100).toFixed(1);
      console.log(`  ${status}: ${count} (${percentage}%)`);
    });

  console.log('\n' + '='.repeat(60));
}

analyzeWorkOrders();
