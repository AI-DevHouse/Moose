import { createSupabaseServiceClient } from '../src/lib/supabase'

const supabase = createSupabaseServiceClient()

const TEST_WO_IDS = [
  '0170420d-9562-4326-95a8-d70f675421a0', // WO-1: score 0.44 healthy
  'f491b9c5-4960-4c07-9ee4-1b271115d5cf', // WO-0: score 0.61 review
  '4e4c7480-6116-48ba-9fe8-9541cadec68e', // WO-8: score 0.68 review
  'eaf3596e-9e76-4a0a-8b5b-a929e26188dd', // WO-2: score 1.13 oversized
  'ca68150a-813a-43b4-8eea-c44eb18efc22', // WO-3: score 1.15 oversized
]

async function checkFailureDetails() {
  console.log('🔍 Checking failure details for 5 test WOs...\n')

  const { data, error } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata, updated_at, github_pr_url, github_branch')
    .in('id', TEST_WO_IDS)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  const scores = {
    '0170420d-9562-4326-95a8-d70f675421a0': '0.44 healthy',
    'f491b9c5-4960-4c07-9ee4-1b271115d5cf': '0.61 review',
    '4e4c7480-6116-48ba-9fe8-9541cadec68e': '0.68 review',
    'eaf3596e-9e76-4a0a-8b5b-a929e26188dd': '1.13 oversized',
    'ca68150a-813a-43b4-8eea-c44eb18efc22': '1.15 oversized',
  }

  data?.forEach((wo, idx) => {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`${idx + 1}. ${wo.title}`)
    console.log(`   Complexity: ${scores[wo.id as keyof typeof scores]}`)
    console.log(`   Status: ${wo.status}`)
    console.log(`   Updated: ${wo.updated_at}`)
    if (wo.github_pr_url) console.log(`   PR: ${wo.github_pr_url}`)
    if (wo.github_branch) console.log(`   Branch: ${wo.github_branch}`)

    if (wo.metadata) {
      const meta = wo.metadata as any
      console.log(`\n   📋 Metadata:`)
      console.log(`   ${JSON.stringify(meta, null, 2)}`)
    }
  })

  console.log(`\n${'='.repeat(80)}`)
}

checkFailureDetails().catch(console.error)
