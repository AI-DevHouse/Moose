// Diagnose where bootstrap WO execution is stuck

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('\n🔍 DIAGNOSING BOOTSTRAP WO EXECUTION\n');
  console.log('═'.repeat(80));

  // Get bootstrap WO details
  const { data: allWos } = await supabase
    .from('work_orders')
    .select('*');

  const bootstrapWO = allWos?.find(w => w.id.startsWith('14b6ea23'));

  if (!bootstrapWO) {
    console.log('❌ Bootstrap WO not found');
    return;
  }

  console.log(`\nWO-${bootstrapWO.id.substring(0, 8)}: ${bootstrapWO.title}`);
  console.log(`Status: ${bootstrapWO.status}`);
  console.log(`\nMetadata:`);
  console.log(JSON.stringify(bootstrapWO.metadata, null, 2));

  // Check if it has routing decision
  if (bootstrapWO.metadata?.manager_routing) {
    console.log('\n✅ Manager routing completed');
    console.log(`   Selected proposer: ${bootstrapWO.metadata.manager_routing.selected_proposer}`);
    console.log(`   Routed at: ${bootstrapWO.metadata.manager_routing.routed_at}`);
  } else {
    console.log('\n❌ No manager routing found - execution may not have started');
  }

  // Check execution details if available
  console.log(`\nProposer ID: ${bootstrapWO.proposer_id || 'Not set'}`);
  console.log(`GitHub PR URL: ${bootstrapWO.github_pr_url || 'Not created yet'}`);
  console.log(`GitHub branch: ${bootstrapWO.github_branch || 'Not created yet'}`);

  // Check timestamps
  console.log(`\nTimestamps:`);
  console.log(`  Created: ${new Date(bootstrapWO.created_at).toLocaleString()}`);
  console.log(`  Updated: ${new Date(bootstrapWO.updated_at).toLocaleString()}`);

  const now = new Date();
  const updated = new Date(bootstrapWO.updated_at);
  const minutesAgo = Math.floor((now.getTime() - updated.getTime()) / 1000 / 60);
  console.log(`  Last update: ${minutesAgo} minutes ago`);

  // Check project path
  console.log(`\nProject ID: ${bootstrapWO.project_id || 'Not set'}`);

  if (bootstrapWO.project_id) {
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', bootstrapWO.project_id)
      .single();

    if (project) {
      console.log(`Project name: ${project.name}`);
      console.log(`Local path: ${project.local_path}`);
    }
  }

  // Provide diagnosis
  console.log('\n' + '═'.repeat(80));
  console.log('\n🔍 DIAGNOSIS:\n');

  if (bootstrapWO.status === 'approved') {
    console.log('⚠️  WO is still "approved" - orchestrator hasn\'t picked it up yet');
    console.log('   → Check if orchestrator is running');
  } else if (bootstrapWO.status === 'in_progress') {
    if (bootstrapWO.github_branch) {
      console.log('✅ Aider completed (branch created)');
      console.log('   → Waiting for PR creation');
    } else if (bootstrapWO.metadata?.manager_routing) {
      const elapsed = minutesAgo;
      if (elapsed > 5) {
        console.log('⚠️  Execution started but stuck for ${elapsed} minutes');
        console.log('   → Likely stuck in Proposer or Aider phase');
        console.log('   → Check orchestrator console for errors');
      } else {
        console.log('⏳ Execution in progress (< 5 minutes)');
        console.log('   → Proposer generating code or Aider applying changes');
        console.log('   → Wait a bit longer');
      }
    } else {
      console.log('⚠️  WO is "in_progress" but no manager routing');
      console.log('   → Unusual state - may need manual intervention');
    }
  }

  console.log('');
}

main().catch(console.error);
