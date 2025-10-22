import { config } from 'dotenv';
import { resolve } from 'path';
import { createSupabaseServiceClient } from '../src/lib/supabase';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

const supabase = createSupabaseServiceClient();

async function main() {
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951';

  // 2 remaining code-heavy WOs to test the dependency context fix
  const woIds = [
    '6b6d6b3d', // TypeScript strict mode configuration
    '8c2f3b23', // Input validation to environment variables
  ];

  console.log('\n🧪 Approving 2 remaining WOs to test dependency context fix...\n');

  // Get all pending WOs
  const { data: allWos, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata')
    .eq('project_id', projectId)
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('❌ Error fetching work orders:', fetchError);
    return;
  }

  if (!allWos || allWos.length === 0) {
    console.log('❌ No work orders found');
    return;
  }

  // Approve each WO
  for (const partialId of woIds) {
    const wo = allWos.find(w => w.id.startsWith(partialId));

    if (!wo) {
      console.log(`⚠️  Could not find WO starting with ${partialId}`);
      continue;
    }

    console.log(`🔧 ${wo.id.substring(0, 8)}... - ${wo.title}`);
    console.log(`   Old status: ${wo.status}`);

    // Reset to pending and add approval metadata
    const metadata = wo.metadata || {};
    const { error: updateError } = await supabase
      .from('work_orders')
      .update({
        status: 'pending',
        metadata: {
          ...metadata,
          auto_approved: true,
          approved_at: new Date().toISOString(),
          test_run: 'dependency_context_fix_v2'
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', wo.id);

    if (updateError) {
      console.log(`   ❌ Failed to approve: ${updateError.message}`);
    } else {
      console.log(`   ✅ Approved with test_run marker\n`);
    }
  }

  console.log('✨ Approval complete. Orchestrator should pick these up.\n');
}

main().catch(console.error);
