import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') })

async function approve15ConcurrentWOs() {
  const supabase = createSupabaseServiceClient()

  console.log(`🔍 Fetching all pending work orders...\n`)

  // Get all pending work orders
  const { data: pendingWOs, error } = await supabase
    .from('work_orders')
    .select('id, title')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(15)

  if (error) {
    console.error('❌ Error fetching work orders:', error)
    return
  }

  if (!pendingWOs || pendingWOs.length === 0) {
    console.log('❌ No pending work orders found')
    return
  }

  console.log(`📋 Found ${pendingWOs.length} pending work orders`)
  console.log(`✅ Approving all ${pendingWOs.length}...\n`)

  let approved = 0
  for (const wo of pendingWOs) {
    const { error: approveError } = await supabase
      .from('work_orders')
      .update({ status: 'approved' })
      .eq('id', wo.id)

    if (approveError) {
      console.error(`❌ Error approving ${wo.id}:`, approveError)
      continue
    }

    approved++
    console.log(`${approved}. ✅ ${wo.id.substring(0, 8)}... - ${wo.title}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log(`✅ Successfully approved ${approved}/${pendingWOs.length} work orders`)
  console.log('='.repeat(60))
  console.log('\n🚀 Ready to start orchestrator!')
  console.log('   Run: npm run orchestrator')
  console.log('\n📊 Monitor worktree pool metrics:')
  console.log('   - Pool saturation (expect 15 worktrees leased)')
  console.log('   - Model capacity queueing (expect 5 WOs queued due to 10 Claude limit)')
  console.log('   - Zero branch contamination')
  console.log('   - Zero resource contention')
}

approve15ConcurrentWOs().catch(console.error)
