import { createSupabaseServiceClient } from '../src/lib/supabase';

async function checkDuplicates() {
  const supabase = createSupabaseServiceClient();
  const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951';

  // Get all WOs with their titles
  const { data: wos, error } = await supabase
    .from('work_orders')
    .select('id, title, status')
    .eq('project_id', projectId)
    .order('title');

  if (error) {
    console.error('Error fetching work orders:', error);
    return;
  }

  if (!wos || wos.length === 0) {
    console.log('No work orders found');
    return;
  }

  console.log(`\nFound ${wos.length} work orders\n`);

  console.log('=== Checking for Duplicate Titles ===\n');

  const titleMap = new Map<string, Array<{ id: string; fullId: string; status: string }>>();
  wos.forEach(wo => {
    const shortId = wo.id.substring(0, 8);
    const key = wo.title.toLowerCase().trim();
    if (!titleMap.has(key)) {
      titleMap.set(key, []);
    }
    titleMap.get(key)!.push({ id: shortId, fullId: wo.id, status: wo.status });
  });

  // Show duplicates
  let dupeCount = 0;
  titleMap.forEach((wos, title) => {
    if (wos.length > 1) {
      dupeCount++;
      console.log(`DUPLICATE: ${title}`);
      wos.forEach(w => console.log(`  - ${w.id} (status: ${w.status})`));
      console.log('');
    }
  });

  if (dupeCount === 0) {
    console.log('No duplicate titles found');
  } else {
    console.log(`\nTotal duplicate titles: ${dupeCount}`);
  }
  console.log(`Total unique titles: ${titleMap.size}`);

  // Check the specific WOs from the execution
  console.log('\n=== Checking Specific WOs from Execution ===\n');
  const specificIds = ['0170420d-9562-4326-95a8-d70f675421a0', 'a14242af-0055-4cb1-ac57-25f3b6fe870d'];

  for (const id of specificIds) {
    const wo = wos.find(w => w.id === id);
    if (wo) {
      console.log(`${id.substring(0, 8)}: ${wo.title}`);
      console.log(`  Status: ${wo.status}`);
    }
  }
}

checkDuplicates().catch(console.error);
