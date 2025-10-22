import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') })

const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'

async function approveWOs() {
  const supabase = createSupabaseServiceClient()

  // Fetch top 3 pending WOs
  const { data: pending, error: fetchError} = await supabase
    .from('work_orders')
    .select('id, title, metadata')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(3)

  if (fetchError || !pending || pending.length === 0) {
    console.log('❌ No pending WOs found')
    return
  }

  console.log(`🔧 Approving ${pending.length} validation WOs via metadata...\n`);

  for (const wo of pending) {
    // Set auto_approved=true in metadata
    const updatedMetadata = { ...(wo.metadata || {}), auto_approved: true };

    const { data, error } = await supabase
      .from('work_orders')
      .update({ metadata: updatedMetadata })
      .eq('id', wo.id)
      .select('id, title, metadata');

    if (error) {
      console.error(`❌ Error approving:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`✅ Approved: ${data[0].title}`);
      console.log(`   ID: ${data[0].id.substring(0, 8)}...`);
      console.log(`   Metadata.auto_approved: ${data[0].metadata?.auto_approved}\n`);
    }
  }

  console.log('✅ Done. Orchestrator should pick these up on next poll.');
}

approveWOs().catch(console.error);
