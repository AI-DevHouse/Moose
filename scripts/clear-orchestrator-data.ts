// Clear all orchestrator execution data and reset WOs to post-complexity-score state
// This preserves WOs with their complexity scores but clears all execution history

import { createSupabaseServiceClient } from '../src/lib/supabase'

async function clearOrchestratorData() {
  const supabase = createSupabaseServiceClient()

  console.log('\n🧹 CLEARING ORCHESTRATOR EXECUTION DATA')
  console.log('=' .repeat(60))
  console.log('This will:')
  console.log('  ✓ Preserve all work orders (title, description, complexity_score, etc.)')
  console.log('  ✓ Reset WO status to "pending"')
  console.log('  ✓ Clear orchestrator execution metadata')
  console.log('  ✗ Delete all outcome_vectors')
  console.log('  ✗ Delete all github_events')
  console.log('  ✗ Delete all escalations')
  console.log('  ✗ Delete all decision_logs')
  console.log('  ✗ Delete all cost_tracking\n')

  try {
    // Step 1: Get current counts
    console.log('📊 Current Database State:')

    const { count: woCount } = await supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true })

    const { count: ovCount } = await supabase
      .from('outcome_vectors')
      .select('*', { count: 'exact', head: true })

    const { count: geCount } = await supabase
      .from('github_events')
      .select('*', { count: 'exact', head: true })

    const { count: escCount } = await supabase
      .from('escalations')
      .select('*', { count: 'exact', head: true })

    const { count: dlCount } = await supabase
      .from('decision_logs')
      .select('*', { count: 'exact', head: true })

    const { count: ctCount } = await supabase
      .from('cost_tracking')
      .select('*', { count: 'exact', head: true })

    console.log(`  Work Orders: ${woCount}`)
    console.log(`  Outcome Vectors: ${ovCount}`)
    console.log(`  GitHub Events: ${geCount}`)
    console.log(`  Escalations: ${escCount}`)
    console.log(`  Decision Logs: ${dlCount}`)
    console.log(`  Cost Tracking: ${ctCount}\n`)

    // Step 2: Delete execution data tables (in correct order due to foreign keys)
    console.log('🗑️  Deleting execution data...\n')

    // Delete outcome_vectors
    const { error: ovError, count: ovDeleted } = await supabase
      .from('outcome_vectors')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (ovError) {
      console.error('❌ Error deleting outcome_vectors:', ovError)
    } else {
      console.log(`  ✅ Deleted ${ovDeleted || ovCount} outcome_vectors`)
    }

    // Delete github_events
    const { error: geError, count: geDeleted } = await supabase
      .from('github_events')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (geError) {
      console.error('❌ Error deleting github_events:', geError)
    } else {
      console.log(`  ✅ Deleted ${geDeleted || geCount} github_events`)
    }

    // Delete escalations
    const { error: escError, count: escDeleted } = await supabase
      .from('escalations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (escError) {
      console.error('❌ Error deleting escalations:', escError)
    } else {
      console.log(`  ✅ Deleted ${escDeleted || escCount} escalations`)
    }

    // Delete decision_logs
    const { error: dlError, count: dlDeleted } = await supabase
      .from('decision_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (dlError) {
      console.error('❌ Error deleting decision_logs:', dlError)
    } else {
      console.log(`  ✅ Deleted ${dlDeleted || dlCount} decision_logs`)
    }

    // Delete cost_tracking
    const { error: ctError, count: ctDeleted } = await supabase
      .from('cost_tracking')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (ctError) {
      console.error('❌ Error deleting cost_tracking:', ctError)
    } else {
      console.log(`  ✅ Deleted ${ctDeleted || ctCount} cost_tracking`)
    }

    // Step 3: Reset work_orders to post-complexity-score state
    console.log('\n🔄 Resetting work orders to pending state...\n')

    const { data: wos, error: woFetchError } = await supabase
      .from('work_orders')
      .select('id, title, status, complexity_score')
      .order('created_at', { ascending: true })

    if (woFetchError) {
      console.error('❌ Error fetching work orders:', woFetchError)
      throw woFetchError
    }

    if (wos && wos.length > 0) {
      console.log(`Found ${wos.length} work orders to reset\n`)

      // Reset all WOs to pending with cleared execution data
      const { error: woUpdateError, count: woUpdated } = await supabase
        .from('work_orders')
        .update({
          status: 'pending',
          github_pr_number: null,
          github_pr_url: null,
          github_branch: null,
          actual_cost: null,
          completed_at: null,
          metadata: {} // Clear all metadata (orchestrator execution data)
        })
        .neq('id', '00000000-0000-0000-0000-000000000000') // Update all

      if (woUpdateError) {
        console.error('❌ Error updating work orders:', woUpdateError)
        throw woUpdateError
      }

      console.log(`  ✅ Reset ${woUpdated || wos.length} work orders to pending\n`)

      // Show summary of reset WOs
      console.log('📋 Reset Work Orders (with complexity scores):')
      wos.forEach((wo, i) => {
        const score = wo.complexity_score ? wo.complexity_score.toFixed(2) : 'N/A'
        console.log(`  ${i + 1}. [${score}] ${wo.title}`)
      })
    } else {
      console.log('No work orders found')
    }

    // Step 4: Verify final state
    console.log('\n✅ VERIFICATION - Final Database State:')

    const { count: woCountFinal } = await supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true })

    const { count: ovCountFinal } = await supabase
      .from('outcome_vectors')
      .select('*', { count: 'exact', head: true })

    const { count: geCountFinal } = await supabase
      .from('github_events')
      .select('*', { count: 'exact', head: true })

    const { count: escCountFinal } = await supabase
      .from('escalations')
      .select('*', { count: 'exact', head: true })

    const { count: dlCountFinal } = await supabase
      .from('decision_logs')
      .select('*', { count: 'exact', head: true })

    const { count: ctCountFinal } = await supabase
      .from('cost_tracking')
      .select('*', { count: 'exact', head: true })

    const { count: woPending } = await supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    console.log(`  Work Orders: ${woCountFinal} (${woPending} pending)`)
    console.log(`  Outcome Vectors: ${ovCountFinal}`)
    console.log(`  GitHub Events: ${geCountFinal}`)
    console.log(`  Escalations: ${escCountFinal}`)
    console.log(`  Decision Logs: ${dlCountFinal}`)
    console.log(`  Cost Tracking: ${ctCountFinal}\n`)

    if (ovCountFinal === 0 && geCountFinal === 0 && escCountFinal === 0 &&
        dlCountFinal === 0 && ctCountFinal === 0 && woPending === woCountFinal) {
      console.log('✅ SUCCESS: All orchestrator data cleared!')
      console.log('✅ All work orders reset to pending state')
      console.log('✅ Complexity scores preserved\n')
    } else {
      console.log('⚠️  WARNING: Some data may not have been cleared completely\n')
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error)
    throw error
  }
}

clearOrchestratorData().catch(console.error)
