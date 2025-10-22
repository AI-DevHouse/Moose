import { createSupabaseServiceClient } from '../src/lib/supabase'

const supabase = createSupabaseServiceClient()

const TEST_WO_IDS = [
  '0170420d-9562-4326-95a8-d70f675421a0', // WO-1: score 0.44 healthy
  'f491b9c5-4960-4c07-9ee4-1b271115d5cf', // WO-0: score 0.61 review
  '4e4c7480-6116-48ba-9fe8-9541cadec68e', // WO-8: score 0.68 review
  'eaf3596e-9e76-4a0a-8b5b-a929e26188dd', // WO-2: score 1.13 oversized
  'ca68150a-813a-43b4-8eea-c44eb18efc22', // WO-3: score 1.15 oversized
]

async function approve5TestWOs() {
  console.log('🚀 Approving 5 test WOs for complexity validation...\n')

  for (const woId of TEST_WO_IDS) {
    const { data, error } = await supabase
      .from('work_orders')
      .update({ status: 'approved' })
      .eq('id', woId)
      .select('id, title, status')
      .single()

    if (error) {
      console.error(`❌ Error approving WO ${woId}:`, error)
    } else {
      console.log(`✅ Approved: ${data.title}`)
    }
  }

  console.log('\n✅ All 5 test WOs approved for execution')
  console.log('\nNext: Start orchestrator daemon to execute WOs')
  console.log('  npm run orchestrator:daemon')
}

approve5TestWOs().catch(console.error)
