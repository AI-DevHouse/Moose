/**
 * Approve 3 WOs for extraction fix validation
 * Uses new status state machine (status='approved')
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

config({ path: resolve(__dirname, '../.env.local') })

async function approve3ExtractionTestWOs() {
  const supabase = createSupabaseServiceClient()
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'

  // Get the 3 most recent pending work orders
  const { data: wos, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, title, status, description, created_at')
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

  // Display WOs to be approved
  console.log('📋 Work orders to approve:')
  for (const wo of wos) {
    console.log(`  ${wo.id.substring(0, 8)}... - ${wo.title}`)
  }
  console.log('')

  // Update status to 'approved' (new state machine approach)
  for (const wo of wos) {
    const { error: updateError } = await supabase
      .from('work_orders')
      .update({
        status: 'approved'
      })
      .eq('id', wo.id)

    if (updateError) {
      console.error(`❌ Error updating WO ${wo.id}:`, updateError)
    } else {
      console.log(`✅ Approved: ${wo.id.substring(0, 8)}... - ${wo.title}`)
    }
  }

  console.log(`\n✅ Successfully approved ${wos.length} work orders`)
  console.log('📦 Extraction fix validation - monitoring for:')
  console.log('   - Markdown fence unwrapping messages')
  console.log('   - Zero extraction validation warnings')
  console.log('   - <5% TS error rate after refinement')
  console.log('\nOrchestrator should pick these up on next poll cycle (~10s)')
}

approve3ExtractionTestWOs().catch(console.error)
