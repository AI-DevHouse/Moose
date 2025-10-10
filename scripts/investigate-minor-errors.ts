// Investigate minor errors (Aider and GitHub failures)
import { createSupabaseServiceClient } from '@/lib/supabase';

async function investigateErrors() {
  const supabase = createSupabaseServiceClient();

  // Get specific failed WOs
  const aiderFailureIds = ['178325e4', '826a8b13', 'ca68150a'];
  const githubFailureIds = ['d8d41cd4'];

  console.log('='.repeat(80));
  console.log('AIDER PROCESS FAILURES INVESTIGATION');
  console.log('='.repeat(80));

  for (const woIdPrefix of aiderFailureIds) {
    const { data: wos, error } = await supabase
      .from('work_orders')
      .select('*')
      .like('id', `${woIdPrefix}%`)
      .limit(1);

    if (error || !wos || wos.length === 0) {
      console.log(`\n❌ WO ${woIdPrefix} not found`);
      continue;
    }

    const wo = wos[0];
    const errorData = wo.metadata?.orchestrator_error;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`WO: ${wo.title}`);
    console.log(`ID: ${wo.id}`);
    console.log(`Status: ${wo.status}`);
    console.log(`\nError Details:`);
    console.log(`  Stage: ${errorData?.stage || 'N/A'}`);
    console.log(`  Class: ${errorData?.failure_class || 'unclassified'}`);
    console.log(`  Message: ${errorData?.message || 'N/A'}`);

    if (errorData?.error_context) {
      console.log(`\nError Context:`);
      console.log(JSON.stringify(errorData.error_context, null, 2));
    }

    // Check if there's aider execution metadata
    const aiderExec = wo.metadata?.aider_execution;
    if (aiderExec) {
      console.log(`\nAider Execution:`);
      console.log(JSON.stringify(aiderExec, null, 2));
    }

    // Check files in scope
    console.log(`\nFiles in Scope: ${wo.files_in_scope?.length || 0}`);
    if (wo.files_in_scope && wo.files_in_scope.length > 0) {
      wo.files_in_scope.slice(0, 3).forEach((f: string) => console.log(`  - ${f}`));
      if (wo.files_in_scope.length > 3) {
        console.log(`  ... and ${wo.files_in_scope.length - 3} more`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('GITHUB PR FAILURE INVESTIGATION');
  console.log('='.repeat(80));

  for (const woIdPrefix of githubFailureIds) {
    const { data: wos, error } = await supabase
      .from('work_orders')
      .select('*')
      .like('id', `${woIdPrefix}%`)
      .limit(1);

    if (error || !wos || wos.length === 0) {
      console.log(`\n❌ WO ${woIdPrefix} not found`);
      continue;
    }

    const wo = wos[0];
    const errorData = wo.metadata?.orchestrator_error;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`WO: ${wo.title}`);
    console.log(`ID: ${wo.id}`);
    console.log(`Status: ${wo.status}`);
    console.log(`\nError Details:`);
    console.log(`  Stage: ${errorData?.stage || 'N/A'}`);
    console.log(`  Class: ${errorData?.failure_class || 'unclassified'}`);
    console.log(`  Message: ${errorData?.message || 'N/A'}`);

    if (errorData?.error_context) {
      console.log(`\nError Context:`);
      console.log(JSON.stringify(errorData.error_context, null, 2));
    }

    // Check aider execution
    const aiderExec = wo.metadata?.aider_execution;
    if (aiderExec) {
      console.log(`\nAider Execution:`);
      console.log(JSON.stringify(aiderExec, null, 2));
    }

    // Check if branch was created
    console.log(`\nGitHub Branch: ${wo.github_branch || 'N/A'}`);
    console.log(`GitHub PR URL: ${wo.github_pr_url || 'N/A'}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('ANALYSIS & RECOMMENDATIONS');
  console.log('='.repeat(80));

  console.log(`
Aider Failures Pattern Analysis:

1. Git branch creation failure (178325e4):
   - Error: "Command failed: git checkout -b feature/wo-..."
   - Possible causes:
     * Branch already exists
     * Git working directory issues
     * Permission problems
   - Recommendation: Add branch cleanup/check logic

2. Aider null exit code (826a8b13, ca68150a):
   - Error: "Aider exited with code null"
   - Possible causes:
     * Process killed/interrupted
     * Timeout without proper exit
     * Signal termination
   - Recommendation: Add proper timeout handling and process monitoring

GitHub PR Failure (d8d41cd4):
   - Error: "Failed to create PR: Command failed: gh.exe"
   - Possible causes:
     * Authentication expired
     * Network timeout
     * Rate limiting
     * PR already exists
   - Recommendation: Add retry logic, better error parsing
  `);
}

investigateErrors().catch(console.error);
