/**
 * Check Proposer Learning System Data
 *
 * Queries the proposer learning tables to verify Phase 1 & 2 are working:
 * - proposer_failures: All failure attempts and sampled successes
 * - proposer_success_metrics: Aggregated metrics by complexity band
 * - proposer_attempts: Rolling window of recent attempts
 */

import { createSupabaseServiceClient } from '../src/lib/supabase'

async function checkProposerLearning() {
  const supabase = createSupabaseServiceClient()

  console.log('\n🔍 Proposer Learning System - Data Check\n')
  console.log('='.repeat(80))

  // Query proposer_failures table
  console.log('\n📊 PROPOSER_FAILURES TABLE\n')
  const { data: failures, error: failuresError } = await supabase
    .from('proposer_failures' as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  if (failuresError) {
    console.error('❌ Error querying proposer_failures:', failuresError)
  } else if (!failures || failures.length === 0) {
    console.log('⚠️  No records found in proposer_failures table')
  } else {
    console.log(`✅ Found ${failures.length} records (showing latest 20):\n`)
    failures.forEach((f: any, i: number) => {
      console.log(`${i + 1}. ${f.created_at}`)
      console.log(`   Work Order: ${f.work_order_id?.substring(0, 8) || 'N/A'}`)
      console.log(`   Proposer: ${f.proposer_name}`)
      console.log(`   Complexity: ${f.complexity_score} (Band: ${f.complexity_band})`)
      console.log(`   Result: ${f.is_success ? 'SUCCESS' : 'FAILURE'} (Category: ${f.failure_category || 'N/A'})`)
      console.log(`   Refinement: ${f.refinement_count} cycles | Initial Errors: ${f.initial_errors}, Final: ${f.final_errors}`)
      if (f.sanitizer_changes && f.sanitizer_changes.length > 0) {
        console.log(`   Sanitizer: ${f.sanitizer_functions_triggered} functions, ${f.sanitizer_changes.length} changes`)
        console.log(`   Changes: ${f.sanitizer_changes.join(', ')}`)
      }
      console.log('')
    })
  }

  // Query proposer_success_metrics table
  console.log('='.repeat(80))
  console.log('\n📈 PROPOSER_SUCCESS_METRICS TABLE\n')
  const { data: metrics, error: metricsError } = await supabase
    .from('proposer_success_metrics' as any)
    .select('*')
    .order('complexity_band', { ascending: true })
    .limit(10)

  if (metricsError) {
    console.error('❌ Error querying proposer_success_metrics:', metricsError)
  } else if (!metrics || metrics.length === 0) {
    console.log('⚠️  No records found in proposer_success_metrics table')
  } else {
    console.log(`✅ Found ${metrics.length} metric records:\n`)
    metrics.forEach((m: any) => {
      console.log(`Proposer: ${m.proposer_name} | Band: ${m.complexity_band}`)
      console.log(`  Success Rate: ${(m.success_rate * 100).toFixed(1)}% (${m.total_attempts} attempts)`)
      console.log(`  Avg Cycles: ${m.avg_refinement_cycles.toFixed(2)} | Avg Errors: ${m.avg_final_errors.toFixed(2)}`)
      console.log(`  Last Updated: ${m.updated_at}`)
      console.log('')
    })
  }

  // Query proposer_attempts table
  console.log('='.repeat(80))
  console.log('\n🔄 PROPOSER_ATTEMPTS TABLE (Rolling Window)\n')
  const { data: attempts, error: attemptsError } = await supabase
    .from('proposer_attempts' as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (attemptsError) {
    console.error('❌ Error querying proposer_attempts:', attemptsError)
  } else if (!attempts || attempts.length === 0) {
    console.log('⚠️  No records found in proposer_attempts table')
  } else {
    console.log(`✅ Found ${attempts.length} recent attempts (showing latest 10):\n`)
    attempts.forEach((a: any, i: number) => {
      console.log(`${i + 1}. ${a.created_at} | ${a.proposer_name} | Band: ${a.complexity_band}`)
      console.log(`   Result: ${a.was_success ? 'SUCCESS' : 'FAILURE'} | Cycles: ${a.refinement_count} | Errors: ${a.final_errors}`)
    })
  }

  // Summary statistics
  console.log('\n' + '='.repeat(80))
  console.log('\n📋 SUMMARY\n')

  const totalFailures = failures?.length || 0
  const totalMetrics = metrics?.length || 0
  const totalAttempts = attempts?.length || 0

  console.log(`Total Failure Records: ${totalFailures}`)
  console.log(`Total Metric Records: ${totalMetrics}`)
  console.log(`Total Rolling Attempts: ${totalAttempts}`)

  if (totalFailures === 0 && totalMetrics === 0 && totalAttempts === 0) {
    console.log('\n⚠️  WARNING: No data found in any learning tables!')
    console.log('This could mean:')
    console.log('  1. No work orders have completed yet')
    console.log('  2. The logger is not being called')
    console.log('  3. There was an error during logging')
  } else {
    console.log('\n✅ Learning system is capturing data!')
  }

  console.log('\n' + '='.repeat(80))
  console.log('')
}

checkProposerLearning().catch(console.error)
