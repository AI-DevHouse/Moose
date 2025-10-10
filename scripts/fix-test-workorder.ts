import { createSupabaseServiceClient } from '../src/lib/supabase'

async function fixWorkOrder() {
  const supabase = createSupabaseServiceClient()

  const workOrderId = '8f8335d7-ce95-479f-baba-cb1f000ca533'

  console.log('🔧 Fixing work order approval...\n')

  // Update work order to have correct status and metadata
  const { data, error } = await supabase
    .from('work_orders')
    .update({
      status: 'pending', // Must be 'pending', not 'approved'
      metadata: {
        auto_approved: true, // Flag required by poller
        test_work_order: true
      }
    })
    .eq('id', workOrderId)
    .select()
    .single()

  if (error) {
    console.error('❌ Error updating work order:', error)
    process.exit(1)
  }

  console.log('✅ Work order fixed!')
  console.log('   ID:', data.id)
  console.log('   Status:', data.status)
  console.log('   Metadata:', data.metadata)
  console.log()
  console.log('Now the orchestrator will pick it up on the next poll.')
}

fixWorkOrder().catch(console.error)
