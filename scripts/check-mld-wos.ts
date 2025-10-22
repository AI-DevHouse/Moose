/**
 * Check MLD Work Orders for test comparison
 */

import { createSupabaseServiceClient } from '../src/lib/supabase';

async function checkMLDWorkOrders() {
  const supabase = createSupabaseServiceClient();
  const woIds = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 19, 20];

  console.log('Fetching MLD Work Orders for test comparison...\n');

  for (const id of woIds) {
    const { data: wo, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.log(`WO-${String(id).padStart(3, '0')}: Not found`);
      continue;
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`WO-${String(id).padStart(3, '0')}: ${wo.title}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Description: ${wo.description}`);
    console.log(`\nAcceptance Criteria:`);

    if (wo.acceptance_criteria) {
      if (Array.isArray(wo.acceptance_criteria)) {
        wo.acceptance_criteria.forEach((ac: any, index: number) => {
          console.log(`\n  AC-${String(index + 1).padStart(3, '0')}: ${ac.description || ac.criterion || ac}`);
        });
      } else if (typeof wo.acceptance_criteria === 'string') {
        console.log(`  ${wo.acceptance_criteria}`);
      } else {
        console.log(`  ${JSON.stringify(wo.acceptance_criteria, null, 2)}`);
      }
    } else {
      console.log('  None defined');
    }

    console.log(`\nMetadata:`);
    console.log(`  Status: ${wo.status}`);
    console.log(`  Priority: ${wo.priority || 'N/A'}`);
    console.log(`  Project: ${wo.project_id || 'N/A'}`);
  }
}

checkMLDWorkOrders().catch(console.error);
