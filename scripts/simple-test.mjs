import fs from 'fs';

const payload = JSON.parse(fs.readFileSync('C:/dev/moose-mission-control/scripts/simple-test-payload.json', 'utf8'));

console.log('Testing decomposition endpoint with SIMPLE spec...\n');

const startTime = Date.now();

try {
  const response = await fetch('http://localhost:3001/api/architect/decompose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const duration = (Date.now() - startTime) / 1000;

  console.log(`HTTP Status: ${response.status}`);
  console.log(`Time: ${duration.toFixed(2)}s\n`);

  const result = await response.json();

  fs.writeFileSync('C:/dev/moose-mission-control/docs/simple-test-result.json', JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('✅ SUCCESS!');
    console.log(`Work Orders: ${result.data.work_orders.length}`);
    console.log(`\nWork Order Titles:`);
    result.data.work_orders.forEach((wo, i) => {
      console.log(`  ${i}. ${wo.title}`);
    });
  } else {
    console.log('❌ FAILED');
    console.log(`Error: ${result.error}`);
  }

  console.log('\nFull result saved to: docs/simple-test-result.json');
} catch (error) {
  console.error('❌ Request failed:', error.message);
}
