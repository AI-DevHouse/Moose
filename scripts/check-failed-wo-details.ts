import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MLD_PROJECT_ID = 'f73e8c9f-1d78-4251-8fb6-a070fd857951';

async function checkFailedWO() {
  const { data, error } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata, github_pr_url, created_at')
    .eq('project_id', MLD_PROJECT_ID)
    .eq('status', 'failed')
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== FAILED WOs ===\n');
  data.forEach(wo => {
    const shortId = wo.id.substring(0, 8);
    console.log(`WO-${shortId}: ${wo.title}`);
    console.log(`  Status: ${wo.status}`);
    console.log(`  PR: ${wo.github_pr_url || 'None'}`);
    console.log(`  Created: ${wo.created_at}`);
    if (wo.metadata) {
      console.log(`  Metadata:`, JSON.stringify(wo.metadata, null, 2));
    }
    console.log();
  });
}

checkFailedWO();
