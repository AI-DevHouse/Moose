import { createSupabaseServiceClient } from '../src/lib/supabase'

async function checkEscalation() {
  const supabase = createSupabaseServiceClient()

  const escalationId = '7db57dc1-2740-49dc-96c2-f6af4f39f696'

  console.log('🚨 Checking escalation details...\n')

  const { data, error } = await supabase
    .from('escalations')
    .select('*')
    .eq('id', escalationId)
    .single()

  if (error) {
    console.error('❌ Error fetching escalation:', error)
    process.exit(1)
  }

  console.log('Escalation Details:')
  console.log('  ID:', data.id)
  console.log('  Work Order ID:', data.work_order_id)
  console.log('  Status:', data.status)
  console.log('  Trigger Type:', data.trigger_type)
  console.log('  Created At:', data.created_at)
  console.log()
  console.log('Context:')
  console.log(JSON.stringify(data.context, null, 2))
}

checkEscalation().catch(console.error)
