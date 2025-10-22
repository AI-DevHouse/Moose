import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') })

async function approveAllPendingWOs() {
  const supabase = createSupabaseServiceClient()

  console.log('✅ Setting auto_approved=true for all pending WOs...\n')

  // Get ALL pending WOs
  const { data: pendingWOs, error } = await supabase
    .from('work_orders')
    .select('id, title, metadata')
    .eq('status', 'pending')
    .limit(50)

  if (error) {
    console.error('❌ Error fetching WOs:', error)
    return
  }

  if (!pendingWOs || pendingWOs.length === 0) {
    console.log('✅ No pending WOs found')
    return
  }

  console.log(`📋 Found ${pendingWOs.length} pending WOs\n`)

  let updated = 0
  for (const wo of pendingWOs) {
    const metadata = wo.metadata || {}
    metadata.auto_approved = true

    const { error: updateError } = await supabase
      .from('work_orders')
      .update({ metadata })
      .eq('id', wo.id)

    if (updateError) {
      console.error(`❌ Error updating ${wo.id}:`, updateError)
      continue
    }

    updated++
    console.log(`${updated}. ✅ ${wo.id.substring(0, 8)}... - ${wo.title}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log(`✅ Updated ${updated}/${pendingWOs.length} work orders`)
  console.log('   metadata.auto_approved = true')
  console.log('='.repeat(60))
}

approveAllPendingWOs().catch(console.error)
