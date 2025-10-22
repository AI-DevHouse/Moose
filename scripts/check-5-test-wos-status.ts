import { createSupabaseServiceClient } from '../src/lib/supabase'

const supabase = createSupabaseServiceClient()

const TEST_WO_IDS = [
  '0170420d-9562-4326-95a8-d70f675421a0', // WO-1: score 0.44 healthy
  'f491b9c5-4960-4c07-9ee4-1b271115d5cf', // WO-0: score 0.61 review
  '4e4c7480-6116-48ba-9fe8-9541cadec68e', // WO-8: score 0.68 review
  'eaf3596e-9e76-4a0a-8b5b-a929e26188dd', // WO-2: score 1.13 oversized
  'ca68150a-813a-43b4-8eea-c44eb18efc22', // WO-3: score 1.15 oversized
]

async function checkTestWOsStatus() {
  console.log('📊 Checking status of 5 test WOs...\n')

  const { data, error } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata')
    .in('id', TEST_WO_IDS)
    .order('id')

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  data?.forEach((wo, idx) => {
    const scores = {
      '0170420d-9562-4326-95a8-d70f675421a0': '0.44 healthy',
      'f491b9c5-4960-4c07-9ee4-1b271115d5cf': '0.61 review',
      '4e4c7480-6116-48ba-9fe8-9541cadec68e': '0.68 review',
      'eaf3596e-9e76-4a0a-8b5b-a929e26188dd': '1.13 oversized',
      'ca68150a-813a-43b4-8eea-c44eb18efc22': '1.15 oversized',
    }
    console.log(`\n${idx + 1}. ${wo.title}`)
    console.log(`   Complexity: ${scores[wo.id as keyof typeof scores]}`)
    console.log(`   Status: ${wo.status}`)
    if (wo.metadata) {
      const meta = wo.metadata as any
      if (meta.acceptance_score) console.log(`   Acceptance Score: ${meta.acceptance_score}`)
      if (meta.refinement_cycles) console.log(`   Refinement Cycles: ${meta.refinement_cycles}`)
    }
  })

  console.log('\n' + '='.repeat(80))
  const statusCounts = data?.reduce((acc: any, wo) => {
    acc[wo.status] = (acc[wo.status] || 0) + 1
    return acc
  }, {})
  console.log('Status summary:', statusCounts)
}

checkTestWOsStatus().catch(console.error)
