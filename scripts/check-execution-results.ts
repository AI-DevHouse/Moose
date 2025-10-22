import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

config({ path: resolve(__dirname, '../.env.local') })

async function checkResults() {
  const supabase = createSupabaseServiceClient()

  const woId = '787c6dd1-e0c4-490a-95af-a851e07996b1' // Clipboard Coordination WO

  console.log('🔍 Investigating WO Status Discrepancy...\n')
  console.log('='.repeat(100))

  const { data: wo, error } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', woId)
    .single()

  if (error) {
    console.error('❌ Database Error:', error)
    return
  }

  console.log(`\n📋 WORK ORDER: ${wo.title}`)
  console.log(`ID: ${woId}\n`)

  // Status information
  console.log('📊 STATUS INFORMATION:')
  console.log(`   Current Status: ${wo.status}`)
  console.log(`   Assigned To: ${wo.assigned_to || 'None'}`)
  console.log(`   Created: ${wo.created_at}`)
  console.log(`   Started: ${wo.started_at || 'Not started'}`)
  console.log(`   Completed: ${wo.completed_at || 'Not completed'}`)
  console.log(`   Updated: ${wo.updated_at || 'N/A'}\n`)

  // GitHub information
  console.log('🔗 GITHUB INFORMATION:')
  console.log(`   PR URL: ${wo.github_pr_url || 'None'}`)
  console.log(`   Branch: ${wo.branch_name || 'None'}\n`)

  // Result field
  console.log('📊 RESULT FIELD:')
  if (wo.result) {
    console.log(JSON.stringify(wo.result, null, 2))
  } else {
    console.log('   (empty)\n')
  }

  // Execution metadata
  console.log('🔍 EXECUTION METADATA:')
  if (wo.execution_metadata) {
    console.log(JSON.stringify(wo.execution_metadata, null, 2))
  } else {
    console.log('   (empty)\n')
  }

  // Error field
  console.log('❌ ERROR FIELD:')
  if (wo.error) {
    console.log(JSON.stringify(wo.error, null, 2))
  } else {
    console.log('   (empty)\n')
  }

  // Metadata field
  console.log('📝 METADATA FIELD:')
  if (wo.metadata) {
    console.log(JSON.stringify(wo.metadata, null, 2))
  } else {
    console.log('   (empty)\n')
  }

  console.log('='.repeat(100))

  // Analysis
  console.log('\n🤔 ANALYSIS:\n')

  if (wo.status === 'in_progress' && wo.github_pr_url) {
    console.log('⚠️  ANOMALY DETECTED:')
    console.log('   - Status is "in_progress"')
    console.log('   - But PR URL exists, suggesting execution occurred')
    console.log('   - This may indicate:')
    console.log('     1. Execution finished but status not updated')
    console.log('     2. Execution failed mid-way after creating PR')
    console.log('     3. Status update transaction failed\n')
  }

  if (wo.completed_at && wo.status === 'in_progress') {
    console.log('⚠️  CRITICAL INCONSISTENCY:')
    console.log('   - completed_at is set but status is still in_progress')
    console.log('   - This is a data integrity issue\n')
  }

  if (wo.result?.success === false || wo.error) {
    console.log('❌ EXECUTION FAILED:')
    console.log('   Check the error and result fields above for details\n')
  }

  if (!wo.started_at && wo.status === 'in_progress') {
    console.log('⚠️  STALE STATUS:')
    console.log('   - Status is in_progress but started_at is null')
    console.log('   - WO may be stuck in transition state\n')
  }

  // Recommendation
  console.log('💡 RECOMMENDATION:')
  if (wo.github_pr_url) {
    console.log(`   Check the PR for actual code: ${wo.github_pr_url}`)
    console.log('   If code exists, status should be "completed" or "failed"')
    console.log('   If no code exists, PR may have been created but execution failed\n')
  }

  const { data } = await supabase
    .from('work_orders')
    .select('id, title, status, github_pr_url, error_stage, error_message, acceptance_result')
    .eq('id', woId)

  console.log('📊 WO Execution Results:\n')
  console.log(`Total WOs queried: ${data?.length || 0}\n`)

  // Show all statuses
  console.log('Status breakdown:')
  const statusCounts: Record<string, number> = {}
  data?.forEach(wo => {
    statusCounts[wo.status] = (statusCounts[wo.status] || 0) + 1
  })
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`)
  })
  console.log()

  const successes = data?.filter(wo => wo.status === 'needs_review' || wo.status === 'completed') || []
  const failures = data?.filter(wo => wo.status === 'failed') || []
  const inProgress = data?.filter(wo => wo.status === 'in_progress') || []

  console.log(`✅ Successful: ${successes.length}/6`)
  successes.forEach(wo => {
    const short = wo.id.substring(0, 8)
    const score = wo.acceptance_result?.acceptance_score?.toFixed(1) || 'N/A'
    console.log(`  ${short}... - ${wo.title}`)
    console.log(`    Status: ${wo.status} | Score: ${score}/10`)
    if (wo.pr_url) console.log(`    PR: ${wo.pr_url}`)
    console.log()
  })

  console.log(`\n❌ Failed: ${failures.length}/6`)
  failures.forEach(wo => {
    const short = wo.id.substring(0, 8)
    console.log(`  ${short}... - ${wo.title}`)
    console.log(`    Failed at: ${wo.error_stage}`)
    console.log(`    Error: ${wo.error_message?.substring(0, 120)}...`)
    console.log()
  })

  console.log(`\n📈 Summary:`)
  console.log(`   Success Rate: ${Math.round(successes.length / 6 * 100)}%`)
  console.log(`   Avg Acceptance Score: ${(successes.reduce((sum, wo) => sum + (wo.acceptance_result?.acceptance_score || 0), 0) / successes.length).toFixed(1)}/10`)
}

checkResults().catch(console.error)
