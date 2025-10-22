/**
 * Get full work order IDs by complexity
 */

import { createSupabaseServiceClient } from '../src/lib/supabase'

const PROJECT_ID = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'

async function getWOIds() {
  const supabase = createSupabaseServiceClient()

  const { data: wos } = await supabase
    .from('work_orders')
    .select('id, title, complexity_score')
    .eq('project_id', PROJECT_ID)
    .order('complexity_score', { ascending: true, nullsFirst: false })

  const withComplexity = wos?.filter(w => w.complexity_score && w.complexity_score < 0.7) || []

  console.log('Low/Mid Complexity Work Orders:\n')
  withComplexity.slice(0, 5).forEach(wo => {
    console.log(`${wo.id}  // [${wo.complexity_score?.toFixed(2)}] ${wo.title}`)
  })
}

getWOIds().catch(console.error)
