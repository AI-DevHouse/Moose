import { createSupabaseServiceClient } from '../src/lib/supabase'

async function checkProjectStatus() {
  const supabase = createSupabaseServiceClient()
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'

  console.log('\n📊 ITERATION 1 - PROJECT STATUS REPORT')
  console.log('=' .repeat(60))

  // Get all work orders
  const { data: wos, error: woError } = await supabase
    .from('work_orders')
    .select('id, title, status')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (woError) {
    console.error('❌ Error fetching work orders:', woError)
    return
  }

  // Status distribution
  const statusCounts: Record<string, number> = {}
  wos?.forEach(wo => {
    statusCounts[wo.status] = (statusCounts[wo.status] || 0) + 1
  })

  console.log(`\nTotal Work Orders: ${wos?.length || 0}`)
  console.log('\nStatus Distribution:')
  Object.entries(statusCounts).sort().forEach(([status, count]) => {
    const pct = ((count / (wos?.length || 1)) * 100).toFixed(1)
    const emoji = status === 'completed' ? '✅' : status === 'failed' ? '❌' : status === 'in_progress' ? '⏳' : '⏸️'
    console.log(`  ${emoji} ${status}: ${count} (${pct}%)`)
  })

  // Success rate
  const completed = statusCounts['completed'] || 0
  const failed = statusCounts['failed'] || 0
  const attempted = completed + failed
  const successRate = attempted > 0 ? ((completed / attempted) * 100).toFixed(1) : '0.0'

  console.log('\n📈 Success Rate:')
  console.log(`  ${completed} completed / ${attempted} attempted = ${successRate}%`)

  // Get failures
  const failures = wos?.filter(w => w.status === 'failed') || []
  if (failures.length > 0) {
    console.log(`\n❌ Failed Work Orders (${failures.length}):`)
    console.log('=' .repeat(60))
    failures.slice(0, 10).forEach((f, i) => {
      console.log(`${i+1}. ${f.title}`)
    })
  }

  // Get completed
  const completedWos = wos?.filter(w => w.status === 'completed') || []
  if (completedWos.length > 0) {
    console.log(`\n\n✅ Completed Work Orders (${completedWos.length}):`)
    console.log('=' .repeat(60))
    completedWos.forEach((wo, i) => {
      console.log(`${i+1}. ${wo.title}`)
    })
  }

  // Get in progress
  const inProgress = wos?.filter(w => w.status === 'in_progress') || []
  if (inProgress.length > 0) {
    console.log(`\n\n⏳ In Progress (${inProgress.length}):`)
    console.log('=' .repeat(60))
    inProgress.forEach((wo, i) => {
      console.log(`${i+1}. ${wo.title}`)
    })
  }

  // Get cost data
  const woIds = wos?.map(w => w.id) || []
  const { data: outcomes } = await supabase
    .from('outcome_vectors')
    .select('cost, duration_ms')
    .in('work_order_id', woIds)

  const totalCost = outcomes?.reduce((sum, o) => sum + (o.cost || 0), 0) || 0
  const avgDuration = outcomes?.length
    ? outcomes.reduce((sum, o) => sum + (o.duration_ms || 0), 0) / outcomes.length / 1000 / 60
    : 0

  console.log('\n\n💰 Cost & Performance:')
  console.log('=' .repeat(60))
  console.log(`  Total Cost: $${totalCost.toFixed(2)} / $150.00`)
  console.log(`  Budget Used: ${((totalCost / 150) * 100).toFixed(1)}%`)
  console.log(`  Average Duration: ${avgDuration.toFixed(1)} minutes per WO`)

  // Decision
  console.log('\n\n🎯 RECOMMENDATION:')
  console.log('=' .repeat(60))
  const rate = parseFloat(successRate)
  if (rate >= 60) {
    console.log('✅ Success rate ≥ 60% - EXCELLENT!')
    console.log('→ Review code quality and consider deployment')
  } else if (rate >= 20) {
    console.log('⚠️  Success rate 20-60% - NEEDS FIXES')
    console.log('→ Fix critical bugs and retry failed WOs')
  } else {
    console.log('❌ Success rate < 20% - CRITICAL ISSUES')
    console.log('→ Fix all bugs before continuing')
  }
  console.log()
}

checkProjectStatus().catch(console.error)
