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

async function checkMetrics() {
  console.log('📊 METRICS DETAIL ANALYSIS\n')
  console.log('='.repeat(80))

  const { data, error } = await supabase
    .from('work_orders')
    .select('id, title, acceptance_result')
    .in('id', TEST_WO_IDS)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  data?.forEach((wo, idx) => {
    const complexity = complexityScores[wo.id as keyof typeof complexityScores]
    const acceptanceResult = wo.acceptance_result as any

    console.log(`\n${idx + 1}. Complexity ${complexity.score} (${complexity.signal})`)
    console.log(`   ${wo.title.substring(0, 70)}`)

    if (acceptanceResult?.metrics) {
      const m = acceptanceResult.metrics
      console.log(`   Build:    ${m.build_passed ? '✅ PASS' : '❌ FAIL'}`)
      console.log(`   Tests:    ${m.tests_passed ? '✅ PASS' : '❌ FAIL'}`)
      console.log(`   Lint:     ${m.lint_errors || 0} errors`)
      console.log(`   TODOs:    ${m.todo_count || 0}`)
      console.log(`   Coverage: ${m.test_coverage || 0}%`)

      if (m.failure_message) {
        console.log(`   ⚠️  Failure: ${m.failure_message.substring(0, 100)}...`)
      }
    }
  })

  console.log('\n' + '='.repeat(80))
  console.log('\n💡 ANALYSIS\n')

  // Check if metrics show any patterns
  const buildResults = data?.map(wo => {
    const acc = wo.acceptance_result as any
    return {
      complexity: complexityScores[wo.id as keyof typeof complexityScores].score,
      buildPassed: acc?.metrics?.build_passed || false,
      testsPassed: acc?.metrics?.tests_passed || false,
      lintErrors: acc?.metrics?.lint_errors || 0,
    }
  })

  const anyBuildsPass = buildResults?.some(r => r.buildPassed)
  const anyTestsPass = buildResults?.some(r => r.testsPassed)

  console.log(`Build failures: ${buildResults?.filter(r => !r.buildPassed).length || 0} / 5`)
  console.log(`Test failures:  ${buildResults?.filter(r => !r.testsPassed).length || 0} / 5`)
  console.log(`\n${anyBuildsPass ? '✅' : '❌'} All builds failed - acceptance scoring invalid`)
  console.log(`${anyTestsPass ? '✅' : '⚠️ '} All tests failed/missing`)

  if (!anyBuildsPass) {
    console.log(`\n🚨 CRITICAL ISSUE: Project build is broken`)
    console.log(`   All WOs inherit a broken baseline`)
    console.log(`   Build success dimension = 0/10 for ALL WOs`)
    console.log(`   This masks true complexity-quality relationship`)
    console.log(`\n   Recommendation: Fix project build first, then retest`)
  }
}

checkMetrics().catch(console.error)
