import { config } from 'dotenv'
import { resolve } from 'path'
import { createSupabaseServiceClient } from '../src/lib/supabase'

config({ path: resolve(__dirname, '../.env.local') })

async function showResults() {
  const supabase = createSupabaseServiceClient()

  // Get all WOs that are not pending, ordered by most recent
  const { data } = await supabase
    .from('work_orders')
    .select('id, title, status, pr_url, error_stage, acceptance_result, updated_at')
    .eq('project_id', 'f73e8c9f-1d78-4251-8fb6-a070fd857951')
    .in('status', ['needs_review', 'completed', 'failed', 'in_progress'])
    .order('updated_at', { ascending: false })
    .limit(10)

  if (!data || data.length === 0) {
    console.log('No recent executions found')
    return
  }

  console.log(`\n📊 Recent Work Order Results (${data.length} found)\n`)

  data.forEach((wo, i) => {
    const short = wo.id.substring(0, 8)
    const statusEmoji = wo.status === 'needs_review' || wo.status === 'completed' ? '✅' :
                        wo.status === 'failed' ? '❌' : '▶️'

    console.log(`${i + 1}. ${statusEmoji} ${short}... - ${wo.status}`)
    console.log(`   ${wo.title}`)

    if (wo.pr_url) {
      console.log(`   PR: ${wo.pr_url}`)
    }

    if (wo.acceptance_result?.acceptance_score) {
      const score = wo.acceptance_result.acceptance_score.toFixed(1)
      console.log(`   Acceptance: ${score}/10 (Arch: ${wo.acceptance_result.dimensions?.architecture}/10, Read: ${wo.acceptance_result.dimensions?.readability}/10, Complete: ${wo.acceptance_result.dimensions?.completeness}/10)`)
    }

    if (wo.error_stage) {
      console.log(`   Failed at: ${wo.error_stage}`)
    }

    console.log()
  })

  // Summary
  const successes = data.filter(wo => wo.status === 'needs_review' || wo.status === 'completed')
  const failures = data.filter(wo => wo.status === 'failed')

  console.log(`📈 Summary:`)
  console.log(`   ✅ Successful: ${successes.length}`)
  console.log(`   ❌ Failed: ${failures.length}`)
  console.log(`   Success Rate: ${Math.round(successes.length / (successes.length + failures.length) * 100)}%`)

  if (successes.length > 0) {
    const avgScore = successes.reduce((sum, wo) => sum + (wo.acceptance_result?.acceptance_score || 0), 0) / successes.length
    console.log(`   Avg Acceptance Score: ${avgScore.toFixed(1)}/10`)
  }
}

showResults().catch(console.error)
