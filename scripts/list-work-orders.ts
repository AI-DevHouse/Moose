import { createSupabaseServiceClient } from '../src/lib/supabase'

async function listWorkOrders() {
  const supabase = createSupabaseServiceClient()

  console.log('📋 Fetching work orders from Supabase...\n')

  const { data, error } = await supabase
    .from('work_orders')
    .select('id, title, status, risk_level, project_id, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }

  if (!data || data.length === 0) {
    console.log('No work orders found.')
    process.exit(0)
  }

  console.log(`Found ${data.length} work orders:\n`)

  data.forEach((wo, index) => {
    console.log(`${index + 1}. [${wo.status}] ${wo.title}`)
    console.log(`   ID: ${wo.id}`)
    console.log(`   Risk: ${wo.risk_level}`)
    console.log(`   Project: ${wo.project_id || 'none'}`)
    console.log(`   Created: ${wo.created_at ? new Date(wo.created_at).toLocaleString() : 'unknown'}`)
    console.log()
  })

  // Count by status
  const { data: allData, error: countError } = await supabase
    .from('work_orders')
    .select('status')

  if (!countError && allData) {
    const statusCounts = allData.reduce((acc: any, wo: any) => {
      acc[wo.status] = (acc[wo.status] || 0) + 1
      return acc
    }, {})

    console.log('Status Summary:')
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`)
    })
  }
}

listWorkOrders().catch(console.error)
