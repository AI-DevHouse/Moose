/**
 * Find work orders by complexity level
 */

import { createSupabaseServiceClient } from '../src/lib/supabase'

const PROJECT_ID = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'

interface WorkOrderWithComplexity {
  id: string
  title: string
  status: string
  complexity_score: number | null
}

async function findWOsByComplexity() {
  const supabase = createSupabaseServiceClient()

  // Get all work orders with complexity scores
  const { data: wos, error } = await supabase
    .from('work_orders')
    .select('id, title, status, complexity_score')
    .eq('project_id', PROJECT_ID)
    .order('complexity_score', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('Error fetching work orders:', error)
    return
  }

  if (!wos || wos.length === 0) {
    console.log('No work orders found')
    return
  }

  // Filter out nulls
  const wosWithComplexity = wos.filter(wo => wo.complexity_score !== null) as WorkOrderWithComplexity[]

  console.log(`\n📊 Work Orders by Complexity (${wosWithComplexity.length} total)\n`)
  console.log('=' .repeat(80))

  // Group by complexity ranges
  const low = wosWithComplexity.filter(wo => wo.complexity_score! < 0.4)
  const mid = wosWithComplexity.filter(wo => wo.complexity_score! >= 0.4 && wo.complexity_score! < 0.7)
  const high = wosWithComplexity.filter(wo => wo.complexity_score! >= 0.7)

  console.log(`\n🟢 LOW COMPLEXITY (<0.4): ${low.length} work orders\n`)
  low.forEach(wo => {
    console.log(`  ${wo.id.substring(0, 8)}... [${wo.complexity_score?.toFixed(2)}] - ${wo.title}`)
  })

  console.log(`\n🟡 MID COMPLEXITY (0.4-0.7): ${mid.length} work orders\n`)
  mid.forEach(wo => {
    console.log(`  ${wo.id.substring(0, 8)}... [${wo.complexity_score?.toFixed(2)}] - ${wo.title}`)
  })

  console.log(`\n🔴 HIGH COMPLEXITY (>0.7): ${high.length} work orders\n`)
  high.forEach(wo => {
    console.log(`  ${wo.id.substring(0, 8)}... [${wo.complexity_score?.toFixed(2)}] - ${wo.title}`)
  })

  console.log('\n' + '='.repeat(80))
  console.log('\nRecommendations:')

  if (low.length > 0) {
    const lowestWO = low[0]
    console.log(`\n✅ LOWEST: ${lowestWO.id.substring(0, 8)}... [${lowestWO.complexity_score?.toFixed(2)}]`)
    console.log(`   ${lowestWO.title}`)
  }

  if (mid.length > 0) {
    const midWO = mid[Math.floor(mid.length / 2)]
    console.log(`\n✅ MID: ${midWO.id.substring(0, 8)}... [${midWO.complexity_score?.toFixed(2)}]`)
    console.log(`   ${midWO.title}`)
  }

  if (high.length > 0) {
    const highWO = high[0]
    console.log(`\n❌ HIGHEST (avoid for testing): ${highWO.id.substring(0, 8)}... [${highWO.complexity_score?.toFixed(2)}]`)
    console.log(`   ${highWO.title}`)
  }
}

findWOsByComplexity().catch(console.error)
