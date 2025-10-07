// Phase 2 Test: Multi-LLM Discussion App Decomposition
// This script tests the enhanced Architect with the Multi-LLM App spec

import * as fs from 'fs';
import * as path from 'path';
import { architectService } from '../src/lib/architect-service';
import type { TechnicalSpec } from '../src/types/architect';

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
  const technicalSpec: TechnicalSpec = {
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
    budget_estimate: 50000, // Estimated dev cost
    time_estimate: '12 weeks',
  };

  // Add the spec text as context
  const specWithContext = {
    ...technicalSpec,
    // Store the full spec as reference (this will be included in decomposition context)
    _fullSpecText: specText,
  };

  console.log('TechnicalSpec created:');
  console.log(`  Feature: ${technicalSpec.feature_name}`);
  console.log(`  Objectives: ${technicalSpec.objectives.length}`);
  console.log(`  Constraints: ${technicalSpec.constraints.length}`);
  console.log(`  Acceptance Criteria: ${technicalSpec.acceptance_criteria.length}`);
  console.log();

  // Run decomposition with all Phase 1 enhancements
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
    console.log('RESULTS SUMMARY:');
    console.log(`  Work Orders: ${result.work_orders.length}`);
    console.log(`  Decomposition Cost: $${result.total_estimated_cost.toFixed(4)}`);
    console.log(`  Wireframe Cost: $${(result.wireframe_cost || 0).toFixed(4)}`);
    console.log(`  Contract Cost: $${(result.contract_cost || 0).toFixed(4)}`);
    console.log(`  Total Cost: $${(result.total_estimated_cost + (result.wireframe_cost || 0) + (result.contract_cost || 0)).toFixed(4)}`);
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

      // Show IPC contracts (relevant to this Electron app)
      if (result.contracts.ipc_contracts && result.contracts.ipc_contracts.length > 0) {
        console.log('IPC CONTRACTS DETAIL:');
        result.contracts.ipc_contracts.forEach((contract, idx) => {
          console.log(`  ${idx + 1}. Channel: ${contract.channel_name}`);
          console.log(`     Format: ${contract.message_format.substring(0, 100)}...`);
        });
        console.log();
      }
    }

    // Success criteria check
    console.log('SUCCESS CRITERIA:');
    const woCount = result.work_orders.length;
    const totalCost = result.total_estimated_cost + (result.wireframe_cost || 0) + (result.contract_cost || 0);
    const durationMin = parseFloat(durationSec) / 60;

    console.log(`  ✓ Spec loaded successfully`);
    console.log(`  ${woCount >= 8 && woCount <= 20 ? '✓' : '✗'} Work order count in range (${woCount}/20 max)`);
    console.log(`  ${totalCost < 1.00 ? '✓' : '✗'} Total cost <$1.00 ($${totalCost.toFixed(4)})`);
    console.log(`  ${durationMin < 2 ? '✓' : '✗'} Duration <2 minutes (${durationMin.toFixed(2)}min)`);
    console.log(`  ${result.contracts ? '✓' : '✗'} Contracts generated`);
    console.log();

    // Save results to file
    const outputDir = path.join(process.cwd(), 'docs');
    const outputPath = path.join(outputDir, 'Phase_2_Test_Results.md');

    const markdown = `# Phase 2 Test Results - Multi-LLM Discussion App

**Test Date:** ${new Date().toISOString()}
**Duration:** ${durationSec}s (${durationMin.toFixed(2)} minutes)

## Summary

- **Work Orders:** ${woCount}
- **Decomposition Cost:** $${result.total_estimated_cost.toFixed(4)}
- **Wireframe Cost:** $${(result.wireframe_cost || 0).toFixed(4)}
- **Contract Cost:** $${(result.contract_cost || 0).toFixed(4)}
- **Total Cost:** $${totalCost.toFixed(4)}

## Success Criteria

| Criterion | Status | Result |
|-----------|--------|--------|
| Spec loads successfully | ✅ | Loaded ${specText.length} chars |
| Work order count 8-20 | ${woCount >= 8 && woCount <= 20 ? '✅' : '❌'} | ${woCount} work orders |
| Total cost <$1.00 | ${totalCost < 1.00 ? '✅' : '❌'} | $${totalCost.toFixed(4)} |
| Duration <2 minutes | ${durationMin < 2 ? '✅' : '❌'} | ${durationMin.toFixed(2)} min |
| Contracts generated | ${result.contracts ? '✅' : '❌'} | ${result.contracts ? 'Yes' : 'No'} |

## Work Orders Generated

${result.work_orders.map((wo, idx) => `
### ${idx + 1}. ${wo.title}

