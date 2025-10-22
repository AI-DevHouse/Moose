import { config } from 'dotenv';
import { resolve } from 'path';
import { createSupabaseServiceClient } from '../src/lib/supabase';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

const supabase = createSupabaseServiceClient();

async function main() {
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951';

  // 5 code-heavy WOs that were incorrectly set to status='approved'
  const woIds = [
    '6b6d6b3d', // TypeScript strict mode configuration
    '8c2f3b23', // Input validation to environment variables
    '93ab742f', // Improved error handling to API endpoints
    'a7bb6c49', // Parser Recognition Logic
    '92a9c7c1', // Validation and Testing Suite
  ];

  console.log('\n🔧 Fixing approved WOs - resetting to pending with metadata...\n');

  // Get all WOs with status='approved'
  const { data: allWos, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata')
    .eq('project_id', projectId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('❌ Error fetching work orders:', fetchError);
    return;
  }

  if (!allWos || allWos.length === 0) {
    console.log('❌ No approved work orders found');
    return;
  }

  // Fix each WO
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
          approved_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', wo.id);

    if (updateError) {
      console.log(`   ❌ Failed to fix: ${updateError.message}`);
    } else {
      console.log(`   ✅ Fixed: status=pending, metadata.auto_approved=true\n`);
    }
  }

  console.log('✨ Fix complete. Orchestrator should pick these up in next poll.\n');
}

main().catch(console.error);
