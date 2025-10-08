import fs from 'fs';

const payload = JSON.parse(fs.readFileSync('C:/dev/moose-mission-control/scripts/phase2-test-payload.json', 'utf8'));

console.log('Testing decomposition endpoint...\n');
console.log('Payload:', JSON.stringify(payload, null, 2).substring(0, 200) + '...\n');

const startTime = Date.now();

try {
  const response = await fetch('http://localhost:3000/api/architect/decompose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const duration = (Date.now() - startTime) / 1000;

  console.log(`HTTP Status: ${response.status}`);
  console.log(`Time: ${duration.toFixed(2)}s\n`);

  const result = await response.json();

  fs.writeFileSync('C:/dev/moose-mission-control/docs/multi-llm-test-result.json', JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('✅ SUCCESS!');
    console.log(`Work Orders: ${result.data.work_orders.length}`);
    console.log(`Contracts Generated: ${result.data.contracts ? 'Yes' : 'No'}`);
    if (result.data.contracts) {
      console.log(`  - API Contracts: ${result.data.contracts.api_contracts?.length || 0}`);
      console.log(`  - IPC Contracts: ${result.data.contracts.ipc_contracts?.length || 0}`);
      console.log(`  - State Contracts: ${result.data.contracts.state_contracts?.length || 0}`);
    }
  } else {
    console.log('❌ FAILED');
    console.log(`Error: ${result.error}`);
  }

  console.log('\nFull result saved to: docs/multi-llm-test-result.json');
} catch (error) {
  console.error('❌ Request failed:', error.message);
}
