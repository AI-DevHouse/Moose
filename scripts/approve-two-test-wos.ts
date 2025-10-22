/**
 * Approve two specific work orders for testing
 * Low: Validation and Testing Suite (0.41)
 * Mid: Configure Redux Toolkit Store Foundation (0.55)
 */

import { createSupabaseServiceClient } from '../src/lib/supabase'

const WO_IDS = [
  '92a9c7c1-064c-40df-a4df-fe3c4d68d476', // Validation and Testing Suite (0.41 - lowest)
  '0170420d-9562-4326-95a8-d70f675421a0'  // Configure Redux Toolkit Store Foundation (0.55 - mid)
]

async function approveTwoTestWOs() {
  const supabase = createSupabaseServiceClient()

  console.log('🎯 Approving 2 test work orders...\n')

  for (const woId of WO_IDS) {
    const { data: wo, error } = await supabase
      .from('work_orders')
      .select('id, title, complexity_score')
      .eq('id', woId)
      .single()

    if (error || !wo) {
      console.error(`❌ Failed to find WO ${woId}:`, error)
      continue
    }

    const { error: updateError } = await supabase
      .from('work_orders')
      .update({ status: 'approved' })
      .eq('id', woId)

    if (updateError) {
      console.error(`❌ Failed to approve ${woId}:`, updateError)
    } else {
      console.log(`✅ [${wo.complexity_score?.toFixed(2)}] ${wo.title}`)
      console.log(`   ID: ${woId.substring(0, 8)}...\n`)
    }
  }

  console.log('✅ Ready for orchestrator execution')
  console.log('   Run: npm run orchestrator:daemon')
}

approveTwoTestWOs().catch(console.error)
