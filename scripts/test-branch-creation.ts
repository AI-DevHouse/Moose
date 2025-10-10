import { createFeatureBranch } from '../src/lib/orchestrator/aider-executor'

async function testBranchCreation() {
  console.log('Testing createFeatureBranch with fixed git commands...\n')

  const testWorkOrder = {
    id: 'test-' + Date.now(),
    title: 'Test Branch Creation',
    description: 'Testing git branch creation',
    status: 'pending',
    risk_level: 'low',
    proposer_id: 'test',
    estimated_cost: 0,
    pattern_confidence: 0.5,
    acceptance_criteria: [],
    files_in_scope: [],
    context_budget_estimate: 1000,
    created_at: new Date().toISOString()
  }

  const workingDir = 'C:\\dev\\moose-mission-control'

  try {
    const branchName = await createFeatureBranch(testWorkOrder as any, workingDir)
    console.log('✅ Success! Branch created:', branchName)

    // Clean up: delete the test branch
    const { execSync } = await import('child_process')
    execSync(`git branch -D ${branchName}`, {
      cwd: workingDir,
      stdio: 'pipe',
      windowsHide: true
    })
    console.log('✅ Cleanup: Test branch deleted')
  } catch (error: any) {
    console.log('❌ Failed:', error.message)
  }
}

testBranchCreation().catch(console.error)
