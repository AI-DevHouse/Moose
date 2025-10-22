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

async function analyzeCorrelation() {
  console.log('📊 CORRELATION ANALYSIS: Complexity Score vs Acceptance Score\n')
  console.log('='.repeat(80))

  const { data, error } = await supabase
    .from('work_orders')
    .select('id, title, status, acceptance_result, github_pr_url, metadata')
    .in('id', TEST_WO_IDS)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  const results: any[] = []

  data?.forEach((wo) => {
    const complexity = complexityScores[wo.id as keyof typeof complexityScores]
    const acceptanceResult = wo.acceptance_result as any
    const meta = wo.metadata as any

    console.log(`\n${wo.title.substring(0, 60)}...`)
    console.log(`   ID: ${wo.id}`)
    console.log(`   Complexity: ${complexity.score} (${complexity.signal})`)
    console.log(`   Status: ${wo.status}`)
    console.log(`   PR: ${wo.github_pr_url ? '✅' : '❌'}`)

    if (acceptanceResult && acceptanceResult.acceptance_score !== undefined) {
      console.log(`   ✅ Acceptance Score: ${acceptanceResult.acceptance_score}/10`)

      results.push({
        id: wo.id,
        title: wo.title,
        complexity_score: complexity.score,
        complexity_signal: complexity.signal,
        acceptance_score: acceptanceResult.acceptance_score,
        status: wo.status,
      })
    } else {
      console.log(`   ❌ No acceptance result`)
    }

    if (meta?.orchestrator_error) {
      console.log(`   ⚠️  Error: ${meta.orchestrator_error.stage} - ${meta.orchestrator_error.message.substring(0, 50)}`)
    }
  })

  console.log('\n' + '='.repeat(80))
  console.log(`\n📈 RESULTS: ${results.length} / 5 WOs with acceptance scores\n`)

  if (results.length === 0) {
    console.log('❌ INSUFFICIENT DATA: No acceptance scores available')
    console.log('\nPossible reasons:')
    console.log('   1. Acceptance validation did not complete')
    console.log('   2. WOs failed before reaching validation stage')
    console.log('   3. Orchestrator errors prevented validation')
    return
  }

  // Sort by complexity score
  results.sort((a, b) => a.complexity_score - b.complexity_score)

  console.log('Data Points (Complexity → Acceptance):')
  results.forEach(r => {
    console.log(`   ${r.complexity_score.toFixed(2)} (${r.complexity_signal.padEnd(10)}) → ${r.acceptance_score.toFixed(1)}/10`)
  })

  if (results.length >= 3) {
    // Calculate Pearson correlation
    const n = results.length
    const sumX = results.reduce((sum, r) => sum + r.complexity_score, 0)
    const sumY = results.reduce((sum, r) => sum + r.acceptance_score, 0)
    const sumXY = results.reduce((sum, r) => sum + r.complexity_score * r.acceptance_score, 0)
    const sumX2 = results.reduce((sum, r) => sum + r.complexity_score ** 2, 0)
    const sumY2 = results.reduce((sum, r) => sum + r.acceptance_score ** 2, 0)

    const numerator = n * sumXY - sumX * sumY
    const denominator = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2))

    const r = numerator / denominator

    console.log(`\n${'='.repeat(80)}`)
    console.log('\n📊 CORRELATION ANALYSIS:')
    console.log(`   Pearson Correlation Coefficient (r): ${r.toFixed(3)}`)
    console.log(`   Sample Size: ${n}`)

    // Interpret correlation
    console.log(`\n   Interpretation:`)
    if (r < -0.80) {
      console.log(`   ✅ STRONG negative correlation (r < -0.80)`)
      console.log(`      Higher complexity → Lower acceptance (as expected)`)
    } else if (r < -0.60) {
      console.log(`   ⚠️  MODERATE negative correlation (-0.80 < r < -0.60)`)
      console.log(`      Trend present but weaker than target`)
    } else if (r < -0.30) {
      console.log(`   ⚠️  WEAK negative correlation (-0.60 < r < -0.30)`)
      console.log(`      Formula needs adjustment`)
    } else {
      console.log(`   ❌ NO meaningful negative correlation (r > -0.30)`)
      console.log(`      Formula is not predictive`)
    }

    // Decision gate
    console.log(`\n${'='.repeat(80)}`)
    console.log('\n🎯 DECISION GATE (V114 Task 2):')
    console.log(`   Target: r < -0.80 AND accuracy > 75%`)
    console.log(`   Current: r = ${r.toFixed(3)}`)

    if (r < -0.80) {
      console.log(`   ✅ GO: Strong correlation validates formula`)
      console.log(`      → Proceed to Task 3: Implement database logging`)
    } else if (r < -0.60) {
      console.log(`   ⚠️  ADJUST: Moderate correlation - consider formula tweaks`)
      console.log(`      → Review weight distribution before shadow deployment`)
    } else {
      console.log(`   ❌ STOP: Weak/no correlation - formula needs rework`)
      console.log(`      → Revisit complexity calculation weights`)
    }
  } else {
    console.log(`\n⚠️  WARNING: Only ${results.length} data points`)
    console.log(`   Need at least 3 points for correlation analysis`)
    console.log(`   Current data insufficient for statistical validation`)
  }

  console.log(`\n${'='.repeat(80)}`)
}

analyzeCorrelation().catch(console.error)
