import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkProposers() {
  console.log('📊 CHECKING PROPOSERS TABLE\n');
  console.log('='.repeat(60));

  const { data: proposers, error } = await supabase
    .from('proposer_configs')
    .select('*')
    .order('complexity_threshold', { ascending: true });

  if (error) {
    console.error('❌ Error querying proposers:', error);
    return;
  }

  if (!proposers || proposers.length === 0) {
    console.log('⚠️  No proposers found in database');
    return;
  }

  console.log(`Total proposers: ${proposers.length}\n`);

  proposers.forEach(p => {
    const status = p.active ? '✅ ACTIVE' : '❌ INACTIVE';
    console.log(`${status} ${p.name}`);
    console.log(`  Model: ${p.model}`);
    console.log(`  Provider: ${p.provider}`);
    console.log(`  Complexity Threshold: ${p.complexity_threshold}`);
    console.log(`  Input Cost: $${p.cost_profile?.input_cost_per_token || 'N/A'}/token`);
    console.log(`  Output Cost: $${p.cost_profile?.output_cost_per_token || 'N/A'}/token`);
    console.log();
  });

  const activeProposers = proposers.filter(p => p.active);
  console.log('='.repeat(60));
  console.log(`Active proposers: ${activeProposers.length}/${proposers.length}`);

  if (activeProposers.length > 1) {
    console.log('\n✅ Multi-model routing ENABLED');
    console.log('Routing logic:');
    activeProposers.forEach(p => {
      console.log(`  - Complexity ≤ ${p.complexity_threshold}: ${p.name} ($${p.cost_profile?.input_cost_per_token}/token)`);
    });
  } else {
    console.log('\n⚠️  Multi-model routing DISABLED (only 1 active proposer)');
  }
}

checkProposers().catch(console.error);
