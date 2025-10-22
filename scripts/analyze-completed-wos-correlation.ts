// Query COMPLETED work orders with acceptance scores to correlate complexity with quality
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  console.log('📊 Completed Work Orders - Complexity vs Quality Correlation\n');
  console.log('='.repeat(80));

  // Query ALL completed work orders (not limited by date)
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
      completed_at,
      created_at
    `)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (error) {
    console.error('❌ Database error:', error.message);
    process.exit(1);
  }

  if (!workOrders || workOrders.length === 0) {
    console.log('⚠️  No completed work orders found');
    process.exit(0);
  }

  console.log(`\nFound ${workOrders.length} completed work orders\n`);

  // Process and filter for those with acceptance scores
  const withScores = workOrders
    .map(wo => {
      const files_in_scope = wo.files_in_scope as any;
      const files_count = Array.isArray(files_in_scope) ? files_in_scope.length : 0;

      const acceptance_criteria = wo.acceptance_criteria as any;
      const criteria_count = Array.isArray(acceptance_criteria) ? acceptance_criteria.length : 0;

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
        calculated_complexity,
        category: categorize(calculated_complexity),
        final_score,
        todos,
        completed_at: wo.completed_at
      };
    })
    .filter(wo => wo.final_score !== null);

  console.log(`${withScores.length} completed WOs have acceptance scores\n`);

  if (withScores.length === 0) {
    console.log('⚠️  No acceptance scores found. Cannot perform correlation analysis.');
    console.log('    This suggests acceptance validation has not been run on completed WOs yet.');
    process.exit(0);
  }

  // Group by complexity category
  const grouped = {
    healthy: withScores.filter(wo => wo.category === 'healthy'),
    review_recommended: withScores.filter(wo => wo.category === 'review_recommended'),
    likely_oversized: withScores.filter(wo => wo.category === 'likely_oversized')
  };

  console.log('📈 Quality Metrics by Complexity Category:\n');
  console.log('┌─────────────────────┬───────┬──────────────┬───────────────┬──────────────┐');
  console.log('│ Category            │ Count │ Avg Score    │ Avg TODOs     │ Avg Files    │');
  console.log('├─────────────────────┼───────┼──────────────┼───────────────┼──────────────┤');

  Object.entries(grouped).forEach(([category, wos]) => {
    if (wos.length > 0) {
      const avgScore = wos.reduce((sum, wo) => sum + wo.final_score!, 0) / wos.length;
      const avgTodos = wos.filter(wo => wo.todos !== null).length > 0 ?
        wos.filter(wo => wo.todos !== null).reduce((sum, wo) => sum + wo.todos!, 0) /
        wos.filter(wo => wo.todos !== null).length : 0;
      const avgFiles = wos.reduce((sum, wo) => sum + wo.files_count, 0) / wos.length;

      console.log(
        `│ ${category.padEnd(19)} │ ${wos.length.toString().padStart(5)} │ ` +
        `${avgScore.toFixed(1).padStart(12)} │ ${avgTodos.toFixed(1).padStart(13)} │ ` +
        `${avgFiles.toFixed(1).padStart(12)} │`
      );
    }
  });

  console.log('└─────────────────────┴───────┴──────────────┴───────────────┴──────────────┘');

  // Correlation analysis
  console.log('\n\n📊 Detailed Correlation Analysis:\n');

  const healthyAvg = grouped.healthy.length > 0 ?
    grouped.healthy.reduce((sum, wo) => sum + wo.final_score!, 0) / grouped.healthy.length : null;
  const oversizedAvg = grouped.likely_oversized.length > 0 ?
    grouped.likely_oversized.reduce((sum, wo) => sum + wo.final_score!, 0) / grouped.likely_oversized.length : null;

  if (healthyAvg !== null && oversizedAvg !== null) {
    const scoreDelta = healthyAvg - oversizedAvg;
    console.log(`Score Delta (healthy vs oversized): ${scoreDelta > 0 ? '+' : ''}${scoreDelta.toFixed(1)} points`);
    console.log(`  Healthy avg:     ${healthyAvg.toFixed(1)}/100`);
    console.log(`  Oversized avg:   ${oversizedAvg.toFixed(1)}/100`);

    if (Math.abs(scoreDelta) < 5) {
      console.log(`  ⚠️  WEAK correlation - Score delta <5 points`);
    } else if (Math.abs(scoreDelta) >= 10) {
      console.log(`  ✅ STRONG correlation - Score delta ≥10 points`);
    } else {
      console.log(`  ℹ️  MODERATE correlation - Score delta 5-10 points`);
    }
  }

  // TODO correlation
  const healthyTodos = grouped.healthy.filter(wo => wo.todos !== null);
  const oversizedTodos = grouped.likely_oversized.filter(wo => wo.todos !== null);

  if (healthyTodos.length > 0 && oversizedTodos.length > 0) {
    const healthyTodoAvg = healthyTodos.reduce((sum, wo) => sum + wo.todos!, 0) / healthyTodos.length;
    const oversizedTodoAvg = oversizedTodos.reduce((sum, wo) => sum + wo.todos!, 0) / oversizedTodos.length;
    const todoDelta = oversizedTodoAvg - healthyTodoAvg;

    console.log(`\nTODO Delta (oversized vs healthy): ${todoDelta > 0 ? '+' : ''}${todoDelta.toFixed(1)}`);
    console.log(`  Healthy avg:     ${healthyTodoAvg.toFixed(1)} TODOs`);
    console.log(`  Oversized avg:   ${oversizedTodoAvg.toFixed(1)} TODOs`);
  }

  // Top failures
  console.log('\n\n❌ Top 10 Lowest-Scoring Completed WOs:\n');
  withScores
    .sort((a, b) => a.final_score! - b.final_score!)
    .slice(0, 10)
    .forEach((wo, idx) => {
      console.log(
        `${(idx + 1).toString().padStart(2)}. Score: ${wo.final_score!.toFixed(0).padStart(3)}/100 | ` +
        `${wo.files_count} files | ${wo.category.padEnd(20)}`
      );
      console.log(`    ${wo.title.substring(0, 70)}${wo.title.length > 70 ? '...' : ''}`);
    });

  console.log('\n' + '='.repeat(80));
  console.log('\n💡 KEY INSIGHTS:\n');

  if (withScores.length < 10) {
    console.log(`⚠️  Sample size is small (n=${withScores.length}) - findings may not be statistically significant`);
  }

  const oversizedPct = (grouped.likely_oversized.length / withScores.length) * 100;
  console.log(`• ${oversizedPct.toFixed(1)}% of completed WOs were "likely_oversized"`);

  if (healthyAvg !== null && oversizedAvg !== null && oversizedAvg < 75) {
    console.log(`• Oversized WOs average ${oversizedAvg.toFixed(0)}/100, below the 75-point quality target`);
  }

  console.log('\n');
}

main().catch(console.error);
