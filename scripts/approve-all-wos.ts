import { createSupabaseServiceClient } from '../src/lib/supabase';

async function approveAllWorkOrders() {
  const supabase = createSupabaseServiceClient();
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951';

  console.log('\n🔄 Approving all work orders for project...\n');

  // Update all pending work orders to have auto_approved = true
  const { data, error } = await supabase
    .from('work_orders')
    .update({
      metadata: { auto_approved: true }
    })
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .select();

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log(`✅ Approved ${data?.length || 0} work orders\n`);

  // Show first few
  console.log('Sample approved WOs:');
  data?.slice(0, 5).forEach((wo: any, idx: number) => {
    console.log(`  ${idx + 1}. ${wo.title}`);
  });

  console.log('\n✅ Ready for orchestrator execution!\n');
}

approveAllWorkOrders().catch(console.error);
