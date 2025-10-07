// Phase 2 Test: Multi-LLM Discussion App Decomposition
// Direct test using the architect service

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('='.repeat(80));
  console.log('Phase 2 Test: Multi-LLM Discussion App Decomposition');
  console.log('='.repeat(80));
  console.log();

  const startTime = Date.now();

  // Load the Multi-LLM Discussion App spec
  const specPath = 'C:/dev/Multi-LLM Discussion/Multi-LLM Discussion App_Technical Specification_ v2.2.txt';
  console.log(`Loading spec from: ${specPath}`);
  const specText = fs.readFileSync(specPath, 'utf-8');
  console.log(`Spec loaded: ${specText.length} characters, ${specText.split('\n').length} lines`);
  console.log();

  // Convert to TechnicalSpec format
  console.log('Converting to TechnicalSpec format...');
  const technicalSpec = {
    feature_name: 'Multi-LLM Discussion App',
    objectives: [
      'Orchestrate synchronized discussions between four LLM providers (ChatGPT, Claude, Gemini, Grok)',
      'Implement clipboard automation for response harvesting',
      'Create alignment evaluation service using GPT-4o-mini',
      'Build Electron desktop application with multi-process architecture',
      'Provide arbitration UI for comparing and synthesizing responses',
      'Support encrypted archiving and crash recovery',
    ],
    constraints: [
      'Must use Electron v28+ for desktop framework',
      'TypeScript 5.3+ with strict mode required',
      'Clipboard-based harvesting (no direct API integration)',
      'Separate process for alignment service (Express + OpenAI)',
      'WebView isolation for each LLM provider',
      'Local-only operation with encrypted storage',
    ],
    acceptance_criteria: [
      'Successfully orchestrate discussion cycles with 2-4 LLM providers',
      'Harvest responses via clipboard automation with <2s per model',
      'Compute alignment scores with <3s API latency',
      'Display arbitration view with synthesized answer',
      'Create encrypted archives with manifest and scoreboard',
      'Recover from crashes using autosaved state',
      'Support keyboard navigation and WCAG 2.1 AA accessibility',
    ],
    budget_estimate: 50000,
    time_estimate: '12 weeks',
  };

  console.log('TechnicalSpec created:');
  console.log(`  Feature: ${technicalSpec.feature_name}`);
  console.log(`  Objectives: ${technicalSpec.objectives.length}`);
  console.log(`  Constraints: ${technicalSpec.constraints.length}`);
  console.log(`  Acceptance Criteria: ${technicalSpec.acceptance_criteria.length}`);
  console.log();

  // Import the architect service dynamically
  console.log('Loading architect service...');
  const architectModule = await import('../src/lib/architect-service.ts');
  const { architectService } = architectModule;

  console.log('Running Architect decomposition with Phase 1 enhancements...');
  console.log('Options:');
  console.log('  - generateWireframes: true');
  console.log('  - generateContracts: true');
  console.log();

  try {
    const result = await architectService.decomposeSpec(technicalSpec, {
      generateWireframes: true,
      generateContracts: true,
    });

    const endTime = Date.now();
    const durationSec = ((endTime - startTime) / 1000).toFixed(2);

    console.log();
    console.log('='.repeat(80));
    console.log('DECOMPOSITION COMPLETE');
    console.log('='.repeat(80));
    console.log();

    // Results summary
    const totalCost = result.total_estimated_cost + (result.wireframe_cost || 0) + (result.contract_cost || 0);

    console.log('RESULTS SUMMARY:');
    console.log(`  Work Orders: ${result.work_orders.length}`);
    console.log(`  Decomposition Cost: $${result.total_estimated_cost.toFixed(4)}`);
    console.log(`  Wireframe Cost: $${(result.wireframe_cost || 0).toFixed(4)}`);
    console.log(`  Contract Cost: $${(result.contract_cost || 0).toFixed(4)}`);
    console.log(`  Total Cost: $${totalCost.toFixed(4)}`);
    console.log(`  Duration: ${durationSec}s`);
    console.log();

    // Work orders breakdown
    console.log('WORK ORDERS:');
    result.work_orders.forEach((wo, idx) => {
      console.log(`  ${idx + 1}. ${wo.title}`);
      console.log(`     Risk: ${wo.risk_level}, Dependencies: [${wo.dependencies.join(', ') || 'none'}]`);
      if (wo.wireframe) {
        console.log(`     Wireframe: ${wo.wireframe.component_name}`);
      }
    });
    console.log();

    // Contracts summary
    if (result.contracts) {
      console.log('CONTRACTS GENERATED:');
      console.log(`  API Contracts: ${result.contracts.api_contracts?.length || 0}`);
      console.log(`  IPC Contracts: ${result.contracts.ipc_contracts?.length || 0}`);
      console.log(`  State Contracts: ${result.contracts.state_contracts?.length || 0}`);
      console.log(`  File Contracts: ${result.contracts.file_contracts?.length || 0}`);
      console.log(`  Database Contracts: ${result.contracts.database_contracts?.length || 0}`);
      console.log();

      // Show IPC contracts detail
      if (result.contracts.ipc_contracts && result.contracts.ipc_contracts.length > 0) {
        console.log('IPC CONTRACTS (sample):');
        result.contracts.ipc_contracts.slice(0, 3).forEach((contract, idx) => {
          console.log(`  ${idx + 1}. ${contract.channel_name}`);
        });
        console.log();
      }
    }

    // Success criteria check
    const woCount = result.work_orders.length;
    const durationMin = parseFloat(durationSec) / 60;

    console.log('SUCCESS CRITERIA:');
    console.log(`  ✓ Spec loaded successfully`);
    console.log(`  ${woCount >= 8 && woCount <= 20 ? '✓' : '✗'} Work order count in range (${woCount}/20 max)`);
    console.log(`  ${totalCost < 1.00 ? '✓' : '✗'} Total cost <$1.00 ($${totalCost.toFixed(4)})`);
    console.log(`  ${durationMin < 2 ? '✓' : '✗'} Duration <2 minutes (${durationMin.toFixed(2)}min)`);
    console.log(`  ${result.contracts ? '✓' : '✗'} Contracts generated`);
    console.log();

    // Save full result to JSON
    const projectRoot = path.resolve(__dirname, '..');
    const outputDir = path.join(projectRoot, 'docs');
    const jsonPath = path.join(outputDir, 'phase2-test-result.json');
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`Full result saved to: ${jsonPath}`);
    console.log();

    // Overall status
    if (woCount >= 8 && woCount <= 20 && totalCost < 1.00 && durationMin < 2 && result.contracts) {
      console.log('✅ PHASE 2 TEST: PASS');
      process.exit(0);
    } else {
      console.log('⚠️ PHASE 2 TEST: PARTIAL (see failures above)');
      process.exit(1);
    }

  } catch (error) {
    console.error('ERROR during decomposition:');
    console.error(error);
    process.exit(1);
  }
}

main();
