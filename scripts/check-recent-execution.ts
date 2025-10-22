import { createSupabaseServiceClient } from '../src/lib/supabase'

async function checkRecentExecution() {
  const supabase = createSupabaseServiceClient()

  // Check for any recently executed work orders
  const { data: recent } = await supabase
    .from('work_orders')
    .select('id, title, status, completed_at, metadata')
    .in('status', ['completed', 'failed', 'in_progress', 'needs_review', 'needs_rework'])
    .order('completed_at', { ascending: false })
    .limit(10)

  console.log('\n🔍 Recent Work Order Execution:\n')

  if (recent && recent.length > 0) {
    console.log(`Found ${recent.length} recently executed work orders:\n`)
    recent.forEach((wo, i) => {
      console.log(`${i + 1}. [${wo.status}] ${wo.id.slice(0, 8)} - ${wo.title.substring(0, 50)}`)
      if (wo.completed_at) {
        console.log(`   Completed: ${wo.completed_at}`)
      }
    })
  } else {
    console.log('❌ No recently executed work orders found')
    console.log('   This suggests the orchestrator may not be running or processing WOs')
  }

  console.log('\n' + '='.repeat(80) + '\n')

  // Check approved WOs waiting
  const { data: approved } = await supabase
    .from('work_orders')
    .select('id, title, metadata')
    .eq('status', 'pending')
    .limit(50)

  const autoApproved = approved?.filter(wo => wo.metadata?.auto_approved === true) || []

  if (autoApproved.length > 0) {
    console.log(`📋 ${autoApproved.length} auto-approved work orders waiting for execution:\n`)
    autoApproved.slice(0, 5).forEach((wo, i) => {
      console.log(`${i + 1}. ${wo.id.slice(0, 8)} - ${wo.title.substring(0, 50)}`)
    })
    console.log('\n💡 These should be picked up by the orchestrator polling')
  } else {
    console.log('⚠️  No auto-approved work orders found in pending status')
  }
}

checkRecentExecution().catch(console.error)