**Description:** ${wo.description}

**Risk Level:** ${wo.risk_level}
**Dependencies:** ${wo.dependencies.length > 0 ? wo.dependencies.join(', ') : 'None'}
**Files in Scope:** ${wo.files_in_scope.length > 0 ? wo.files_in_scope.join(', ') : 'TBD'}
**Context Budget:** ${wo.context_budget_estimate} tokens

**Acceptance Criteria:**
${wo.acceptance_criteria.map(ac => `- ${ac}`).join('\n')}

${wo.wireframe ? `**Wireframe:** ${wo.wireframe.component_name} (${wo.wireframe.storage_path || 'pending'})` : ''}
`).join('\n---\n')}

## Contracts Generated

${result.contracts ? `
### API Contracts (${result.contracts.api_contracts?.length || 0})

${result.contracts.api_contracts?.map((c, idx) => `
${idx + 1}. **${c.method} ${c.endpoint}**
   - Request: \`\`\`${c.request_schema}\`\`\`
   - Response: \`\`\`${c.response_schema}\`\`\`
`).join('\n') || 'None'}

### IPC Contracts (${result.contracts.ipc_contracts?.length || 0})

${result.contracts.ipc_contracts?.map((c, idx) => `
${idx + 1}. **Channel: ${c.channel_name}**
   - Format: \`\`\`${c.message_format}\`\`\`
   - Sequence: ${c.event_sequence || 'N/A'}
`).join('\n') || 'None'}

### State Contracts (${result.contracts.state_contracts?.length || 0})

${result.contracts.state_contracts?.map((c, idx) => `
${idx + 1}. **State Shape:**
   \`\`\`typescript
${c.state_shape}
   \`\`\`
   - Actions: ${c.action_types?.join(', ') || 'N/A'}
   - Selectors: ${c.selectors?.join(', ') || 'N/A'}
`).join('\n') || 'None'}

### File Contracts (${result.contracts.file_contracts?.length || 0})

${result.contracts.file_contracts?.map((c, idx) => `
${idx + 1}. **${c.path}** (${c.format})
   ${c.schema ? `- Schema: ${c.schema}` : ''}
`).join('\n') || 'None'}

### Database Contracts (${result.contracts.database_contracts?.length || 0})

${result.contracts.database_contracts?.map((c, idx) => `
${idx + 1}. **Table: ${c.table_name}**
   - Columns: ${c.columns.map(col => `${col.name} (${col.type})`).join(', ')}
   ${c.relationships ? `- Relationships: ${c.relationships.map(r => `${r.foreign_key} → ${r.references}`).join(', ')}` : ''}
`).join('\n') || 'None'}
` : 'No contracts generated'}

## Decomposition Document

${result.decomposition_doc}

---

**Test Status:** ${woCount >= 8 && woCount <= 20 && totalCost < 1.00 && durationMin < 2 && result.contracts ? '✅ ALL PASS' : '⚠️ SOME FAILURES'}
`;

    fs.writeFileSync(outputPath, markdown, 'utf-8');
    console.log(`Results saved to: ${outputPath}`);
    console.log();

    // Overall status
    if (woCount >= 8 && woCount <= 20 && totalCost < 1.00 && durationMin < 2 && result.contracts) {
      console.log('✅ PHASE 2 TEST: PASS');
    } else {
      console.log('⚠️ PHASE 2 TEST: PARTIAL (see failures above)');
    }

  } catch (error) {
    console.error('ERROR during decomposition:', error);
    throw error;
  }
}

main().catch(console.error);
