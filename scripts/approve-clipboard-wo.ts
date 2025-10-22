/**
 * Approve the Clipboard Coordination WO for testing
 */

import { createSupabaseServiceClient } from '../src/lib/supabase';

async function approveClipboardWO() {
  const supabase = createSupabaseServiceClient();
  const woId = '787c6dd1-e0c4-490a-95af-a851e07996b1';

  console.log('🎯 Approving Clipboard-WebView Coordination WO for orchestrator...\n');

  const { data, error } = await supabase
    .from('work_orders')
    .update({ status: 'approved' })
    .eq('id', woId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Work Order Approved!\n');
  console.log(`Title: ${data.title}`);
  console.log(`Status: ${data.status}`);
  console.log(`ID: ${woId}`);
  console.log('\n📝 Acceptance Criteria:');

  if (Array.isArray(data.acceptance_criteria)) {
    data.acceptance_criteria.forEach((ac: string, idx: number) => {
      console.log(`  AC-${String(idx + 1).padStart(3, '0')}: ${ac}`);
    });
  }

  console.log('\n✅ Ready for orchestrator execution');
  console.log('   Run: npm run orchestrator:daemon');
}

approveClipboardWO().catch(console.error);
