import { createSupabaseServiceClient } from '../src/lib/supabase'

async function setupTest() {
  const supabase = createSupabaseServiceClient()

  console.log('🧪 Setting up test project and work order...\n')

  // Step 1: Create test project for moose-mission-control
  const projectData = {
    name: 'moose-mission-control-test',
    description: 'Test project for validating E2E orchestration pipeline',
    local_path: 'C:\\dev\\moose-mission-control',
    github_repo_url: 'https://github.com/AI-DevHouse/Moose.git',
    github_org: 'AI-DevHouse',
    github_repo_name: 'Moose',
    default_branch: 'main',
    status: 'active',
    git_initialized: true
  }

  console.log('📦 Creating test project...')
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert(projectData)
    .select()
    .single()

  if (projectError) {
    console.error('❌ Error creating project:', projectError)
    process.exit(1)
  }

  console.log('✅ Project created:', project.id)
  console.log('   Name:', project.name)
  console.log('   Path:', project.local_path)
  console.log()

  // Step 2: Create a low-risk work order
  const workOrderData = {
    title: 'Add test comment to README',
    description: `Add a comment to the README.md file:

<!-- Test orchestration pipeline - ${new Date().toISOString()} -->

This is a low-risk test to validate the end-to-end execution pipeline.`,
    project_id: project.id,
    risk_level: 'low',
    status: 'approved', // Pre-approve for testing
    proposer_id: 'a40c5caf-b0fb-4a8b-a544-ca82bb2ab939', // Default proposer
    estimated_cost: 0.05,
    pattern_confidence: 0.9,
    acceptance_criteria: [
      'README.md contains the test comment',
      'Comment is properly formatted as HTML comment',
      'No other files are modified'
    ],
    files_in_scope: ['README.md'],
    context_budget_estimate: 1000
  }

  console.log('📝 Creating work order...')
  const { data: workOrder, error: woError } = await supabase
    .from('work_orders')
    .insert(workOrderData)
    .select()
    .single()

  if (woError) {
    console.error('❌ Error creating work order:', woError)
    process.exit(1)
  }

  console.log('✅ Work order created:', workOrder.id)
  console.log('   Title:', workOrder.title)
  console.log('   Status:', workOrder.status)
  console.log('   Risk:', workOrder.risk_level)
  console.log()

  console.log('🎯 Test setup complete!')
  console.log()
  console.log('Next steps:')
  console.log('1. Update GitHub repo URL in the project (use correct repo)')
  console.log('2. Run: npm run orchestrator')
  console.log('3. Watch for work order execution')
  console.log()
  console.log('Work Order ID:', workOrder.id)
  console.log('Project ID:', project.id)
}

setupTest().catch(console.error)
