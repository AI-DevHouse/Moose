// Reset only bootstrap WO to approved

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('\n🔄 RESETTING BOOTSTRAP WO TO APPROVED\n');

  // Find bootstrap WO
  const { data: allWos } = await supabase
    .from('work_orders')
    .select('id, title, status');

  const bootstrapWO = allWos?.find(w => w.id.startsWith('14b6ea23'));

  if (!bootstrapWO) {
    console.log('❌ Bootstrap WO not found');
    return;
  }

  console.log(`Found: WO-${bootstrapWO.id.substring(0, 8)}: ${bootstrapWO.title}`);
  console.log(`Current status: ${bootstrapWO.status}`);

  // Reset to approved
  const { error } = await supabase
    .from('work_orders')
    .update({
      status: 'approved',
      github_pr_url: null,
      github_pr_number: null,
      github_branch: null
    })
    .eq('id', bootstrapWO.id);

  if (error) {
    console.log(`\n❌ Error: ${error.message}`);
  } else {
    console.log(`\n✅ Reset to approved`);
    console.log('\nOrchestrator will pick it up on next poll cycle.');
  }
}

main().catch(console.error);
