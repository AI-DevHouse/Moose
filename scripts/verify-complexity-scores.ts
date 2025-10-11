// Verify complexity scores are preserved after clearing orchestrator data

import { createSupabaseServiceClient } from '../src/lib/supabase'

async function verifyComplexityScores() {
  const supabase = createSupabaseServiceClient()
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'

  console.log('\n🔍 VERIFYING COMPLEXITY SCORES\n')

  const { data: wos, error } = await supabase
    .from('work_orders')
    .select('id, title, status, complexity_score, metadata, github_pr_url, github_branch')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  if (!wos || wos.length === 0) {
    console.log('No work orders found')
    return
  }

  console.log(`Total Work Orders: ${wos.length}\n`)

  const withScores = wos.filter(wo => wo.complexity_score !== null)
  const withoutScores = wos.filter(wo => wo.complexity_score === null)
  const withGitHubData = wos.filter(wo => wo.github_pr_url || wo.github_branch)
  const withMetadata = wos.filter(wo => wo.metadata && Object.keys(wo.metadata).length > 0)
  const pending = wos.filter(wo => wo.status === 'pending')

  console.log('📊 Statistics:')
  console.log(`  ✅ With complexity scores: ${withScores.length}`)
  console.log(`  ❌ Without complexity scores: ${withoutScores.length}`)
  console.log(`  🔗 With GitHub data (should be 0): ${withGitHubData.length}`)
  console.log(`  📦 With metadata (should be 0): ${withMetadata.length}`)
  console.log(`  ⏸️  Pending status: ${pending.length}`)

  console.log('\n📋 Sample Work Orders with Complexity Scores:')
  withScores.slice(0, 10).forEach((wo, i) => {
    console.log(`  ${i + 1}. [${wo.complexity_score.toFixed(2)}] ${wo.title}`)
  })

  if (withGitHubData.length > 0) {
    console.log('\n⚠️  WARNING: Found WOs with GitHub data (should be cleared):')
    withGitHubData.forEach(wo => {
      console.log(`  - ${wo.title}`)
      if (wo.github_pr_url) console.log(`    PR URL: ${wo.github_pr_url}`)
      if (wo.github_branch) console.log(`    Branch: ${wo.github_branch}`)
    })
  }

  if (withMetadata.length > 0) {
    console.log('\n⚠️  WARNING: Found WOs with metadata (should be cleared):')
    withMetadata.forEach(wo => {
      console.log(`  - ${wo.title}`)
      console.log(`    Metadata keys: ${Object.keys(wo.metadata).join(', ')}`)
    })
  }

  console.log('\n✅ Verification complete!\n')
}

verifyComplexityScores().catch(console.error)
