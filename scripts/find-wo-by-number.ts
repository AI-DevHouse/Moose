import { createClient } from '@supabase/supabase-js';

async function findWOByNumber(woNumber: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Try ID match (woNumber might be first 8 chars of UUID)
  // Use .select() with all fields and .filter() client-side since UUID can't use ilike
  let { data, error } = await supabase
    .from('work_orders')
    .select('id, title, status, metadata, github_pr_url, github_branch, created_at, completed_at, project_id')
    .order('created_at', { ascending: false })
    .limit(1000);  // Get recent WOs

  if (error) {
    console.error('Error querying work orders:', error);
    return;
  }

  // Filter client-side
  if (data) {
    data = data.filter((wo: any) =>
      wo.id.toLowerCase().startsWith(woNumber.toLowerCase()) ||
      wo.id.toLowerCase().includes(woNumber.toLowerCase()) ||
      wo.title.toLowerCase().includes(woNumber.toLowerCase())
    );
  }

  if (!data || data.length === 0) {
    console.log(`No work orders found matching: ${woNumber}`);
    return;
  }

  console.log(`Found ${data.length} work order(s):\n`);

  for (const wo of data) {
    console.log('='.repeat(80));
    console.log(`ID: ${wo.id}`);
    console.log(`Short ID: ${wo.id.substring(0, 8)}`);
    console.log(`Title: ${wo.title}`);
    console.log(`Status: ${wo.status}`);
    console.log(`Project ID: ${wo.project_id || 'N/A'}`);
    console.log(`GitHub PR: ${wo.github_pr_url || 'N/A'}`);
    console.log(`GitHub Branch: ${wo.github_branch || 'N/A'}`);
    console.log(`Created: ${wo.created_at}`);
    console.log(`Completed: ${wo.completed_at || 'N/A'}`);

    if (wo.metadata) {
      console.log('\nMetadata:');
      console.log(JSON.stringify(wo.metadata, null, 2));
    }
    console.log('');
  }
}

const woNumber = process.argv[2];
if (!woNumber) {
  console.error('Usage: tsx find-wo-by-number.ts <wo_number>');
  process.exit(1);
}

findWOByNumber(woNumber).catch(console.error);
