/**
 * Find the most complex, code-heavy work order
 */

import { createSupabaseServiceClient } from '../src/lib/supabase';

async function findMostComplexWO() {
  const supabase = createSupabaseServiceClient();

  console.log('🔍 Finding most complex, code-heavy work order...\n');

  const { data: wos, error } = await supabase
    .from('work_orders')
    .select('id, title, description, acceptance_criteria, complexity_score, status')
    .eq('status', 'pending')
    .not('acceptance_criteria', 'is', null)
    .order('complexity_score', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!wos || wos.length === 0) {
    console.log('⚠️  No pending work orders found');
    return;
  }

  console.log('Top 10 Most Complex Work Orders:\n');
  console.log('='.repeat(100));

  wos.forEach((wo, idx) => {
    const acCount = Array.isArray(wo.acceptance_criteria) ? wo.acceptance_criteria.length : 0;
    const complexity = wo.complexity_score || 0;

    console.log(`\n${idx + 1}. [Complexity: ${complexity.toFixed(2)}/10] [ACs: ${acCount}]`);
    console.log(`   ID: ${wo.id.substring(0, 8)}...`);
    console.log(`   Title: ${wo.title}`);
    console.log(`   Description: ${wo.description?.substring(0, 150)}...`);
  });

  // Select the most complex one
  const mostComplex = wos[0];
  console.log('\n' + '='.repeat(100));
  console.log('\n🎯 SELECTED FOR TESTING:\n');
  console.log(`Title: ${mostComplex.title}`);
  console.log(`ID: ${mostComplex.id}`);
  console.log(`Complexity: ${mostComplex.complexity_score}/10`);
  console.log(`Acceptance Criteria Count: ${mostComplex.acceptance_criteria?.length || 0}`);
  console.log(`\nDescription:`);
  console.log(mostComplex.description);
  console.log(`\nAcceptance Criteria:`);

  if (Array.isArray(mostComplex.acceptance_criteria)) {
    mostComplex.acceptance_criteria.forEach((ac: string, idx: number) => {
      console.log(`  AC-${String(idx + 1).padStart(3, '0')}: ${ac}`);
    });
  }

  return mostComplex;
}

findMostComplexWO().catch(console.error);
