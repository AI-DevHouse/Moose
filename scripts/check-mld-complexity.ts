/**
 * Check complexity of the MLD WOs we identified earlier
 */

import { createSupabaseServiceClient } from '../src/lib/supabase';

async function checkMLDComplexity() {
  const supabase = createSupabaseServiceClient();

  const mldWoIds = [
    '3e1922cb-e548-40b3-a59c-1ddcdda85320', // Redux Middleware
    'fb95216c-5f7c-4541-a295-8ae6cdbe932d', // IPC Client
    '787c6dd1-e0c4-490a-95af-a851e07996b1', // Clipboard-WebView Coordination
    '8bfcedb8-0236-49f9-bd00-15e8fe6f7263', // ChatGPT Provider
    'a7bb6c49-822b-42bb-a958-03d80e074a5f', // Parser Recognition
    '24f96d7f-ea9a-479c-ab25-609ac1dc7d9c', // Termination Marker
    'a97e01e0-b661-4396-9aa8-7cfafadd6be0'  // Provider Panel
  ];

  console.log('🔍 Checking MLD Work Orders for complexity...\n');

  const results = [];

  for (const id of mldWoIds) {
    const { data: wo, error } = await supabase
      .from('work_orders')
      .select('id, title, description, acceptance_criteria, complexity_score, status')
      .eq('id', id)
      .single();

    if (error) continue;

    const acCount = Array.isArray(wo.acceptance_criteria) ? wo.acceptance_criteria.length : 0;
    results.push({ wo, acCount });
  }

  // Sort by complexity and AC count
  results.sort((a, b) => {
    const complexityA = a.wo.complexity_score || 0;
    const complexityB = b.wo.complexity_score || 0;
    if (complexityB !== complexityA) return complexityB - complexityA;
    return b.acCount - a.acCount;
  });

  console.log('='.repeat(100));
  results.forEach((result, idx) => {
    const { wo, acCount } = result;
    console.log(`\n${idx + 1}. [Complexity: ${(wo.complexity_score || 0).toFixed(2)}/10] [ACs: ${acCount}] [Status: ${wo.status}]`);
    console.log(`   ${wo.title}`);
    console.log(`   ID: ${wo.id.substring(0, 8)}...`);
  });

  const selected = results[0].wo;
  console.log('\n' + '='.repeat(100));
  console.log('\n🎯 MOST COMPLEX MLD WO:\n');
  console.log(`Title: ${selected.title}`);
  console.log(`ID: ${selected.id}`);
  console.log(`Complexity: ${selected.complexity_score || 0}/10`);
  console.log(`Status: ${selected.status}`);
  console.log(`Acceptance Criteria: ${Array.isArray(selected.acceptance_criteria) ? selected.acceptance_criteria.length : 0}`);

  console.log(`\nDescription:`);
  console.log(selected.description);

  console.log(`\nAcceptance Criteria:`);
  if (Array.isArray(selected.acceptance_criteria)) {
    selected.acceptance_criteria.forEach((ac: string, idx: number) => {
      console.log(`  AC-${String(idx + 1).padStart(3, '0')}: ${ac}`);
    });
  }

  return selected;
}

checkMLDComplexity().catch(console.error);
