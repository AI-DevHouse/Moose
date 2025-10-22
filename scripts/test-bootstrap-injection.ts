// Test bootstrap WO injection for greenfield projects
import { architectService } from '../src/lib/architect-service';
import type { TechnicalSpec } from '../src/types/architect';

const projectId = 'f73e8c9f-1d78-4251-8fb6-a070fd857951'; // multi-llm-discussion-v1

// Simple test spec that mentions React and Redux
const testSpec: TechnicalSpec = {
  feature_name: 'Discussion View Component',
  objectives: [
    'Create a React component to display multi-LLM discussions',
    'Use Redux for state management',
    'Implement discussion threading with provider tags'
  ],
  constraints: [
    'Must use TypeScript',
    'Must follow React best practices',
    'Must be testable with Jest'
  ],
  acceptance_criteria: [
    'Component renders discussion threads correctly',
    'Redux store manages discussion state',
    'Unit tests achieve >80% coverage'
  ]
};

async function main() {
  console.log('🧪 Testing Bootstrap WO Injection\n');
  console.log('Project ID:', projectId);
  console.log('Project Path: C:\\dev\\multi-llm-discussion-v1');
  console.log('Expected: Greenfield detection → Bootstrap WO injected as WO-0\n');
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
    console.log(`Estimated cost: $${decomposition.total_estimated_cost.toFixed(2)}\n`);

    // Check if bootstrap WO was injected
    const firstWO = decomposition.work_orders[0];
    const isBootstrap = firstWO.title.toLowerCase().includes('bootstrap') ||
                        firstWO.title.toLowerCase().includes('infrastructure');

    if (isBootstrap) {
      console.log('✅ BOOTSTRAP WO DETECTED!');
      console.log(`   Title: ${firstWO.title}`);
      console.log(`   Files: ${firstWO.files_in_scope.join(', ')}`);
      console.log(`   Dependencies: [${firstWO.dependencies.join(', ')}]`);
      console.log(`   Risk: ${firstWO.risk_level}\n`);

      // Check if feature WOs depend on bootstrap
      console.log('Feature WO Dependencies:');
      decomposition.work_orders.slice(1).forEach((wo, idx) => {
        const hasBootstrapDep = wo.dependencies.includes('0');
        console.log(`   WO-${idx + 1}: "${wo.title}"`);
        console.log(`           Deps: [${wo.dependencies.join(', ')}] ${hasBootstrapDep ? '✅' : '❌'}`);
      });

      // Show bootstrap description excerpt
      console.log('\nBootstrap Description (first 300 chars):');
      console.log(firstWO.description.substring(0, 300) + '...\n');

      // Show decomposition doc header
      console.log('Decomposition Doc Header:');
      console.log(decomposition.decomposition_doc.substring(0, 400) + '...\n');

    } else {
      console.log('❌ BOOTSTRAP WO NOT FOUND');
      console.log(`   First WO: ${firstWO.title}`);
      console.log('   This might indicate greenfield detection failed\n');
    }

    console.log('\n=== ALL WORK ORDERS ===\n');
    decomposition.work_orders.forEach((wo, idx) => {
      console.log(`WO-${idx}: ${wo.title}`);
      console.log(`   Deps: [${wo.dependencies.join(', ')}]`);
      console.log(`   Files: ${wo.files_in_scope.slice(0, 3).join(', ')}${wo.files_in_scope.length > 3 ? '...' : ''}`);
      console.log('');
    });

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
