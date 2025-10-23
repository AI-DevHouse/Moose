// Reset only the 6 test WOs back to pending

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const woIds = ['14b6ea23', 'ca89cf28', '0e11d4c2', 'a2909860', '4e4c7480', '036f0989'];

  console.log('\n🔄 RESETTING 6 WOs TO PENDING (preserving dependencies)\n');

  // Get full WO IDs
  const { data: allWos } = await supabase
    .from('work_orders')
    .select('id, title, metadata');

  for (const woIdPrefix of woIds) {
    const wo = allWos?.find(w => w.id.startsWith(woIdPrefix));

    if (!wo) {
      console.log(`❌ WO-${woIdPrefix} not found`);
      continue;
    }

    // Reset to pending, preserve metadata (which now has dependencies)
    const { error } = await supabase
      .from('work_orders')
      .update({
        status: 'pending',
        github_pr_url: null,
        github_pr_number: null,
        github_branch: null
      })
      .eq('id', wo.id);

    if (error) {
      console.log(`❌ Error resetting WO-${woIdPrefix}: ${error.message}`);
    } else {
      const deps = wo.metadata?.dependencies || [];
      console.log(`✅ WO-${woIdPrefix}... - ${wo.title}`);
      console.log(`   Dependencies: ${deps.length === 0 ? 'None' : deps.map((d: string) => d.substring(0, 8)).join(', ')}`);
    }
  }

  console.log('\n✅ Done! WOs reset to pending with dependencies preserved.');
  console.log('\nNext: Approve them with scripts/approve-six-wos.ts');
}

main().catch(console.error);
