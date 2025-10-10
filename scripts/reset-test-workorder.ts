import { createSupabaseServiceClient } from '../src/lib/supabase'

async function resetWorkOrder() {
  const supabase = createSupabaseServiceClient()

  const workOrderId = '8f8335d7-ce95-479f-baba-cb1f000ca533'

  console.log('🔄 Resetting work order for retest...\n')

  // Reset work order to pending with approval flag
  const { data, error } = await supabase
    .from('work_orders')
    .update({
      status: 'pending',
      metadata: {
        auto_approved: true,
        test_work_order: true,
        retry_attempt: 2
      },
      completed_at: null,
      actual_cost: null,
      github_branch: null,
      github_pr_url: null,
      github_pr_number: null
    })
    .eq('id', workOrderId)
    .select()
    .single()

  if (error) {
    console.error('❌ Error resetting work order:', error)
    process.exit(1)
  }

  console.log('✅ Work order reset!')
  console.log('   ID:', data.id)
  console.log('   Status:', data.status)
  console.log('   Metadata:', data.metadata)
  console.log()
  console.log('Ready for orchestrator to pick up again.')
}

resetWorkOrder().catch(console.error)
