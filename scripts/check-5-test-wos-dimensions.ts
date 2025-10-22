import { createSupabaseServiceClient } from '../src/lib/supabase'

const supabase = createSupabaseServiceClient()

const TEST_WO_IDS = [
  '0170420d-9562-4326-95a8-d70f675421a0', // WO-1: score 0.44 healthy
  'f491b9c5-4960-4c07-9ee4-1b271115d5cf', // WO-0: score 0.61 review
  '4e4c7480-6116-48ba-9fe8-9541cadec68e', // WO-8: score 0.68 review
  'eaf3596e-9e76-4a0a-8b5b-a929e26188dd', // WO-2: score 1.13 oversized
  'ca68150a-813a-43b4-8eea-c44eb18efc22', // WO-3: score 1.15 oversized
]

const complexityScores = {
  '0170420d-9562-4326-95a8-d70f675421a0': { score: 0.44, signal: 'healthy' },
  'f491b9c5-4960-4c07-9ee4-1b271115d5cf': { score: 0.61, signal: 'review' },
  '4e4c7480-6116-48ba-9fe8-9541cadec68e': { score: 0.68, signal: 'review' },
  'eaf3596e-9e76-4a0a-8b5b-a929e26188dd': { score: 1.13, signal: 'oversized' },
  'ca68150a-813a-43b4-8eea-c44eb18efc22': { score: 1.15, signal: 'oversized' },
}

async function checkDimensionalBreakdown() {
  console.log('📊 DETAILED DIMENSIONAL ANALYSIS: 5 Test WOs\n')
  console.log('='.repeat(80))

  const { data, error } = await supabase
    .from('work_orders')
    .select('id, title, acceptance_result, github_pr_url')
    .in('id', TEST_WO_IDS)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  const dimensionAverages: any = {}
  const results: any[] = []

  data?.forEach((wo, idx) => {
    const complexity = complexityScores[wo.id as keyof typeof complexityScores]
    const acceptanceResult = wo.acceptance_result as any

    console.log(`\n${idx + 1}. ${wo.title.substring(0, 60)}...`)
    console.log(`   Complexity: ${complexity.score} (${complexity.signal})`)
    console.log(`   PR: ${wo.github_pr_url}`)

    if (acceptanceResult) {
      console.log(`   Overall Acceptance: ${acceptanceResult.acceptance_score}/10`)

      if (acceptanceResult.dimension_scores) {
        console.log(`\n   📊 Dimensional Scores:`)
        Object.entries(acceptanceResult.dimension_scores).forEach(([dim, score]) => {
          console.log(`      ${dim.padEnd(20)}: ${score}/10`)

          if (!dimensionAverages[dim]) {
            dimensionAverages[dim] = []
          }
          dimensionAverages[dim].push({ complexity: complexity.score, score: score as number })
        })
      }

      if (acceptanceResult.metrics) {
        console.log(`\n   🔍 Metrics:`)
        const metrics = acceptanceResult.metrics
        console.log(`      Build Passed:    ${metrics.build_passed ? '✅' : '❌'}`)
        console.log(`      Tests Passed:    ${metrics.tests_passed ? '✅' : '❌'}`)
        console.log(`      Lint Errors:     ${metrics.lint_errors || 0}`)
        console.log(`      TODOs:           ${metrics.todo_count || 0}`)
        console.log(`      Test Coverage:   ${metrics.test_coverage || 0}%`)
      }

      results.push({
        id: wo.id,
        title: wo.title,
        complexity_score: complexity.score,
        complexity_signal: complexity.signal,
        acceptance_score: acceptanceResult.acceptance_score,
        dimension_scores: acceptanceResult.dimension_scores,
        metrics: acceptanceResult.metrics,
      })
    } else {
      console.log(`   ❌ No acceptance result`)
    }
  })

  console.log('\n' + '='.repeat(80))
  console.log('\n📈 DIMENSIONAL AVERAGES & CORRELATION\n')

  // Calculate averages and correlations for each dimension
  Object.entries(dimensionAverages).forEach(([dim, dataPoints]: [string, any]) => {
    const avgScore = dataPoints.reduce((sum: number, dp: any) => sum + dp.score, 0) / dataPoints.length

    // Calculate Pearson correlation for this dimension
    const n = dataPoints.length
    const sumX = dataPoints.reduce((sum: number, dp: any) => sum + dp.complexity, 0)
    const sumY = dataPoints.reduce((sum: number, dp: any) => sum + dp.score, 0)
    const sumXY = dataPoints.reduce((sum: number, dp: any) => sum + dp.complexity * dp.score, 0)
    const sumX2 = dataPoints.reduce((sum: number, dp: any) => sum + dp.complexity ** 2, 0)
    const sumY2 = dataPoints.reduce((sum: number, dp: any) => sum + dp.score ** 2, 0)

    const numerator = n * sumXY - sumX * sumY
    const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2))
    const r = denominator === 0 ? 0 : numerator / denominator

    const correlationSign = r < -0.5 ? '✅ Negative' : r > 0.5 ? '❌ Positive' : '⚠️  Weak'

    console.log(`${dim.padEnd(20)}: avg ${avgScore.toFixed(1)}/10, r=${r.toFixed(3)} ${correlationSign}`)
  })

  console.log('\n' + '='.repeat(80))
  console.log('\n🔍 KEY INSIGHTS\n')

  // Identify failing dimensions
  const failingDims = Object.entries(dimensionAverages)
    .filter(([dim, dataPoints]: [string, any]) => {
      const avg = dataPoints.reduce((sum: number, dp: any) => sum + dp.score, 0) / dataPoints.length
      return avg < 5
    })
    .map(([dim]) => dim)

  console.log(`Consistently failing dimensions (avg < 5/10):`)
  failingDims.forEach(dim => console.log(`   - ${dim}`))

  // Check metrics patterns
  const allBuildsFailed = results.every(r => r.metrics?.build_passed === false)
  const allNoCoverage = results.every(r => (r.metrics?.test_coverage || 0) === 0)

  console.log(`\n📊 Metrics Patterns:`)
  console.log(`   All builds failed: ${allBuildsFailed ? '✅ YES' : '❌ NO'}`)
  console.log(`   All zero coverage: ${allNoCoverage ? '✅ YES' : '❌ NO'}`)

  if (allBuildsFailed) {
    console.log(`\n⚠️  WARNING: All WOs failed build - this artificially lowers all scores!`)
    console.log(`   Build failures may be masking true complexity correlation.`)
  }
}

checkDimensionalBreakdown().catch(console.error)
