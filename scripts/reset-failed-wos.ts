import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') })

async function resetFailedWOs() {
  const supabase = createSupabaseServiceClient()
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'

  // Get all failed and in_progress work orders
  const { data: toReset } = await supabase
    .from('work_orders')
    .select('id, title, status')
    .eq('project_id', projectId)
    .in('status', ['failed', 'in_progress'])

  console.log(`\n🔄 Resetting ${toReset?.length || 0} failed/in_progress work orders to "pending"...\n`)

  if (toReset && toReset.length > 0) {
    const { error } = await supabase
      .from('work_orders')
      .update({ status: 'pending' })
      .eq('project_id', projectId)
      .in('status', ['failed', 'in_progress'])

    if (error) {
      console.error('❌ Error:', error)
    } else {
      console.log(`✅ Successfully reset ${toReset.length} work orders to pending`)
      console.log('\nReset work orders:')
      toReset.forEach((wo, i) => {
        console.log(`${i + 1}. ${wo.title} (was: ${wo.status})`)
      })
    }
  } else {
    console.log('No failed or in_progress work orders to reset')
  }
}

resetFailedWOs().catch(console.error)
