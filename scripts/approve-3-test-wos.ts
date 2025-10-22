import { createSupabaseServiceClient } from '../src/lib/supabase';

const supabase = createSupabaseServiceClient();

const targetTitles = [
  'Add input validation to environment variables',
  'Add improved error handling to API endpoints',
  'Add TypeScript strict mode configuration'
];

async function approveWOs() {
  console.log('🎯 Approving 3 WOs to test dependency fix...\n');

  for (const title of targetTitles) {
    const { data: wo, error } = await supabase
      .from('work_orders')
      .select('id, title, status')
      .eq('title', title)
      .single();

    if (!wo) {
      console.log(`⚠️  Not found: ${title}`);
      continue;
    }

    await supabase
      .from('work_orders')
      .update({ status: 'approved' })
      .eq('id', wo.id);

    console.log(`✅ Approved WO #${wo.id.substring(0, 8)}: ${wo.title}`);
  }

  console.log('\n🚀 Orchestrator should pick these up shortly');
  console.log('📊 Monitor: watch the logs or check status in ~2-3 minutes\n');
}

approveWOs();
