import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const woId = '501edce0-b877-455c-a976-6570da1e2ada';

async function checkWO() {
  console.log(`📋 WORK ORDER DETAILS: ${woId}\n`);
  console.log('='.repeat(70));

  const { data: wo, error } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', woId)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!wo) {
    console.log('⚠️  Work order not found');
    return;
  }

  console.log(`Title: ${wo.title}`);
  console.log(`Status: ${wo.status}`);
  console.log(`Risk Level: ${wo.risk_level}`);
  console.log(`Proposer ID: ${wo.proposer_id || 'N/A'}`);
  console.log(`Estimated Cost: $${wo.estimated_cost || 0}`);
  console.log(`Pattern Confidence: ${wo.pattern_confidence || 'N/A'}`);
  console.log(`GitHub PR: ${wo.github_pr_url || 'N/A'}`);
  console.log(`GitHub Branch: ${wo.github_branch || 'N/A'}`);
  console.log(`Created: ${wo.created_at}`);
  console.log(`\nMetadata:`);
  console.log(JSON.stringify(wo.metadata, null, 2));

  // Check if complexity_score is in metadata
  const metadata = wo.metadata as any;
  if (metadata?.complexity_score !== undefined) {
    console.log(`\n✅ Complexity score found in metadata: ${metadata.complexity_score}`);
  } else {
    console.log(`\n⚠️  No complexity_score in metadata`);
  }

  console.log('\n='.repeat(70));
  console.log('\n📊 SCHEMA CHECK: Is complexity_score a column?');
  console.log('Checking work_orders table columns...\n');
}

checkWO().catch(console.error);
