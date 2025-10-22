// src/lib/wo-scope-validator.ts
// Shadow mode scanner for work order complexity
// Logs complexity scans without taking action on decomposition

import { assessWOScope, type WorkOrderInput, type WOComplexitySignal } from './wo-complexity-calculator';

export interface ScanResult {
  total: number;
  healthy: number;
  review_recommended: number;
  likely_oversized: number;
  problematicPercent: number;
  problematicWOs: Array<{
    index: number;
    wo: WorkOrderInput;
    signal: WOComplexitySignal;
  }>;
}

/**
 * Scans an array of work orders for complexity issues
 *
 * Returns a summary of how many WOs are healthy vs problematic,
 * along with detailed info about each problematic WO.
 */
export function scanComplexity(workOrders: WorkOrderInput[]): ScanResult {
  // Assess each WO
  const signals = workOrders.map((wo, idx) => ({
    index: idx,
    wo,
    signal: assessWOScope(wo)
  }));

  // Categorize by signal type
  const categorized = {
    healthy: signals.filter(s => s.signal.signal === 'healthy'),
    review_recommended: signals.filter(s => s.signal.signal === 'review_recommended'),
    likely_oversized: signals.filter(s => s.signal.signal === 'likely_oversized')
  };

  // Combine review + oversized as "problematic"
  const problematic = [
    ...categorized.review_recommended,
    ...categorized.likely_oversized
  ];

  return {
    total: workOrders.length,
    healthy: categorized.healthy.length,
    review_recommended: categorized.review_recommended.length,
    likely_oversized: categorized.likely_oversized.length,
    problematicPercent: workOrders.length > 0 ? problematic.length / workOrders.length : 0,
    problematicWOs: problematic
  };
}

/**
 * Logs complexity scan results to console
 *
 * In V113: Console logging only
 * In V114+: Will also save to database (complexity_scan_logs table)
 *
 * @param specId - Unique ID for this decomposition spec (will be used for DB logging)
 * @param scanResult - The scan result to log
 */
export async function logComplexityScan(
  specId: string,
  scanResult: ScanResult
): Promise<void> {
  console.log(`\n📊 Complexity Scan Results (spec: ${specId}):`);
  console.log(`   Total WOs: ${scanResult.total}`);
  console.log(`   Healthy: ${scanResult.healthy} (${(scanResult.healthy / scanResult.total * 100).toFixed(1)}%)`);
  console.log(`   Review Recommended: ${scanResult.review_recommended} (${(scanResult.review_recommended / scanResult.total * 100).toFixed(1)}%)`);
  console.log(`   Likely Oversized: ${scanResult.likely_oversized} (${(scanResult.likely_oversized / scanResult.total * 100).toFixed(1)}%)`);
  console.log(`   Problematic: ${(scanResult.problematicPercent * 100).toFixed(1)}%`);

  // Log details about problematic WOs
  if (scanResult.problematicWOs.length > 0) {
    console.log(`\n   ⚠️  Problematic WOs (${scanResult.problematicWOs.length}):`);

    for (const { index, signal } of scanResult.problematicWOs.slice(0, 5)) {
      console.log(`      WO-${index}: score=${signal.score.toFixed(2)} (${signal.signal})`);
      console.log(`        Files: ${signal.factors.fileCount}, Criteria: ${signal.factors.criteriaCount}, Deps: ${signal.factors.dependencyCount}`);
      console.log(`        Guidance: ${signal.guidance}`);
    }

    if (scanResult.problematicWOs.length > 5) {
      console.log(`      ... and ${scanResult.problematicWOs.length - 5} more problematic WOs`);
    }
  }

  console.log(''); // Empty line for readability

  // TODO V114: Log to database
  // const { error } = await supabase
  //   .from('complexity_scan_logs')
  //   .insert({
  //     spec_id: specId,
  //     scan_result: scanResult,
  //     total_wos: scanResult.total,
  //     healthy_count: scanResult.healthy,
  //     review_count: scanResult.review_recommended,
  //     oversized_count: scanResult.likely_oversized,
  //     problematic_percent: scanResult.problematicPercent
  //   });
}

/**
 * Analyzes scan results to determine if decomposition quality is acceptable
 *
 * Returns recommendations based on problematic percentage:
 * - <30%: Acceptable quality
 * - 30-50%: Review recommended
 * - >50%: High risk, consider refinement
 */
export function analyzeScanQuality(scanResult: ScanResult): {
  quality: 'acceptable' | 'needs_review' | 'high_risk';
  recommendation: string;
} {
  const problematicPct = scanResult.problematicPercent * 100;

  if (problematicPct < 30) {
    return {
      quality: 'acceptable',
      recommendation: 'Decomposition quality is good - proceed with execution'
    };
  } else if (problematicPct < 50) {
    return {
      quality: 'needs_review',
      recommendation: 'Consider reviewing oversized WOs before execution'
    };
  } else {
    return {
      quality: 'high_risk',
      recommendation: 'High percentage of oversized WOs - consider refining decomposition'
    };
  }
}
