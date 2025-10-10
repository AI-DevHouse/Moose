import { createSupabaseServiceClient } from '../src/lib/supabase';

async function checkMetadata() {
  const supabase = createSupabaseServiceClient();
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951';

  const { data, error } = await supabase
    .from('work_orders')
    .select('id, title, metadata')
    .eq('project_id', projectId)
    .limit(3);

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log('\n📋 Sample Work Orders:\n');
  data?.forEach(wo => {
    console.log(`Title: ${wo.title}`);
    console.log(`Metadata:`, JSON.stringify(wo.metadata, null, 2));
    console.log('---\n');
  });
}

checkMetadata().catch(console.error);
