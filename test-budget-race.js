import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testBudgetRace() {
  console.log('=== Budget Race Condition Test ===\n');

  // 1. Set daily spend to $94
  const today = new Date().toISOString().split('T')[0];
  console.log(`Setting daily spend to $94 for ${today}...`);

  // First, clear today's test entries
  await supabase
    .from('cost_tracking')
    .delete()
    .like('service_name', 'test-%')
    .gte('created_at', today);

  // Insert a $94 cost record
  await supabase
    .from('cost_tracking')
    .insert({
      cost: 94,
      service_name: 'test-setup',
      metadata: { test: true, note: 'Setting baseline to $94' }
    });

  console.log('Baseline set to $94\n');

  // 2. Try to reserve $5 twice concurrently (total would be $104, exceeds $100)
  console.log('Attempting to reserve $5 twice concurrently...\n');
  console.log('Without locking: Both would see $94, both reserve $5 → total $104 ❌');
  console.log('With locking: First sees $94, reserves $5 → Second sees $99, blocked ✅\n');

  const request1 = supabase.rpc('check_and_reserve_budget', {
    p_estimated_cost: 5,
    p_service_name: 'test-1',
    p_metadata: { test: true }
  });

  const request2 = supabase.rpc('check_and_reserve_budget', {
    p_estimated_cost: 5,
    p_service_name: 'test-2',
    p_metadata: { test: true }
  });

  const [result1, result2] = await Promise.all([request1, request2]);

  console.log('Request 1:', result1.data);
  console.log('Request 2:', result2.data);

  const successCount = [result1.data?.[0], result2.data?.[0]]
    .filter(r => r?.can_proceed).length;

  console.log('\n✅ Test Result:');
  console.log(`  Requests succeeded: ${successCount}/2`);
  console.log(`  Expected: 1 (one should be blocked)`);

  if (successCount === 1) {
    console.log('  ✅ PASS: Budget race condition prevented!');
  } else if (successCount === 0) {
    console.log('  ⚠️  Both blocked (overly conservative, but safe)');
  } else {
    console.log('  ❌ FAIL: Both requests succeeded (race condition exists)');
  }

  // Cleanup
  console.log('\nCleaning up test data...');
  await supabase
    .from('cost_tracking')
    .delete()
    .like('service_name', 'test-%');

  console.log('Done!');
}

testBudgetRace().catch(console.error);
