import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MLD_PROJECT_ID = 'f73e8c9f-1d78-4251-8fb6-a070fd857951';

async function approveNewFeatureWOs() {
  console.log('\n🎯 Approving new feature WOs from latest decomposition (2025-10-22)...\n');

  // Find all WOs created on 2025-10-22 that are NOT the bootstrap WO
  const { data: wos, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, title, status, description, created_at')
    .eq('project_id', MLD_PROJECT_ID)
    .gte('created_at', '2025-10-22T00:00:00')
    .lt('created_at', '2025-10-23T00:00:00')
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('Error fetching WOs:', fetchError);
    return;
  }

  if (!wos || wos.length === 0) {
    console.log('❌ No WOs found from 2025-10-22');
    return;
  }

  console.log(`Found ${wos.length} WOs created on 2025-10-22\n`);

  let approvedCount = 0;

  for (const wo of wos) {
    const shortId = wo.id.substring(0, 8);

    // Skip the bootstrap WO (already merged)
    if (wo.title.toLowerCase().includes('bootstrap')) {
      console.log(`⏭️  WO-${shortId}: ${wo.title} (SKIPPED - bootstrap already merged)`);
      continue;
    }

    // Update to approved
    const { error } = await supabase
      .from('work_orders')
      .update({ status: 'approved' })
      .eq('id', wo.id);

    if (error) {
      console.log(`❌ WO-${shortId}: Failed - ${error.message}`);
    } else {
      console.log(`✅ WO-${shortId}: ${wo.title}`);
      approvedCount++;
    }
  }

  console.log(`\n✅ Approved ${approvedCount} feature WOs!\n`);
  console.log('These WOs will build on top of the bootstrap infrastructure (PR #251).');
  console.log('\n📊 Ready for orchestrator execution.');
}

approveNewFeatureWOs();
