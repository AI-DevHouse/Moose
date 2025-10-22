#!/usr/bin/env tsx

import { createSupabaseServiceClient } from '../src/lib/supabase';

async function getWODetails() {
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from('work_orders')
    .select('*')
    .ilike('title', '%Redux Toolkit%')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Work Order Details:');
  console.log('==================');
  console.log('ID:', data.id);
  console.log('Title:', data.title);
  console.log('Complexity:', data.complexity_score);
  console.log('\nDescription:');
  console.log(data.description);
  console.log('\nAcceptance Criteria:');
  if (typeof data.acceptance_criteria === 'string') {
    console.log(data.acceptance_criteria);
  } else {
    console.log(JSON.stringify(data.acceptance_criteria, null, 2));
  }
}

getWODetails().catch(console.error);
