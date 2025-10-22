import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') })

async function fixApprovedWOs() {
  const supabase = createSupabaseServiceClient()

  console.log('🔧 Fixing approved WOs back to pending with auto_approved metadata...\n')

  // Get all WOs with status='approved'
  const { data: approvedWOs, error } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata')
    .eq('status', 'approved')

  if (error) {
    console.error('❌ Error fetching WOs:', error)
    return
  }

  if (!approvedWOs || approvedWOs.length === 0) {
    console.log('✅ No approved WOs to fix')
    return
  }

  console.log(`📋 Found ${approvedWOs.length} WOs with status='approved'\n`)

  let fixed = 0
  for (const wo of approvedWOs) {
    const metadata = wo.metadata || {}
    metadata.auto_approved = true

    const { error: updateError } = await supabase
      .from('work_orders')
      .update({
        status: 'pending',
        metadata
      })
      .eq('id', wo.id)

    if (updateError) {
      console.error(`❌ Error fixing ${wo.id}:`, updateError)
      continue
    }

    fixed++
    console.log(`${fixed}. ✅ ${wo.id.substring(0, 8)}... - ${wo.title}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log(`✅ Fixed ${fixed}/${approvedWOs.length} work orders`)
  console.log('   Status: approved → pending')
  console.log('   Metadata: auto_approved = true')
  console.log('='.repeat(60))
}

fixApprovedWOs().catch(console.error)
