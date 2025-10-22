import { config } from 'dotenv';
import { resolve } from 'path';
import { createSupabaseServiceClient } from '../src/lib/supabase';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

const supabase = createSupabaseServiceClient();

async function main() {
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951';

  // 5 code-heavy WOs identified from pending list
  const woIds = [
    '6b6d6b3d', // TypeScript strict mode configuration
    '8c2f3b23', // Input validation to environment variables
    '93ab742f', // Improved error handling to API endpoints
    'a7bb6c49', // Parser Recognition Logic
    '92a9c7c1', // Validation and Testing Suite
  ];

  console.log('\n🎯 Approving 5 code-heavy WOs for dependency context validation...\n');

  // First, get all pending WOs
  const { data: allWos, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, title, status')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('❌ Error fetching work orders:', fetchError);
    return;
  }

  if (!allWos || allWos.length === 0) {
    console.log('❌ No pending work orders found');
    return;
  }

  // Find and approve matching WOs
  for (const partialId of woIds) {
    const wo = allWos.find(w => w.id.startsWith(partialId));

    if (!wo) {
      console.log(`❌ Could not find WO starting with ${partialId}`);
      continue;
    }

    console.log(`📝 ${wo.id.substring(0, 8)}... - ${wo.title}`);
    console.log(`   Current status: ${wo.status}`);

    // Update metadata to mark as approved (status stays 'pending' per poller requirements)
    const metadata = wo.metadata || {};
    const { error: updateError } = await supabase
      .from('work_orders')
      .update({
        metadata: {
          ...metadata,
          auto_approved: true,
          approved_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', wo.id);

    if (updateError) {
      console.log(`   ❌ Failed to approve: ${updateError.message}`);
    } else {
      console.log(`   ✅ Approved\n`);
    }
  }

  console.log('✨ Approval complete. Orchestrator will pick these up in the next polling cycle.\n');
}

main().catch(console.error);
