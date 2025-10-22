import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') })

async function checkPendingWOs() {
  const supabase = createSupabaseServiceClient()
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'

  // Get pending work orders
  const { data: wos, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata, created_at')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10)

  if (fetchError) {
    console.error('❌ Error fetching work orders:', fetchError)
    return
  }

  console.log(`\n🔍 Found ${wos?.length || 0} pending work orders\n`)

  if (!wos || wos.length === 0) {
    console.log('No pending work orders found')
    return
  }

  wos.forEach((wo, idx) => {
    console.log(`${idx + 1}. ID: ${wo.id.substring(0, 8)}...`)
    console.log(`   Title: ${wo.title}`)
    console.log(`   Status: ${wo.status}`)
    console.log(`   Metadata: ${JSON.stringify(wo.metadata || {})}`)
    console.log(`   Created: ${wo.created_at}`)
    console.log()
  })
}

checkPendingWOs().catch(console.error)
