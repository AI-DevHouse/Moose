import { createSupabaseServiceClient } from '../src/lib/supabase'

async function createWorkOrder() {
  const supabase = createSupabaseServiceClient()
  const projectId = '06b35034-c877-49c7-b374-787d9415ea73'

  const testNumber = process.argv[2] || '2'

  console.log(`🧪 Creating test work order #${testNumber}...\n`)

  const workOrderData = {
    title: `Add test comment #${testNumber} to README`,
    description: `Add a comment to the README.md file:

<!-- Test orchestration pipeline - E2E Test #${testNumber} - ${new Date().toISOString()} -->

This is test #${testNumber} to validate the end-to-end execution pipeline.`,
    project_id: projectId,
    risk_level: 'low',
    status: 'pending',
    proposer_id: 'a40c5caf-b0fb-4a8b-a544-ca82bb2ab939',
    estimated_cost: 0.05,
    pattern_confidence: 0.9,
    acceptance_criteria: [
      'README.md contains the test comment',
      'Comment is properly formatted as HTML comment',
      'No other files are modified'
    ],
    files_in_scope: ['README.md'],
    context_budget_estimate: 1000,
    metadata: {
      auto_approved: true,
      test_work_order: true
    }
  }

  console.log('📝 Creating work order...')
  const { data: workOrder, error } = await supabase
    .from('work_orders')
    .insert(workOrderData)
    .select()
    .single()

  if (error) {
    console.error('❌ Error creating work order:', error)
    process.exit(1)
  }

  console.log('✅ Work order created:', workOrder.id)
  console.log('   Title:', workOrder.title)
  console.log('   Status:', workOrder.status)
  console.log('   Risk:', workOrder.risk_level)
  console.log()
  console.log('🎯 Ready for orchestrator!')
  console.log('   Run: npm run orchestrator')
}

createWorkOrder().catch(console.error)
