import fs from 'fs';

// Load the full technical specification
const fullSpecText = fs.readFileSync('C:/dev/Multi-LLM Discussion/Multi-LLM Discussion App_Technical Specification_ v2.2.txt', 'utf8');

console.log('Loading full Multi-LLM Discussion App Technical Specification...');
console.log(`Spec size: ${fullSpecText.length} characters, ${fullSpecText.split('\n').length} lines\n`);

// Create payload with full spec in objectives (will be picked up by pre-decomposed detection)
const payload = {
  spec: {
    feature_name: "Multi-LLM Discussion App",
    objectives: [
      fullSpecText  // Pass full spec - Claude should detect pre-decomposed sections
    ],
    constraints: [
      "Use Electron v28+ for desktop framework",
      "TypeScript 5.3+ with strict mode required",
      "Budget: $100/day hard cap"
    ],
    acceptance_criteria: [
      "All 11 component sections implemented",
      "Follows technical specification v2.2"
    ]
  },
  generateContracts: true
};

console.log('Testing decomposition with FULL technical specification...');
console.log('Expected: Should detect pre-decomposed sections 4.1-4.11 and extract them\n');

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

  fs.writeFileSync('C:/dev/moose-mission-control/docs/full-spec-test-result.json', JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('✅ SUCCESS!');
    console.log(`Work Orders: ${result.data.work_orders.length}`);

    // Check if extraction was used
    if (result.data.decomposition_doc?.includes('decomposition_source')) {
      console.log('Decomposition method: Detected in output');
    }

    console.log(`\nWork Order Titles:`);
    result.data.work_orders.forEach((wo, i) => {
      console.log(`  ${i}. ${wo.title}`);
    });

    if (result.data.contracts) {
      console.log(`\n📋 Contracts Generated:`);
      console.log(`  - API Contracts: ${result.data.contracts.api_contracts?.length || 0}`);
      console.log(`  - IPC Contracts: ${result.data.contracts.ipc_contracts?.length || 0}`);
      console.log(`  - State Contracts: ${result.data.contracts.state_contracts?.length || 0}`);
      console.log(`  - File Contracts: ${result.data.contracts.file_contracts?.length || 0}`);
      console.log(`  - Database Contracts: ${result.data.contracts.database_contracts?.length || 0}`);
    }

    console.log(`\nEstimated Cost: $${result.data.total_estimated_cost}`);
  } else {
    console.log('❌ FAILED');
    console.log(`Error: ${result.error}`);
  }

  console.log('\nFull result saved to: docs/full-spec-test-result.json');
} catch (error) {
  console.error('❌ Request failed:', error.message);
}
