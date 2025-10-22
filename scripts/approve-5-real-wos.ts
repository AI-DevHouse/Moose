// Approve 5 real pending WOs for orchestrator testing
import { config } from 'dotenv';
import { resolve } from 'path';
import { createSupabaseServiceClient } from '../src/lib/supabase';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

async function approve5RealWOs() {
  const supabase = createSupabaseServiceClient();
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951';

  console.log('🔍 Finding pending work orders...\n');

  // Get first 5 pending WOs
  const { data: pendingWOs, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5);

  if (fetchError) {
    console.error('❌ Error fetching WOs:', fetchError);
    process.exit(1);
  }

  if (!pendingWOs || pendingWOs.length === 0) {
    console.log('❌ No pending work orders found');
    process.exit(1);
  }

  console.log(`Found ${pendingWOs.length} pending work orders:\n`);
  pendingWOs.forEach((wo, i) => {
    console.log(`${i + 1}. ${wo.id.substring(0, 8)}... - ${wo.title}`);
  });

  console.log('\n✅ Updating metadata to auto_approved=true with complexity scores...\n');

  // Assign varying complexity scores for extraction validation testing (0.6 to 0.8)
  const complexityScores = [0.6, 0.65, 0.7, 0.75, 0.8];

  // Update each WO
  for (let i = 0; i < pendingWOs.length; i++) {
    const wo = pendingWOs[i];
    const updatedMetadata = {
      ...(wo.metadata || {}),
      auto_approved: true,
      approved_at: new Date().toISOString(),
      approved_by: 'manual-script',
      test_batch: 'extraction_validation_v1',
      complexity_score: complexityScores[i]
    };

    const { error: updateError } = await supabase
      .from('work_orders')
      .update({ metadata: updatedMetadata })
      .eq('id', wo.id);

    if (updateError) {
      console.error(`❌ Error updating WO ${wo.id}:`, updateError);
    } else {
      console.log(`✅ Approved: ${wo.id.substring(0, 8)}... - ${wo.title}`);
    }
  }

  console.log('\n✅ Done! 5 work orders approved');
}

approve5RealWOs().catch(console.error);
