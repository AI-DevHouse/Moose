import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') })

async function approveLatest3WOs() {
  const supabase = createSupabaseServiceClient()
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'

  // Get the 3 most recent pending work orders
  const { data: wos, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, title, status, created_at')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(3)

  if (fetchError) {
    console.error('❌ Error fetching work orders:', fetchError)
    return
  }

  console.log(`\n🔍 Found ${wos?.length || 0} pending work orders\n`)

  if (!wos || wos.length === 0) {
    console.log('No pending work orders found')
    return
  }

  // Update metadata to set auto_approved
  for (const wo of wos) {
    const { error: updateError } = await supabase
      .from('work_orders')
      .update({
        metadata: { auto_approved: true, worktree_test: true }
      })
      .eq('id', wo.id)

    if (updateError) {
      console.error(`❌ Error updating WO ${wo.id}:`, updateError)
    } else {
      console.log(`✅ Approved: ${wo.id.substring(0, 8)}... - ${wo.title}`)
    }
  }

  console.log(`\n✅ Successfully approved ${wos.length} work orders`)
  console.log('\nOrchestrator should pick these up on next poll cycle (~10s)')
}

approveLatest3WOs().catch(console.error)
