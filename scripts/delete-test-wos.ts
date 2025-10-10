// Delete test work orders
import { createSupabaseServiceClient } from '@/lib/supabase';

async function deleteTestWOs() {
  const supabase = createSupabaseServiceClient();

  console.log('Fetching all work orders...');

  const { data: allWOs, error: fetchError } = await supabase
    .from('work_orders')
    .select('id, title')
    .order('created_at', { ascending: true });

  if (fetchError) {
    console.error('Error fetching work orders:', fetchError);
    return;
  }

  // Test WOs are the ones with "test comment" in title
  const testWOs = allWOs?.filter(wo =>
    wo.title.toLowerCase().includes('test comment') ||
    wo.title.toLowerCase().includes('add test') ||
    wo.title === 'Setup project structure and TypeScript configuration'
  ) || [];

  console.log(`\nFound ${testWOs.length} test work orders:`);
  testWOs.forEach((wo, idx) => {
    console.log(`${idx + 1}. ${wo.title} (${wo.id.substring(0, 8)})`);
  });

  if (testWOs.length === 0) {
    console.log('\nNo test work orders to delete.');
    return;
  }

  console.log(`\nDeleting ${testWOs.length} test work orders...`);

  const testWOIds = testWOs.map(wo => wo.id);

  // Delete related records first (cascade should handle this, but being explicit)
  console.log('Deleting outcome_vectors...');
  const { error: ovError } = await supabase
    .from('outcome_vectors')
    .delete()
    .in('work_order_id', testWOIds);

  if (ovError) {
    console.error('Error deleting outcome_vectors:', ovError);
  }

  console.log('Deleting github_events...');
  const { error: geError } = await supabase
    .from('github_events')
    .delete()
    .in('work_order_id', testWOIds);

  if (geError) {
    console.error('Error deleting github_events:', geError);
  }

  console.log('Deleting escalations...');
  const { error: escError } = await supabase
    .from('escalations')
    .delete()
    .in('work_order_id', testWOIds);

  if (escError) {
    console.error('Error deleting escalations:', escError);
  }

  console.log('Deleting work_orders...');
  const { error: woError } = await supabase
    .from('work_orders')
    .delete()
    .in('id', testWOIds);

  if (woError) {
    console.error('Error deleting work_orders:', woError);
    return;
  }

  console.log(`\n✅ Successfully deleted ${testWOs.length} test work orders`);
}

deleteTestWOs().catch(console.error);
