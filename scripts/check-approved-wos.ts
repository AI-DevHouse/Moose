import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

config({ path: resolve(__dirname, '../.env.local') })

const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'

async function checkApproved() {
  const supabase = createSupabaseServiceClient()

  // Check for approved WOs
  const { data: approved } = await supabase
    .from('work_orders')
    .select('id, title, status')
    .eq('project_id', projectId)
    .eq('status', 'approved')
    .limit(10)

  console.log(`\n✅ Approved WOs remaining: ${approved?.length || 0}`)
  approved?.forEach(wo => {
    console.log(`  ${wo.id.substring(0,8)}... - ${wo.title}`)
  })

  // Check for in_progress WOs
  const { data: inProgress } = await supabase
    .from('work_orders')
    .select('id, title, status')
    .eq('project_id', projectId)
    .eq('status', 'in_progress')
    .limit(10)

  console.log(`\n▶ In Progress WOs: ${inProgress?.length || 0}`)
  inProgress?.forEach(wo => {
    console.log(`  ${wo.id.substring(0,8)}... - ${wo.title}`)
  })

  // Check specific 3 WOs (the ones we migrated)
  const ids = ['8c2f3b23', '6b6d6b3d', '10bc85f6']
  console.log('\nStatus verification - 3 migrated WOs:')

  for (const id of ids) {
    const { data } = await supabase
      .from('work_orders')
      .select('id, title, status')
      .eq('project_id', projectId)
      .like('id', `${id}%`)
      .single()

    if (data) {
      console.log(`  ${data.id.substring(0,8)}... - ${data.title}`)
      console.log(`    Status: ${data.status}`)
    }
  }
}

checkApproved().catch(console.error)
