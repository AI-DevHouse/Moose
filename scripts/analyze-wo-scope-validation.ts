// Script to analyze historical work orders for scope validation proposal
// Implements queries from Strategy C proposal to validate the problem exists

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface WorkOrderData {
  id: string;
  title: string;
  files_count: number;
  criteria_count: number;
  deps_count: number;
  tokens: number;
  risk_level: string;
  complexity_score: number;
  calculated_complexity: number;
  final_score: number | null;
  todos: number | null;
  status: string;
}

// Complexity calculation formula from proposal
function calculateComplexity(
  files: number,
  criteria: number,
  deps: number,
  tokens: number,
  riskLevel: string
): number {
  const riskMultiplier =
    riskLevel === 'low' ? 0.3 :
    riskLevel === 'medium' ? 0.6 :
    riskLevel === 'high' ? 1.0 : 0.5;

  return (
    (files / 6) * 0.30 +
    (criteria / 8) * 0.25 +
    (deps / 4) * 0.15 +
    (tokens / 4000) * 0.20 +
    riskMultiplier * 0.10
  );
}

function categorize(complexity: number): string {
  if (complexity < 0.55) return 'healthy';
  if (complexity < 0.70) return 'review_recommended';
  return 'likely_oversized';
}

async function main() {
  console.log('📊 Work Order Scope Validation Analysis\n');
  console.log('=' .repeat(80));

  // Query 1: Historical analysis of completed work orders
  console.log('\n🔍 Query 1: Historical Work Order Analysis (Last 30 Days)\n');

  const { data: workOrders, error } = await supabase
    .from('work_orders')
    .select(`
      id,
      title,
      files_in_scope,
      acceptance_criteria,
      context_budget_estimate,
      risk_level,
      status,
      metadata,
      created_at
    `)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Database error:', error.message);
    process.exit(1);
  }

  if (!workOrders || workOrders.length === 0) {
    console.log('⚠️  No work orders found in the last 30 days');
    process.exit(0);
  }

  console.log(`Found ${workOrders.length} work orders in last 30 days\n`);

  // Process data
  const processedData: WorkOrderData[] = workOrders.map(wo => {
    const files_in_scope = wo.files_in_scope as any;
    const files_count = Array.isArray(files_in_scope) ? files_in_scope.length : 0;

    const acceptance_criteria = wo.acceptance_criteria as any;
    const criteria_count = Array.isArray(acceptance_criteria) ? acceptance_criteria.length : 0;

    // Extract deps from metadata if available
    const metadata = wo.metadata as any;
    const deps_count = metadata?.dependencies?.length || 0;

    const tokens = wo.context_budget_estimate || 1000;
    const risk_level = wo.risk_level || 'low';

    const calculated_complexity = calculateComplexity(
      files_count,
      criteria_count,
      deps_count,
      tokens,
      risk_level
    );

    // Extract acceptance results from metadata
    const acceptance_result = metadata?.acceptance_result;
    const final_score = acceptance_result?.acceptance_score ?
      parseFloat(acceptance_result.acceptance_score) : null;
    const todos = acceptance_result?.todo_count ?
      parseInt(acceptance_result.todo_count) : null;

    return {
      id: wo.id,
      title: wo.title,
      files_count,
      criteria_count,
      deps_count,
      tokens,
      risk_level,
      complexity_score: metadata?.complexity_score || 0,
      calculated_complexity,
      final_score,
      todos,
      status: wo.status
    };
  });

  // Categorize by complexity
  const categorized = {
    healthy: processedData.filter(wo => categorize(wo.calculated_complexity) === 'healthy'),
    review_recommended: processedData.filter(wo => categorize(wo.calculated_complexity) === 'review_recommended'),
    likely_oversized: processedData.filter(wo => categorize(wo.calculated_complexity) === 'likely_oversized')
  };

  // Calculate statistics
  const stats = {
    healthy: {
      count: categorized.healthy.length,
      avg_score: avg(categorized.healthy.filter(wo => wo.final_score !== null).map(wo => wo.final_score!)),
      avg_todos: avg(categorized.healthy.filter(wo => wo.todos !== null).map(wo => wo.todos!)),
      avg_files: avg(categorized.healthy.map(wo => wo.files_count)),
      avg_criteria: avg(categorized.healthy.map(wo => wo.criteria_count)),
      completed: categorized.healthy.filter(wo => wo.status === 'completed').length
    },
    review_recommended: {
      count: categorized.review_recommended.length,
      avg_score: avg(categorized.review_recommended.filter(wo => wo.final_score !== null).map(wo => wo.final_score!)),
      avg_todos: avg(categorized.review_recommended.filter(wo => wo.todos !== null).map(wo => wo.todos!)),
      avg_files: avg(categorized.review_recommended.map(wo => wo.files_count)),
      avg_criteria: avg(categorized.review_recommended.map(wo => wo.criteria_count)),
      completed: categorized.review_recommended.filter(wo => wo.status === 'completed').length
    },
    likely_oversized: {
      count: categorized.likely_oversized.length,
      avg_score: avg(categorized.likely_oversized.filter(wo => wo.final_score !== null).map(wo => wo.final_score!)),
      avg_todos: avg(categorized.likely_oversized.filter(wo => wo.todos !== null).map(wo => wo.todos!)),
      avg_files: avg(categorized.likely_oversized.map(wo => wo.files_count)),
      avg_criteria: avg(categorized.likely_oversized.map(wo => wo.criteria_count)),
      completed: categorized.likely_oversized.filter(wo => wo.status === 'completed').length
    }
  };

  console.log('📈 Distribution by Complexity Category:\n');
  console.log('┌─────────────────────┬───────┬──────────┬────────────┬───────────┬──────────────┬───────────┐');
  console.log('│ Category            │ Count │ % Total  │ Avg Score  │ Avg TODOs │ Avg Files    │ Completed │');
  console.log('├─────────────────────┼───────┼──────────┼────────────┼───────────┼──────────────┼───────────┤');

  Object.entries(stats).forEach(([category, data]) => {
    const pct = ((data.count / processedData.length) * 100).toFixed(1);
    const score = data.avg_score !== null ? data.avg_score.toFixed(1) : 'N/A';
    const todos = data.avg_todos !== null ? data.avg_todos.toFixed(1) : 'N/A';

    console.log(
      `│ ${category.padEnd(19)} │ ${data.count.toString().padStart(5)} │ ${pct.padStart(7)}% │ ` +
      `${score.padStart(10)} │ ${todos.padStart(9)} │ ${data.avg_files.toFixed(1).padStart(12)} │ ` +
      `${data.completed.toString().padStart(9)} │`
    );
  });

  console.log('└─────────────────────┴───────┴──────────┴────────────┴───────────┴──────────────┴───────────┘');

  // Query 2: Large work orders (6+ files)
  console.log('\n\n🔍 Query 2: Large Work Orders (6+ files)\n');

  const largeWOs = processedData.filter(wo => wo.files_count >= 6);

  console.log(`Found ${largeWOs.length} work orders with 6+ files (${((largeWOs.length / processedData.length) * 100).toFixed(1)}% of total)\n`);

  if (largeWOs.length > 0) {
    console.log('Top 10 largest by file count:\n');
    largeWOs
      .sort((a, b) => b.files_count - a.files_count)
      .slice(0, 10)
      .forEach((wo, idx) => {
        const scoreStr = wo.final_score !== null ? `${wo.final_score}/100` : 'N/A';
        const todosStr = wo.todos !== null ? wo.todos.toString() : 'N/A';
        console.log(
          `${(idx + 1).toString().padStart(2)}. ${wo.files_count} files, ${wo.criteria_count} criteria | ` +
          `Score: ${scoreStr.padStart(6)} | TODOs: ${todosStr.padStart(3)} | ${categorize(wo.calculated_complexity).padEnd(20)}`
        );
        console.log(`    ${wo.title.substring(0, 70)}${wo.title.length > 70 ? '...' : ''}`);
      });
  }

  // Query 3: Correlation analysis
  console.log('\n\n📊 Query 3: Correlation Analysis\n');

  const completedWithScores = processedData.filter(wo => wo.final_score !== null && wo.status === 'completed');

  if (completedWithScores.length > 0) {
    console.log(`Analyzing ${completedWithScores.length} completed WOs with acceptance scores\n`);

    // Group by file count ranges
    const fileRanges = [
      { min: 1, max: 3, label: '1-3 files' },
      { min: 4, max: 5, label: '4-5 files' },
      { min: 6, max: 8, label: '6-8 files' },
      { min: 9, max: 100, label: '9+ files' }
    ];

    console.log('Acceptance Score by File Count:\n');
    fileRanges.forEach(range => {
      const wosInRange = completedWithScores.filter(
        wo => wo.files_count >= range.min && wo.files_count <= range.max
      );

      if (wosInRange.length > 0) {
        const avgScore = avg(wosInRange.map(wo => wo.final_score!));
        const avgTodos = avg(wosInRange.filter(wo => wo.todos !== null).map(wo => wo.todos!));

        console.log(
          `  ${range.label.padEnd(12)}: ${wosInRange.length.toString().padStart(3)} WOs | ` +
          `Avg Score: ${avgScore.toFixed(1).padStart(5)} | Avg TODOs: ${(avgTodos || 0).toFixed(1).padStart(4)}`
        );
      }
    });
  }

  // Query 4: Threshold tuning
  console.log('\n\n⚙️  Query 4: Threshold Tuning Simulations\n');

  const thresholdScenarios = [
    { healthy: 0.45, review: 0.60, label: 'Strict' },
    { healthy: 0.50, review: 0.65, label: 'Moderate' },
    { healthy: 0.55, review: 0.70, label: 'Proposed' },
    { healthy: 0.60, review: 0.75, label: 'Lenient' }
  ];

  console.log('Threshold Scenarios:\n');
  thresholdScenarios.forEach(scenario => {
    const wouldRefine = processedData.filter(wo =>
      wo.calculated_complexity >= scenario.healthy && wo.calculated_complexity < scenario.review
    ).length;

    const wouldRedecompose = processedData.filter(wo =>
      wo.calculated_complexity >= scenario.review
    ).length;

    const pctProblematic = ((wouldRefine + wouldRedecompose) / processedData.length) * 100;

    console.log(
      `  ${scenario.label.padEnd(10)} (${scenario.healthy}/${scenario.review}): ` +
      `${wouldRefine.toString().padStart(3)} refine + ${wouldRedecompose.toString().padStart(3)} redo = ` +
      `${pctProblematic.toFixed(1).padStart(5)}% problematic`
    );
  });

  // Problem validation summary
  console.log('\n\n' + '='.repeat(80));
  console.log('🎯 PROBLEM VALIDATION SUMMARY\n');

  const problematicPct = ((stats.review_recommended.count + stats.likely_oversized.count) / processedData.length) * 100;
  const scoreDelta = (stats.healthy.avg_score || 0) - (stats.likely_oversized.avg_score || 0);
  const todoDelta = (stats.likely_oversized.avg_todos || 0) - (stats.healthy.avg_todos || 0);

  console.log(`1. PROBLEM MAGNITUDE:`);
  console.log(`   • ${problematicPct.toFixed(1)}% of WOs are potentially oversized (review_recommended + likely_oversized)`);
  console.log(`   • ${stats.likely_oversized.count} WOs are "likely_oversized" (${((stats.likely_oversized.count / processedData.length) * 100).toFixed(1)}%)`);

  console.log(`\n2. IMPACT ON QUALITY:`);
  if (stats.healthy.avg_score !== null && stats.likely_oversized.avg_score !== null) {
    console.log(`   • Acceptance score delta: ${scoreDelta.toFixed(1)} points (healthy: ${stats.healthy.avg_score.toFixed(1)}, oversized: ${stats.likely_oversized.avg_score.toFixed(1)})`);
  }
  if (stats.healthy.avg_todos !== null && stats.likely_oversized.avg_todos !== null) {
    console.log(`   • TODO count delta: +${todoDelta.toFixed(1)} (healthy: ${stats.healthy.avg_todos.toFixed(1)}, oversized: ${stats.likely_oversized.avg_todos.toFixed(1)})`);
  }

  console.log(`\n3. RECOMMENDATION:`);
  if (problematicPct < 10) {
    console.log(`   ❌ Problem is NOT significant (<10% problematic) - DO NOT IMPLEMENT`);
  } else if (problematicPct < 20) {
    console.log(`   ⚠️  Problem is MODERATE (10-20% problematic) - Consider lighter solution`);
  } else {
    console.log(`   ✅ Problem is SIGNIFICANT (>20% problematic) - Strategy C worth investigating`);
  }

  if (stats.healthy.avg_score !== null && stats.likely_oversized.avg_score !== null) {
    if (scoreDelta < 5) {
      console.log(`   ⚠️  Score correlation is WEAK (<5 point delta) - Oversized WOs may not be the root cause`);
    } else if (scoreDelta >= 10) {
      console.log(`   ✅ Score correlation is STRONG (${scoreDelta.toFixed(1)} point delta) - Clear quality impact`);
    } else {
      console.log(`   ℹ️  Score correlation is MODERATE (${scoreDelta.toFixed(1)} point delta)`);
    }
  }

  console.log('\n' + '='.repeat(80));

  // Export detailed data for further analysis
  const exportData = {
    summary: {
      total_wos: processedData.length,
      date_range: '30 days',
      categories: stats,
      problematic_pct: problematicPct,
      score_delta: scoreDelta,
      todo_delta: todoDelta
    },
    large_wos: largeWOs.map(wo => ({
      id: wo.id,
      title: wo.title,
      files: wo.files_count,
      criteria: wo.criteria_count,
      complexity: wo.calculated_complexity,
      score: wo.final_score,
      todos: wo.todos,
      category: categorize(wo.calculated_complexity)
    })),
    threshold_analysis: thresholdScenarios.map(scenario => ({
      label: scenario.label,
      thresholds: scenario,
      would_refine: processedData.filter(wo =>
        wo.calculated_complexity >= scenario.healthy && wo.calculated_complexity < scenario.review
      ).length,
      would_redo: processedData.filter(wo =>
        wo.calculated_complexity >= scenario.review
      ).length
    }))
  };

  console.log('\n💾 Full analysis data available for export if needed\n');
}

function avg(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

main().catch(console.error);
