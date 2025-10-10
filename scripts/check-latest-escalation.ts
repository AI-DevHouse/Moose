import { createSupabaseServiceClient } from '../src/lib/supabase'

async function checkLatestEscalation() {
  const supabase = createSupabaseServiceClient()

  const escalationId = 'a640689f-2768-4645-8b24-1b9fae8033bd'

  console.log('🚨 Checking latest escalation...\n')

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
  console.log('  Trigger Type:', data.trigger_type)
  console.log('  Status:', data.status)
  console.log()

  const trigger = (data.context as any)?.trigger || {}
  console.log('Trigger Context:')
  console.log('  Error Messages:', trigger.error_messages)
  console.log('  Blocking Issue:', trigger.blocking_issue)
  console.log()
}

checkLatestEscalation().catch(console.error)
