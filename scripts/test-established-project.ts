// Test that established projects do NOT get bootstrap injection
import { architectService } from '../src/lib/architect-service';
import type { TechnicalSpec } from '../src/types/architect';

const projectId = '06b35034-c877-49c7-b374-787d9415ea73'; // moose-mission-control-test

// Simple test spec for an established project
const testSpec: TechnicalSpec = {
  feature_name: 'Work Order Priority Queue',
  objectives: [
    'Add priority field to work orders',
    'Implement priority-based execution queue',
    'Update UI to show priority sorting'
  ],
  constraints: [
    'Must maintain backward compatibility',
    'Must use existing TypeScript patterns',
    'Must integrate with current orchestrator'
  ],
  acceptance_criteria: [
    'Priority field added to work_orders table',
    'Work orders execute in priority order',
    'UI displays priority correctly'
  ]
};

async function main() {
  console.log('🧪 Testing Established Project (NO Bootstrap Expected)\n');
  console.log('Project: moose-mission-control-test');
  console.log('Project ID:', projectId);
  console.log('Path: C:\\dev\\moose-mission-control');
  console.log('Expected: Established project → NO bootstrap injection\n');
  console.log('---\n');

  try {
    console.log('📝 Decomposing spec...\n');

    const decomposition = await architectService.decomposeSpec(testSpec, {
      projectId,
      generateWireframes: false,
      generateContracts: false
    });

    console.log('\n✅ Decomposition complete!\n');
    console.log('=== RESULTS ===\n');
    console.log(`Total work orders: ${decomposition.work_orders.length}`);

    // Check if bootstrap WO was injected (it should NOT be)
    const firstWO = decomposition.work_orders[0];
    const isBootstrap = firstWO.title.toLowerCase().includes('bootstrap') ||
                        firstWO.title.toLowerCase().includes('infrastructure');

    if (isBootstrap) {
      console.log('\n❌ UNEXPECTED: Bootstrap WO detected in established project!');
      console.log(`   Title: ${firstWO.title}`);
      console.log(`   This indicates greenfield detection incorrectly flagged moose as greenfield\n`);
      process.exit(1);
    } else {
      console.log('\n✅ CORRECT: NO bootstrap WO detected');
      console.log(`   First WO: "${firstWO.title}"`);
      console.log('   This confirms established project detection works correctly\n');
    }

    console.log('All Work Orders:');
    decomposition.work_orders.forEach((wo, idx) => {
      console.log(`   ${idx + 1}. ${wo.title}`);
    });
    console.log('');

    console.log('Decomposition Doc (first 300 chars):');
    console.log(decomposition.decomposition_doc.substring(0, 300) + '...\n');

    console.log('✅ TEST PASSED: Established project correctly skipped bootstrap injection');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
