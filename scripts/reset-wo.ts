import { createSupabaseServiceClient } from '../src/lib/supabase'

async function resetWorkOrder() {
  const supabase = createSupabaseServiceClient()
  const workOrderId = process.argv[2]

  if (!workOrderId) {
    console.error('Usage: tsx reset-wo.ts <work-order-id>')
    process.exit(1)
  }

  console.log(`🔄 Resetting work order ${workOrderId}...\n`)

  const { data, error } = await supabase
    .from('work_orders')
    .update({
      status: 'pending',
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
  console.log('   Title:', data.title)
}

resetWorkOrder().catch(console.error)
