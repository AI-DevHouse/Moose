import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') })

async function approveExtractionTestWOs() {
  const supabase = createSupabaseServiceClient()

  console.log('✅ Approving extraction test Work Orders...\n')

  // Get all pending WOs from extraction test batch
  const { data: pendingWOs, error } = await supabase
    .from('work_orders')
    .select('id, title, metadata')
    .eq('status', 'pending')
    .eq('metadata->>test_batch', 'extraction-validation-v1')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('❌ Error fetching WOs:', error)
    return
  }

  if (!pendingWOs || pendingWOs.length === 0) {
    console.log('✅ No extraction test WOs found')
    return
  }

  console.log(`📋 Found ${pendingWOs.length} extraction test WOs\n`)

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

  console.log('\n' + '='.repeat(80))
  console.log(`✅ Approved ${updated}/${pendingWOs.length} work orders`)
  console.log('   metadata.auto_approved = true')
  console.log('   Next: Orchestrator will pick them up in next poll cycle')
  console.log('='.repeat(80))
}

approveExtractionTestWOs().catch(console.error)
