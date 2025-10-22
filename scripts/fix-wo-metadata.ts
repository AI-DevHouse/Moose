import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

config({ path: resolve(__dirname, '../.env.local') })

async function fixMetadata() {
  const supabase = createSupabaseServiceClient()

  const woIds = [
    '54e49c81-9308-42f2-9c41-4ec7cfb6671f',
    '2c76df9f-4087-43ec-93c5-6a57473b3f07',
    'f0fd1bf2-c2ba-48fa-bc89-1bfa24868a85'
  ]

  for (const id of woIds) {
    // Get current metadata
    const { data: wo } = await supabase
      .from('work_orders')
      .select('title, metadata')
      .eq('id', id)
      .single()

    if (wo) {
      // Merge auto_approved into existing metadata
      const newMetadata = {
        ...(wo.metadata || {}),
        auto_approved: true,
        worktree_scale_test_v92: true
      }

      const { error } = await supabase
        .from('work_orders')
        .update({ metadata: newMetadata })
        .eq('id', id)

      if (error) {
        console.error(`❌ Error updating ${id.substring(0, 8)}:`, error)
      } else {
        console.log(`✅ Fixed ${id.substring(0, 8)} - ${wo.title}`)
        console.log(`   Metadata:`, JSON.stringify(newMetadata))
      }
    } else {
      console.log(`❌ WO ${id.substring(0, 8)} not found`)
    }
  }
}

fixMetadata().catch(console.error)
