import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MLD_PROJECT_ID = 'f73e8c9f-1d78-4251-8fb6-a070fd857951';

async function checkMLDWOs() {
  const { data, error } = await supabase
    .from('work_orders')
    .select('id, title, status, description, metadata, created_at')
    .eq('project_id', MLD_PROJECT_ID)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== Multi-LLM Discussion WOs ===\n');
  console.log(`Total WOs: ${data.length}\n`);

  data.forEach((wo, index) => {
    const shortId = wo.id.substring(0, 8);
    const isBootstrap = wo.title.toLowerCase().includes('bootstrap') || wo.description.toLowerCase().includes('bootstrap');
    const woType = isBootstrap ? '🔧 BOOTSTRAP' : '✨ FEATURE';

    console.log(`${index + 1}. ${woType} WO-${shortId}`);
    console.log(`   Title: ${wo.title}`);
    console.log(`   Status: ${wo.status}`);
    console.log(`   Created: ${wo.created_at}`);
    console.log();
  });

  // Show first pending WO for approval
  const pendingWOs = data.filter(wo => wo.status === 'pending');
  if (pendingWOs.length > 0) {
    console.log(`\n📋 ${pendingWOs.length} pending WOs ready for approval`);
    console.log(`\nFirst pending WO: ${pendingWOs[0].id.substring(0, 8)} - ${pendingWOs[0].title}`);
  }
}

checkMLDWOs();
