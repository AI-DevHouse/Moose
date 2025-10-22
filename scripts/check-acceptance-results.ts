/**
 * Check Acceptance Results
 *
 * Queries work_orders for acceptance validation results
 */

import { createSupabaseServiceClient } from '../src/lib/supabase'

async function checkAcceptanceResults() {
  console.log('🔍 Checking Acceptance Validation Results\n')
  console.log('=' .repeat(80))

  const supabase = createSupabaseServiceClient()

  // Get work orders with acceptance results
  const { data: wos, error } = await supabase
    .from('work_orders')
    .select('id, title, status, acceptance_result, github_pr_url, completed_at')
    .not('acceptance_result', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('❌ Error querying work orders:', error)
    return
  }

  if (!wos || wos.length === 0) {
    console.log('⚠️  No work orders with acceptance results found yet.')
    console.log('   Work orders may still be processing...')
    console.log('')

    // Check pending work orders
    const { data: pending } = await supabase
      .from('work_orders')
      .select('id, title, status')
      .in('status', ['pending', 'approved', 'in_progress'])
      .order('created_at', { ascending: true })
      .limit(10)

    if (pending && pending.length > 0) {
      console.log(`📋 Found ${pending.length} work orders in progress:`)
      pending.forEach((wo, i) => {
        console.log(`   ${i + 1}. [${wo.status}] ${wo.title.substring(0, 60)}...`)
      })
    }

    return
  }

  console.log(`✅ Found ${wos.length} work orders with acceptance results\n`)

  // Analyze each work order
  wos.forEach((wo, index) => {
    const acceptance = wo.acceptance_result as any
    const score = acceptance.acceptance_score
    const dims = acceptance.dimension_scores

    console.log(`${index + 1}. WO ${wo.id.slice(0, 8)} - ${wo.title.substring(0, 50)}`)
    console.log(`   Status: ${wo.status}`)
    console.log(`   Overall Score: ${score.toFixed(1)}/10`)
    console.log(`   Dimensions:`)
    console.log(`     - Architecture:   ${dims.architecture}/10`)
    console.log(`     - Readability:    ${dims.readability}/10`)
    console.log(`     - Completeness:   ${dims.completeness}/10`)
    console.log(`     - Test Coverage:  ${dims.test_coverage}/10`)
    console.log(`     - Build Success:  ${dims.build_success}/10`)
    console.log(`   Metrics:`)
    console.log(`     - Build Passed:   ${acceptance.build_passed}`)
    console.log(`     - Tests Passed:   ${acceptance.tests_passed}`)
    console.log(`     - TODOs:          ${acceptance.todo_count}`)
    console.log(`     - Lint Errors:    ${acceptance.lint_errors}`)
    console.log(`     - Test Coverage:  ${acceptance.test_coverage_percent.toFixed(1)}%`)
    if (wo.github_pr_url) {
      console.log(`   PR: ${wo.github_pr_url}`)
    }
    console.log('')
  })

  // Calculate statistics
  console.log('=' .repeat(80))
  console.log('\n📊 BASELINE STATISTICS\n')

  const scores = wos.map(wo => (wo.acceptance_result as any).acceptance_score)
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

  const dimStats = {
    architecture: wos.map(wo => (wo.acceptance_result as any).dimension_scores.architecture),
    readability: wos.map(wo => (wo.acceptance_result as any).dimension_scores.readability),
    completeness: wos.map(wo => (wo.acceptance_result as any).dimension_scores.completeness),
    test_coverage: wos.map(wo => (wo.acceptance_result as any).dimension_scores.test_coverage),
    build_success: wos.map(wo => (wo.acceptance_result as any).dimension_scores.build_success)
  }

  const calcAvg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length

  console.log(`Average Overall Score: ${avgScore.toFixed(2)}/10`)
  console.log('')
  console.log('Average Dimension Scores:')
  console.log(`  Architecture:   ${calcAvg(dimStats.architecture).toFixed(2)}/10`)
  console.log(`  Readability:    ${calcAvg(dimStats.readability).toFixed(2)}/10`)
  console.log(`  Completeness:   ${calcAvg(dimStats.completeness).toFixed(2)}/10`)
  console.log(`  Test Coverage:  ${calcAvg(dimStats.test_coverage).toFixed(2)}/10`)
  console.log(`  Build Success:  ${calcAvg(dimStats.build_success).toFixed(2)}/10`)
  console.log('')

  // Identify low-scoring dimensions
  const lowDims: string[] = []
  Object.entries(dimStats).forEach(([dim, scores]) => {
    const avg = calcAvg(scores)
    if (avg < 7) {
      lowDims.push(`${dim} (avg: ${avg.toFixed(1)})`)
    }
  })

  if (lowDims.length > 0) {
    console.log('⚠️  Low-Scoring Dimensions (avg < 7/10):')
    lowDims.forEach(dim => console.log(`   - ${dim}`))
    console.log('')
    console.log('💡 These dimensions should be targeted for Phase 3 delta enhancements')
  } else {
    console.log('✅ All dimensions scoring ≥7/10 average')
  }

  console.log('')
  console.log('=' .repeat(80))

  // Status distribution
  const statusCounts: Record<string, number> = {}
  wos.forEach(wo => {
    statusCounts[wo.status] = (statusCounts[wo.status] || 0) + 1
  })

  console.log('\n📋 Status Distribution:')
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   ${status}: ${count}`)
  })

  const needsReviewCount = statusCounts['needs_review'] || 0
  const completedCount = statusCounts['completed'] || 0
  const totalCount = needsReviewCount + completedCount

  if (totalCount > 0) {
    const passRate = (completedCount / totalCount * 100).toFixed(1)
    console.log(`\n   Pass Rate (≥7/10): ${passRate}%`)
  }

  console.log('')
}

checkAcceptanceResults().catch(console.error)
