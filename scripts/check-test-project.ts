import { createSupabaseServiceClient } from '../src/lib/supabase'

async function checkTestProject() {
  const supabase = createSupabaseServiceClient()
  const testProjectId = '06b35034-c877-49c7-b374-787d9415ea73'

  console.log('🔍 Checking test project...\n')

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', testProjectId)
    .single()

  if (error) {
    console.error('❌ Error:', error)
  } else {
    console.log('📦 Project Details:')
    console.log('   ID:', project.id)
    console.log('   Name:', project.name)
    console.log('   GitHub Repo Name:', project.github_repo_name || 'NOT SET')
    console.log('   GitHub Repo URL:', project.github_repo_url || 'NOT SET')
    console.log('   Local Path:', project.local_path)
    console.log('   Status:', project.status)
  }
}

checkTestProject().catch(console.error)
