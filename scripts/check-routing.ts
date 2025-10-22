import { createSupabaseServiceClient } from '../src/lib/supabase';

async function checkRouting() {
  const supabase = createSupabaseServiceClient();
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951';

  // Get proposer configs
  const { data: proposers } = await supabase
    .from('proposer_configs')
    .select('*')
    .eq('active', true)
    .order('complexity_threshold', { ascending: true });

  console.log('\n📊 Active Proposer Configs (sorted by complexity threshold):\n');
  proposers?.forEach(p => {
    console.log(`- ${p.name}`);
    console.log(`  Model: ${p.model}`);
    console.log(`  Provider: ${p.provider}`);
    console.log(`  Complexity Threshold: ${p.complexity_threshold}`);
    console.log('');
  });

  // Get the 5 approved WOs and their complexity scores
  const { data: wos } = await supabase
    .from('work_orders')
    .select('title, complexity_score, metadata')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5);

  console.log('\n🎯 Phase 1 Work Orders:\n');
  wos?.forEach((wo, i) => {
    const approved = wo.metadata?.auto_approved === true;
    const complexity = wo.complexity_score || 0;

    // Determine which proposer would be selected
    let selectedProposer = proposers?.[proposers.length - 1]; // Default to highest threshold
    for (const proposer of proposers || []) {
      if (complexity <= proposer.complexity_threshold) {
        selectedProposer = proposer;
        break;
      }
    }

    console.log(`${i+1}. ${wo.title}`);
    console.log(`   Complexity: ${complexity}`);
    console.log(`   Approved: ${approved ? '✅' : '❌'}`);
    console.log(`   → Will use: ${selectedProposer?.model} (${selectedProposer?.name})`);
    console.log('');
  });

  console.log('\n📋 Routing Summary:');
  console.log('Manager selects proposer based on complexity_score:');
  proposers?.forEach(p => {
    console.log(`  - Score ≤ ${p.complexity_threshold} → ${p.model}`);
  });
}

checkRouting().catch(console.error);
