// Get all failed work orders with full details
import { createSupabaseServiceClient } from '@/lib/supabase';

async function getAllFailedWOs() {
  const supabase = createSupabaseServiceClient();

  const { data: failedWOs, error } = await supabase
    .from('work_orders')
    .select('*')
    .eq('status', 'failed')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total failed WOs: ${failedWOs?.length || 0}\n`);

  // Group by failure stage
  const byStage: Record<string, any[]> = {};

  failedWOs?.forEach(wo => {
    const stage = wo.metadata?.orchestrator_error?.stage || 'unknown';
    if (!byStage[stage]) byStage[stage] = [];
    byStage[stage].push(wo);
  });

  Object.entries(byStage).forEach(([stage, wos]) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`STAGE: ${stage.toUpperCase()} (${wos.length} failures)`);
    console.log('='.repeat(80));

    wos.forEach((wo, idx) => {
      const error = wo.metadata?.orchestrator_error;
      console.log(`\n${idx + 1}. ${wo.title}`);
      console.log(`   ID: ${wo.id.substring(0, 8)}`);
      console.log(`   Error Class: ${error?.failure_class || 'unclassified'}`);
      console.log(`   Error: ${error?.message?.substring(0, 120)}...`);
    });
  });
}

getAllFailedWOs().catch(console.error);
