// Test Proposer Execution - Priority 1
// Creates 3 Todo App work orders and tests end-to-end execution

import fs from 'fs';

console.log('=== Test Proposer Execution - Priority 1 ===\n');

// Load the Todo App work orders from simple-test-result.json
const testResult = JSON.parse(
  fs.readFileSync('C:/dev/moose-mission-control/docs/simple-test-result.json', 'utf8')
);

if (!testResult.success || !testResult.data.work_orders) {
  console.error('❌ Failed to load test data');
  process.exit(1);
}

const allWorkOrders = testResult.data.work_orders;

// Select first 3 work orders (they form a dependency chain)
const selectedWorkOrders = allWorkOrders.slice(0, 3);

console.log('Selected work orders for testing:');
selectedWorkOrders.forEach((wo, i) => {
  console.log(`  ${i}. ${wo.title}`);
  console.log(`     Risk: ${wo.risk_level}, Dependencies: [${wo.dependencies.join(', ')}]`);
});

console.log('\n=== Creating Work Orders in Database ===\n');

const createdIds = [];

try {
  for (const wo of selectedWorkOrders) {
    console.log(`Creating: ${wo.title}...`);

    const response = await fetch('http://localhost:3000/api/work-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: wo.title,
        description: wo.description,
        risk_level: wo.risk_level,
        acceptance_criteria: wo.acceptance_criteria,
        files_in_scope: wo.files_in_scope,
        context_budget_estimate: wo.context_budget_estimate
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`  ❌ Failed: ${response.status} ${error}`);
      continue;
    }

    const created = await response.json();
    createdIds.push(created.id);
    console.log(`  ✅ Created: ${created.id}`);
  }

  console.log(`\n✅ Successfully created ${createdIds.length} work orders\n`);

  // Save work order IDs for monitoring
  fs.writeFileSync(
    'C:/dev/moose-mission-control/scripts/test-proposer-work-order-ids.json',
    JSON.stringify(createdIds, null, 2)
  );

  console.log('Work Order IDs saved to: scripts/test-proposer-work-order-ids.json');

  console.log('\n=== Next Steps ===');
  console.log('1. Wait for Orchestrator to poll and pick up the work orders (10s interval)');
  console.log('2. Monitor execution via:');
  console.log('   - Server console logs');
  console.log('   - Dashboard: http://localhost:3000');
  console.log('   - GitHub PRs: https://github.com/yourusername/yourrepo/pulls');
  console.log('\n3. Or manually trigger execution:');
  createdIds.forEach((id, i) => {
    console.log(`   curl -X POST http://localhost:3000/api/orchestrator/execute -H "Content-Type: application/json" -d "{\\"work_order_id\\":\\"${id}\\"}"`);
  });

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
