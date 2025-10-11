// Check what needs to be cleaned up in external systems (Supabase + GitHub)

import { createSupabaseServiceClient } from '../src/lib/supabase'
import { projectService } from '../src/lib/project-service'

async function checkExternalCleanup() {
  const supabase = createSupabaseServiceClient()

  console.log('\n🔍 CHECKING EXTERNAL CLEANUP NEEDS\n')
  console.log('=' .repeat(60))

  // Check Supabase state
  console.log('📊 SUPABASE DATABASE STATE:\n')

  const tables = [
    'work_orders',
    'outcome_vectors',
    'github_events',
    'escalations',
    'decision_logs',
    'cost_tracking'
  ]

  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })

    console.log(`  ${table}: ${count || 0} records`)
  }

  // Check for non-project work orders
  const { data: allWos, count: totalWos } = await supabase
    .from('work_orders')
    .select('id, title, project_id, status, created_at')
    .order('created_at', { ascending: true })

  console.log(`\n📋 WORK ORDERS BREAKDOWN:`)
  console.log(`  Total: ${totalWos || 0}`)

  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'
  const projectWos = allWos?.filter(wo => wo.project_id === projectId) || []
  const otherWos = allWos?.filter(wo => wo.project_id !== projectId) || []

  console.log(`  Project ${projectId.substring(0, 8)}: ${projectWos.length}`)
  console.log(`  Other projects: ${otherWos.length}`)

  if (otherWos.length > 0) {
    console.log(`\n  ⚠️  OTHER PROJECT WORK ORDERS:`)
    otherWos.forEach((wo, i) => {
      const projId = wo.project_id ? wo.project_id.substring(0, 8) : 'NULL'
      console.log(`    ${i + 1}. [${projId}] ${wo.title}`)
    })
  }

  // Check GitHub for the target project
  console.log(`\n🔗 GITHUB INTEGRATION CHECK:\n`)

  const project = await projectService.getProject(projectId)

  if (project) {
    console.log(`  Project: ${project.name}`)
    console.log(`  GitHub Org: ${project.github_org || 'N/A'}`)
    console.log(`  GitHub Repo: ${project.github_repo_name || 'N/A'}`)
    console.log(`  Local Path: ${project.local_path}`)

    if (project.github_org && project.github_repo_name) {
      const repo = `${project.github_org}/${project.github_repo_name}`
      console.log(`\n  Repository: ${repo}`)
      console.log(`  To check PRs: gh pr list --repo ${repo}`)
      console.log(`  To check branches: gh api repos/${repo}/branches`)
    } else {
      console.log(`\n  ⚠️  No GitHub repo configured`)
    }
  } else {
    console.log(`  ⚠️  Project not found`)
  }

  console.log('\n' + '=' .repeat(60))
  console.log('✅ Check complete\n')
}

checkExternalCleanup().catch(console.error)
