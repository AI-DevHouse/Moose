import { createSupabaseServiceClient } from '../src/lib/supabase'

async function resetFailedWOs() {
  const supabase = createSupabaseServiceClient()
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'

  // Get all failed work orders
  const { data: failed } = await supabase
    .from('work_orders')
    .select('id, title, status')
    .eq('project_id', projectId)
    .eq('status', 'failed')

  console.log(`\n🔄 Resetting ${failed?.length || 0} failed work orders to "pending"...\n`)

  if (failed && failed.length > 0) {
    const { error } = await supabase
      .from('work_orders')
      .update({ status: 'pending' })
      .eq('project_id', projectId)
      .eq('status', 'failed')

    if (error) {
      console.error('❌ Error:', error)
    } else {
      console.log(`✅ Successfully reset ${failed.length} work orders to pending`)
      console.log('\nReset work orders:')
      failed.forEach((wo, i) => {
        console.log(`${i + 1}. ${wo.title}`)
      })
    }
  } else {
    console.log('No failed work orders to reset')
  }
}

resetFailedWOs().catch(console.error)
