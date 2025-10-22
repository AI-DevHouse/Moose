import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

config({ path: resolve(__dirname, '../.env.local') })

async function setStatusApproved() {
  const supabase = createSupabaseServiceClient()

  console.log('✅ Setting status=approved for all pending WOs...\n')

  // Get ALL pending WOs
  const { data: pendingWOs, error } = await supabase
    .from('work_orders')
    .select('id, title, status')
    .eq('status', 'pending')
    .limit(100)

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
    const { error: updateError } = await supabase
      .from('work_orders')
      .update({ status: 'approved' })
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
  console.log('   status = approved')
  console.log('='.repeat(60))
}

setStatusApproved().catch(console.error)
