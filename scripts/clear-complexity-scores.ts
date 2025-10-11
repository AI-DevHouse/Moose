// Clear complexity scores from all work orders
// Rolls back to the point BEFORE complexity scores were assigned

import { createSupabaseServiceClient } from '../src/lib/supabase'

async function clearComplexityScores() {
  const supabase = createSupabaseServiceClient()

  console.log('\n🔄 CLEARING COMPLEXITY SCORES')
  console.log('=' .repeat(60))
  console.log('Rolling back to state BEFORE complexity scores were assigned\n')

  try {
    // Step 1: Get current state
    console.log('📊 Current State:')

    const { data: wos, error: fetchError } = await supabase
      .from('work_orders')
      .select('id, title, complexity_score, status')
      .order('created_at', { ascending: true })

    if (fetchError) {
      console.error('❌ Error fetching work orders:', fetchError)
      throw fetchError
    }

    if (!wos || wos.length === 0) {
      console.log('No work orders found')
      return
    }

    const withScores = wos.filter(wo => wo.complexity_score !== null)
    const withoutScores = wos.filter(wo => wo.complexity_score === null)

    console.log(`  Total Work Orders: ${wos.length}`)
    console.log(`  With complexity scores: ${withScores.length}`)
    console.log(`  Without complexity scores: ${withoutScores.length}\n`)

    if (withScores.length === 0) {
      console.log('✅ No complexity scores to clear. Already at target state.\n')
      return
    }

    // Step 2: Clear complexity scores
    console.log(`🗑️  Clearing complexity scores from ${withScores.length} work orders...\n`)

    const { error: updateError, count: updated } = await supabase
      .from('work_orders')
      .update({
        complexity_score: null
      })
      .not('complexity_score', 'is', null)

    if (updateError) {
      console.error('❌ Error clearing complexity scores:', updateError)
      throw updateError
    }

    console.log(`  ✅ Cleared complexity scores from ${updated || withScores.length} work orders\n`)

    // Step 3: Verify final state
    console.log('✅ VERIFICATION - Final State:')

    const { data: finalWos, error: verifyError } = await supabase
      .from('work_orders')
      .select('id, title, complexity_score, status, metadata, github_pr_url')
      .order('created_at', { ascending: true })

    if (verifyError) {
      console.error('❌ Error verifying:', verifyError)
      throw verifyError
    }

    const finalWithScores = finalWos?.filter(wo => wo.complexity_score !== null) || []
    const finalPending = finalWos?.filter(wo => wo.status === 'pending') || []
    const finalWithGitHub = finalWos?.filter(wo => wo.github_pr_url) || []
    const finalWithMetadata = finalWos?.filter(wo => wo.metadata && Object.keys(wo.metadata).length > 0) || []

    console.log(`  Total Work Orders: ${finalWos?.length || 0}`)
    console.log(`  With complexity scores: ${finalWithScores.length} (should be 0)`)
    console.log(`  Pending status: ${finalPending.length} (should be ${finalWos?.length || 0})`)
    console.log(`  With GitHub data: ${finalWithGitHub.length} (should be 0)`)
    console.log(`  With metadata: ${finalWithMetadata.length} (should be 0)\n`)

    if (finalWithScores.length === 0 && finalPending.length === finalWos?.length) {
      console.log('✅ SUCCESS: Rolled back to pre-complexity-score state!')
      console.log('✅ All work orders have:')
      console.log('   - status = "pending"')
      console.log('   - complexity_score = NULL')
      console.log('   - No GitHub data')
      console.log('   - No execution metadata\n')
    } else {
      console.log('⚠️  WARNING: State may not be completely clean\n')

      if (finalWithScores.length > 0) {
        console.log('  Still have complexity scores:')
        finalWithScores.forEach(wo => {
          console.log(`    - [${wo.complexity_score}] ${wo.title}`)
        })
      }
    }

    // Show sample of work orders
    console.log('📋 Sample Work Orders (first 10):')
    finalWos?.slice(0, 10).forEach((wo, i) => {
      const score = wo.complexity_score ? wo.complexity_score.toFixed(2) : 'NULL'
      console.log(`  ${i + 1}. [${score}] ${wo.title}`)
    })
    console.log()

  } catch (error) {
    console.error('\n❌ ERROR:', error)
    throw error
  }
}

clearComplexityScores().catch(console.error)
