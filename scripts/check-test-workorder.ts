import { createSupabaseServiceClient } from '../src/lib/supabase'

async function checkWorkOrder() {
  const supabase = createSupabaseServiceClient()

  const workOrderId = '8f8335d7-ce95-479f-baba-cb1f000ca533'

  console.log('🔍 Checking work order details...\n')

  // Get the specific work order
  const { data, error } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', workOrderId)
    .single()

  if (error) {
    console.error('❌ Error fetching work order:', error)
    process.exit(1)
  }

  console.log('Work Order Details:')
  console.log('  ID:', data.id)
  console.log('  Title:', data.title)
  console.log('  Status:', data.status)
  console.log('  Metadata:', JSON.stringify(data.metadata, null, 2))
  console.log('  Project ID:', data.project_id)
  console.log()

  // Check if it matches the poller criteria
  const metadata = (data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)) ? data.metadata as Record<string, any> : {}
  const isApproved = metadata.auto_approved === true ||
                     metadata.approved_by_director === true ||
                     metadata.director_approved === true

  console.log('Poller Criteria:')
  console.log('  Status = "pending":', data.status === 'pending' ? '✅' : '❌')
  console.log('  Has approval flag:', isApproved ? '✅' : '❌')
  console.log()

  if (data.status === 'pending' && isApproved) {
    console.log('✅ Work order should be picked up by poller!')
  } else {
    console.log('❌ Work order will NOT be picked up by poller')
    if (data.status !== 'pending') {
      console.log('   Reason: Status is not "pending"')
    }
    if (!isApproved) {
      console.log('   Reason: No approval flag in metadata')
    }
  }
}

checkWorkOrder().catch(console.error)
