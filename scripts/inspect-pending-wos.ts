import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

config({ path: resolve(__dirname, '../.env.local') })

async function inspectPendingWOs() {
  const supabase = createSupabaseServiceClient()

  const { data: pendingWOs, error } = await supabase
    .from('work_orders')
    .select('id, title, status, project_id, metadata')
    .eq('status', 'pending')
    .limit(5)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('📋 Pending Work Orders (first 5):\n')
  pendingWOs?.forEach((wo, idx) => {
    console.log(`${idx + 1}. ${wo.id.substring(0, 8)}... - ${wo.title}`)
    console.log(`   Status: ${wo.status}`)
    console.log(`   Project ID: ${wo.project_id || '❌ MISSING'}`)
    console.log(`   Metadata:`, JSON.stringify(wo.metadata, null, 2))
    console.log()
  })
}

inspectPendingWOs().catch(console.error)
