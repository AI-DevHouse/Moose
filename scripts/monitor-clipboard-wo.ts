/**
 * Monitor the Clipboard Coordination WO execution
 */

import { createSupabaseServiceClient } from '../src/lib/supabase';

async function monitorWO() {
  const supabase = createSupabaseServiceClient();
  const woId = '787c6dd1-e0c4-490a-95af-a851e07996b1';

  console.log('👀 Monitoring WO execution...\n');

  const { data, error } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', woId)
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📋 ${data.title}`);
  console.log(`${'='.repeat(80)}\n`);
  console.log(`Status: ${data.status}`);
  console.log(`Assigned to: ${data.assigned_to || 'Unassigned'}`);
  console.log(`Started at: ${data.started_at || 'Not started'}`);
  console.log(`Completed at: ${data.completed_at || 'Not completed'}`);

  if (data.result) {
    console.log(`\n📊 Result:`);
    console.log(JSON.stringify(data.result, null, 2));
  }

  if (data.github_pr_url) {
    console.log(`\n🔗 PR: ${data.github_pr_url}`);
  }

  if (data.execution_metadata) {
    console.log(`\n🔍 Execution Metadata:`);
    console.log(JSON.stringify(data.execution_metadata, null, 2));
  }

  console.log(`\n${'='.repeat(80)}`);
}

monitorWO().catch(console.error);
