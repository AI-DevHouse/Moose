import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

config({ path: resolve(__dirname, '../.env.local') })

async function getProjectId() {
  const supabase = createSupabaseServiceClient()

  // Try to get from existing work order
  const { data: woData } = await supabase
    .from('work_orders')
    .select('project_id')
    .limit(1)
    .single()

  if (woData?.project_id) {
    console.log(woData.project_id)
    return
  }

  // Fallback: get from projects table
  const { data: projectData } = await supabase
    .from('projects')
    .select('id')
    .eq('status', 'active')
    .limit(1)
    .single()

  if (projectData?.id) {
    console.log(projectData.id)
    return
  }

  console.error('No project found')
}

getProjectId().catch(console.error)
