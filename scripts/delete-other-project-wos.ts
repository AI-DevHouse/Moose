// Delete work orders from other projects (not the main multi-llm-discussion-v1 project)

import { createSupabaseServiceClient } from '../src/lib/supabase'

async function deleteOtherProjectWOs() {
  const supabase = createSupabaseServiceClient()
  const mainProjectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'

  console.log('\n🗑️  DELETING WORK ORDERS FROM OTHER PROJECTS\n')
  console.log('=' .repeat(60))

  // Get all WOs not in main project
  const { data: otherWos, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, title, project_id')
    .neq('project_id', mainProjectId)
    .order('created_at', { ascending: true })

  if (fetchError) {
    console.error('❌ Error fetching work orders:', fetchError)
    throw fetchError
  }

  if (!otherWos || otherWos.length === 0) {
    console.log('✅ No work orders from other projects to delete\n')
    return
  }

  console.log(`Found ${otherWos.length} work orders from other projects:\n`)

  // Group by project
  const byProject = otherWos.reduce((acc, wo) => {
    const projId = wo.project_id || 'NULL'
    if (!acc[projId]) acc[projId] = []
    acc[projId].push(wo)
    return acc
  }, {} as Record<string, typeof otherWos>)

  Object.entries(byProject).forEach(([projId, wos]) => {
    console.log(`  Project ${projId.substring(0, 8)}: ${wos.length} WOs`)
  })

  console.log(`\n🗑️  Deleting ${otherWos.length} work orders...\n`)

  // Delete all WOs not in main project
  const { error: deleteError, count: deleted } = await supabase
    .from('work_orders')
    .delete()
    .neq('project_id', mainProjectId)

  if (deleteError) {
    console.error('❌ Error deleting work orders:', deleteError)
    throw deleteError
  }

  console.log(`  ✅ Deleted ${deleted || otherWos.length} work orders\n`)

  // Verify
  const { count: remaining } = await supabase
    .from('work_orders')
    .select('*', { count: 'exact', head: true })

  const { count: mainProject } = await supabase
    .from('work_orders')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', mainProjectId)

  console.log('✅ VERIFICATION:')
  console.log(`  Total work orders: ${remaining || 0}`)
  console.log(`  Main project: ${mainProject || 0}`)
  console.log(`  Other projects: ${(remaining || 0) - (mainProject || 0)}\n`)

  if ((remaining || 0) === (mainProject || 0)) {
    console.log('✅ SUCCESS: All work orders from other projects deleted!\n')
  } else {
    console.log('⚠️  WARNING: Some work orders from other projects remain\n')
  }
}

deleteOtherProjectWOs().catch(console.error)
