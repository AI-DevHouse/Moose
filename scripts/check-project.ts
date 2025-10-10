import { createSupabaseServiceClient } from '../src/lib/supabase'

async function checkProject() {
  const supabase = createSupabaseServiceClient()

  console.log('🔍 Checking project details...\n')

  // Get project info
  const projectId = 'fc607110-8fda-4c0c-a589-e8da1f47ab56'

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (projectError) {
    console.error('❌ Error fetching project:', projectError)
  } else {
    console.log('📦 Project Details:')
    console.log('   Name:', project.name)
    console.log('   Description:', project.description)
    console.log('   GitHub Repo:', project.github_repo_url || 'NOT SET')
    console.log('   Local Path:', project.local_path || 'NOT SET')
    console.log('   Status:', project.status)
    console.log()
  }

  // Check failed and in_progress work orders
  const { data: activeWOs, error: woError } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata, created_at')
    .in('status', ['failed', 'in_progress', 'completed'])
    .order('created_at', { ascending: false })
    .limit(5)

  if (woError) {
    console.error('❌ Error fetching work orders:', woError)
  } else {
    console.log('🔄 Non-pending Work Orders:')
    if (activeWOs.length === 0) {
      console.log('   None found')
    } else {
      activeWOs.forEach(wo => {
        console.log(`   [${wo.status}] ${wo.title}`)
        console.log(`      ID: ${wo.id}`)
        if (wo.metadata && typeof wo.metadata === 'object' && 'error' in wo.metadata) {
          const errorMsg = String((wo.metadata as any).error)
          console.log(`      Error: ${errorMsg.substring(0, 100)}...`)
        }
        console.log()
      })
    }
  }
}

checkProject().catch(console.error)
