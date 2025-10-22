// scripts/test-single-batch-scan.ts
// Executes single-batch complexity scan on test project
// Per Implementation Plan V113 Task 5

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { createSupabaseServiceClient } from '../src/lib/supabase';
import { scanComplexity, logComplexityScan, analyzeScanQuality } from '../src/lib/wo-scope-validator';
import type { WorkOrderInput } from '../src/lib/wo-complexity-calculator';

config({ path: resolve(__dirname, '../.env.local') });

const supabase = createSupabaseServiceClient();

async function main() {
  console.log('🔍 Running single-batch complexity scan...\n');

  // Load test project selection
  const selectionPath = resolve(__dirname, '../docs/session_updates/evidence/v113/test-batch-selection.json');
  let testProjectId: string;

  try {
    const selectionData = await readFile(selectionPath, 'utf-8');
    const selection = JSON.parse(selectionData);
    testProjectId = selection.selected_project.project_id;
    console.log(`✅ Loaded test project: ${selection.selected_project.project_name}`);
    console.log(`   Project ID: ${testProjectId}\n`);
  } catch (error: any) {
    console.error('❌ Failed to load test project selection:', error.message);
    console.log('   Run find-test-decomposition-candidate.ts first\n');
    process.exit(1);
  }

  // Load all WOs from test project
  const { data: wos, error } = await supabase
    .from('work_orders')
    .select('*')
    .eq('project_id', testProjectId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Failed to load work orders:', error.message);
    process.exit(1);
  }

  if (!wos || wos.length === 0) {
    console.error('❌ No work orders found for project');
    process.exit(1);
  }

  console.log(`✅ Loaded ${wos.length} work orders\n`);

  // Convert to WorkOrderInput format
  const woInputs: WorkOrderInput[] = wos.map(wo => ({
    files_in_scope: wo.files_in_scope,
    acceptance_criteria: wo.acceptance_criteria,
    metadata: wo.metadata,
    context_budget_estimate: wo.context_budget_estimate,
    risk_level: wo.risk_level
  }));

  // Run complexity scan
  console.log('📊 Running complexity scan...\n');
  const scanResult = scanComplexity(woInputs);

  // Log results
  await logComplexityScan(testProjectId, scanResult);

  // Analyze quality
  const quality = analyzeScanQuality(scanResult);
  console.log(`📈 Quality Assessment: ${quality.quality.toUpperCase()}`);
  console.log(`   ${quality.recommendation}\n`);

  // Select 5 WOs for execution test (1 healthy, 2 review, 2 oversized)
  console.log('🎯 Selecting 5 WOs for execution test...\n');

  const healthyWOs = scanResult.problematicWOs
    .filter(w => w.signal.signal === 'healthy')
    .slice(0, 1);

  const reviewWOs = scanResult.problematicWOs
    .filter(w => w.signal.signal === 'review_recommended')
    .slice(0, 2);

  const oversizedWOs = scanResult.problematicWOs
    .filter(w => w.signal.signal === 'likely_oversized')
    .slice(0, 2);

  // Also check non-problematic WOs for healthy candidates
  if (healthyWOs.length === 0) {
    const healthySignals = woInputs
      .map((wo, idx) => ({ index: idx, wo, signal: scanResult.problematicWOs.find(p => p.index === idx)?.signal }))
      .filter(s => s.signal === undefined); // These weren't in problematic list

    if (healthySignals.length > 0) {
      // Need to assess these manually
      const { assessWOScope } = await import('../src/lib/wo-complexity-calculator');
      const healthyCandidate = healthySignals[0];
      const signal = assessWOScope(healthyCandidate.wo);

      if (signal.signal === 'healthy') {
        healthyWOs.push({
          index: healthyCandidate.index,
          wo: healthyCandidate.wo,
          signal
        });
      }
    }
  }

  const selectedWOs = [
    ...healthyWOs,
    ...reviewWOs,
    ...oversizedWOs
  ];

  if (selectedWOs.length < 5) {
    console.warn(`⚠️  Only found ${selectedWOs.length}/5 WOs for test`);
    console.warn(`   Healthy: ${healthyWOs.length}, Review: ${reviewWOs.length}, Oversized: ${oversizedWOs.length}\n`);
  }

  console.log(`Selected ${selectedWOs.length} WOs for execution test:\n`);

  for (const { index, signal } of selectedWOs) {
    const wo = wos[index];
    console.log(`  WO-${index}: ${wo.title.substring(0, 60)}...`);
    console.log(`    ID: ${wo.id}`);
    console.log(`    Score: ${signal.score.toFixed(2)} (${signal.signal})`);
    console.log(`    Files: ${signal.factors.fileCount}, Criteria: ${signal.factors.criteriaCount}`);
    console.log('');
  }

  // Save results
  const outputPath = resolve(__dirname, '../docs/session_updates/evidence/v113/single-batch-scan-results.json');

  const outputData = {
    project_id: testProjectId,
    project_name: wos[0]?.metadata ? (wos[0].metadata as any).project_name : 'multi-llm-discussion-v1',
    scan_timestamp: new Date().toISOString(),
    scan_result: {
      total: scanResult.total,
      healthy: scanResult.healthy,
      review_recommended: scanResult.review_recommended,
      likely_oversized: scanResult.likely_oversized,
      problematic_percent: scanResult.problematicPercent
    },
    quality_assessment: quality,
    selected_wos: selectedWOs.map(({ index, signal }) => ({
      index,
      wo_id: wos[index].id,
      title: wos[index].title,
      score: signal.score,
      signal: signal.signal,
      factors: signal.factors,
      guidance: signal.guidance
    })),
    all_wo_scores: wos.map((wo, idx) => {
      const problemat = scanResult.problematicWOs.find(p => p.index === idx);
      if (problemat) {
        return {
          index: idx,
          wo_id: wo.id,
          title: wo.title,
          score: problemat.signal.score,
          signal: problemat.signal.signal
        };
      }

      // Need to calculate score for healthy WOs not in problematic list
      const { assessWOScope } = require('../src/lib/wo-complexity-calculator');
      const signal = assessWOScope({
        files_in_scope: wo.files_in_scope,
        acceptance_criteria: wo.acceptance_criteria,
        metadata: wo.metadata,
        context_budget_estimate: wo.context_budget_estimate,
        risk_level: wo.risk_level
      });

      return {
        index: idx,
        wo_id: wo.id,
        title: wo.title,
        score: signal.score,
        signal: signal.signal
      };
    })
  };

  await writeFile(outputPath, JSON.stringify(outputData, null, 2));

  console.log('='.repeat(80));
  console.log(`✅ Single-batch scan complete`);
  console.log(`📁 Results saved to: ${outputPath}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review selected WOs in evidence file');
  console.log('  2. Approve WOs for execution (V113 or V114)');
  console.log('  3. Monitor execution and collect acceptance scores');
  console.log('  4. Analyze correlation between predicted complexity and actual scores');
}

main().catch(console.error);
