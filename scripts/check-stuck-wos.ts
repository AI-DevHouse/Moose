import { createSupabaseServiceClient } from '../src/lib/supabase'

async function checkStuckWOs() {
  const supabase = createSupabaseServiceClient()
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'

  const { data: inProgress } = await supabase
    .from('work_orders')
    .select('id, title, status')
    .eq('project_id', projectId)
    .eq('status', 'in_progress')

  console.log(`\n🔍 Work Orders Stuck in "in_progress": ${inProgress?.length || 0}\n`)

  inProgress?.forEach((wo, i) => {
    console.log(`${i + 1}. ${wo.title}`)
    console.log(`   ID: ${wo.id}`)
  })

  if (inProgress && inProgress.length > 0) {
    console.log('\n💡 These will need to be reset to "pending" before restarting')
  }
}

checkStuckWOs().catch(console.error)
