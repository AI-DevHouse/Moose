import { createSupabaseServiceClient } from '../src/lib/supabase'

const supabase = createSupabaseServiceClient()

const TEST_WO_IDS = [
  '0170420d-9562-4326-95a8-d70f675421a0', // WO-1: score 0.44 healthy
  'f491b9c5-4960-4c07-9ee4-1b271115d5cf', // WO-0: score 0.61 review
  '4e4c7480-6116-48ba-9fe8-9541cadec68e', // WO-8: score 0.68 review
  'eaf3596e-9e76-4a0a-8b5b-a929e26188dd', // WO-2: score 1.13 oversized
  'ca68150a-813a-43b4-8eea-c44eb18efc22', // WO-3: score 1.15 oversized
]

const scores = {
  '0170420d-9562-4326-95a8-d70f675421a0': 0.44,
  'f491b9c5-4960-4c07-9ee4-1b271115d5cf': 0.61,
  '4e4c7480-6116-48ba-9fe8-9541cadec68e': 0.68,
  'eaf3596e-9e76-4a0a-8b5b-a929e26188dd': 1.13,
  'ca68150a-813a-43b4-8eea-c44eb18efc22': 1.15,
}

async function checkDetailedStatus() {
  console.log('📊 Checking detailed status of 5 test WOs...\n')

  const { data, error } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata, github_pr_url, updated_at')
    .in('id', TEST_WO_IDS)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  const results: any[] = []

  data?.forEach((wo, idx) => {
    const complexityScore = scores[wo.id as keyof typeof scores]
    const meta = wo.metadata as any

    console.log(`\n${'='.repeat(80)}`)
    console.log(`${idx + 1}. ${wo.title}`)
    console.log(`   ID: ${wo.id}`)
    console.log(`   Complexity Score: ${complexityScore}`)
    console.log(`   Status: ${wo.status}`)
    console.log(`   Updated: ${wo.updated_at}`)

    if (wo.github_pr_url) {
      console.log(`   PR: ${wo.github_pr_url}`)
    }

    if (meta) {
      if (meta.acceptance_score !== undefined) {
        console.log(`   📈 Acceptance Score: ${meta.acceptance_score}`)
      }
      if (meta.refinement_cycles !== undefined) {
        console.log(`   🔄 Refinement Cycles: ${meta.refinement_cycles}`)
      }
      if (meta.total_cost !== undefined) {
        console.log(`   💰 Total Cost: $${meta.total_cost}`)
      }
      if (meta.proposer_used) {
        console.log(`   🤖 Proposer: ${meta.proposer_used}`)
      }

      // Check for orchestrator errors
      if (meta.orchestrator_error) {
        console.log(`   ❌ Error: ${meta.orchestrator_error.message}`)
        console.log(`      Stage: ${meta.orchestrator_error.stage}`)
      }
    }

    results.push({
      id: wo.id,
      title: wo.title,
      complexity_score: complexityScore,
      status: wo.status,
      acceptance_score: meta?.acceptance_score,
      refinement_cycles: meta?.refinement_cycles,
      total_cost: meta?.total_cost,
      proposer: meta?.proposer_used,
      has_pr: !!wo.github_pr_url,
    })
  })

  console.log(`\n${'='.repeat(80)}`)
  console.log('\n📊 Summary:')

  const statusCounts = results.reduce((acc: any, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  console.log(`Status distribution: ${JSON.stringify(statusCounts)}`)

  const withAcceptance = results.filter(r => r.acceptance_score !== undefined)
  console.log(`\nWOs with acceptance scores: ${withAcceptance.length} / 5`)

  if (withAcceptance.length > 0) {
    console.log('\nAcceptance scores:')
    withAcceptance.forEach(r => {
      console.log(`   ${r.complexity_score} (complexity) → ${r.acceptance_score} (acceptance)`)
    })
  }
}

checkDetailedStatus().catch(console.error)
