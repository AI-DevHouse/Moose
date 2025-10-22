import { createSupabaseServiceClient } from '../src/lib/supabase'

const supabase = createSupabaseServiceClient()

// Historical WOs from analysis document (table on line 818-822)
const HISTORICAL_WO_IDS = [
  '92a9c7c1-064c-40df-a4df-fe3c4d68d476', // Validation Suite - 0.41 complexity → 78/100
  '0170420d-9562-4326-95a8-d70f675421a0', // Redux Store - 0.55 complexity → 58/100
  '787c6dd1-e0c4-490a-95af-a851e07996b1', // Clipboard Coord - 0.98 complexity → 44/100
]

async function compareScoring() {
  console.log('📊 COMPARING HISTORICAL vs CURRENT ACCEPTANCE SCORING\n')
  console.log('='.repeat(80))

  const { data, error } = await supabase
    .from('work_orders')
    .select('id, title, acceptance_result, created_at')
    .in('id', HISTORICAL_WO_IDS)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  const expectedScores = {
    '92a9c7c1-064c-40df-a4df-fe3c4d68d476': { complexity: 0.41, expectedScore: 78 },
    '0170420d-9562-4326-95a8-d70f675421a0': { complexity: 0.55, expectedScore: 58 },
    '787c6dd1-e0c4-490a-95af-a851e07996b1': { complexity: 0.98, expectedScore: 44 },
  }

  console.log('\nHistorical WOs (from analysis doc):')
  data?.forEach(wo => {
    const expected = expectedScores[wo.id as keyof typeof expectedScores]
    const acceptanceResult = wo.acceptance_result as any
    const actualScore = acceptanceResult?.acceptance_score
      ? acceptanceResult.acceptance_score * 10 // Convert 0-10 to 0-100
      : null

    console.log(`\n${wo.title.substring(0, 60)}`)
    console.log(`   Created: ${wo.created_at}`)
    console.log(`   Expected: ${expected.expectedScore}/100 (from analysis)`)
    console.log(`   Actual:   ${actualScore ? `${actualScore}/100` : 'NO SCORE'}`)

    if (actualScore) {
      const diff = actualScore - expected.expectedScore
      console.log(`   Delta:    ${diff > 0 ? '+' : ''}${diff}`)
    }

    if (acceptanceResult) {
      console.log(`   Structure:`)
      console.log(`      Has dimension_scores: ${!!acceptanceResult.dimension_scores}`)
      console.log(`      Has metrics: ${!!acceptanceResult.metrics}`)
      if (acceptanceResult.dimension_scores) {
        console.log(`      Dimensions: ${Object.keys(acceptanceResult.dimension_scores).join(', ')}`)
      }
    }
  })

  console.log('\n' + '='.repeat(80))
  console.log('\n🔍 ANALYSIS')

  // Check if these WOs have the OLD scoring (out of 100) or NEW scoring (out of 10)
  const hasOldScoring = data?.some(wo => {
    const ar = wo.acceptance_result as any
    return ar && ar.acceptance_score && ar.acceptance_score > 10
  })

  const hasNewScoring = data?.some(wo => {
    const ar = wo.acceptance_result as any
    return ar && ar.acceptance_score && ar.acceptance_score <= 10
  })

  console.log(`\nScoring format detected:`)
  console.log(`   Old scoring (0-100): ${hasOldScoring ? '✅ FOUND' : '❌ NOT FOUND'}`)
  console.log(`   New scoring (0-10):  ${hasNewScoring ? '✅ FOUND' : '❌ NOT FOUND'}`)

  if (!hasOldScoring && hasNewScoring) {
    console.log(`\n⚠️  DISCREPANCY: Analysis doc shows scores out of 100`)
    console.log(`   but database shows scores out of 10`)
    console.log(`   \nPossible causes:`)
    console.log(`   1. Acceptance validator was updated to use 0-10 scale`)
    console.log(`   2. Historical scores were from different validation method`)
    console.log(`   3. Historical scores were manually entered/estimated`)
  }
}

compareScoring().catch(console.error)
