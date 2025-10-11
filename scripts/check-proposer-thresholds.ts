import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkThresholds() {
  const { data, error } = await supabase
    .from('proposer_configs')
    .select('name, model, provider, complexity_threshold, active')
    .eq('active', true);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📋 PROPOSER CONFIGURATION');
  console.log('='.repeat(60));
  data?.forEach(p => {
    console.log(`\n${p.name}:`);
    console.log(`  Model: ${p.model}`);
    console.log(`  Provider: ${p.provider}`);
    console.log(`  Complexity Threshold (max ceiling): ${p.complexity_threshold}`);
    console.log(`  Active: ${p.active}`);
  });
  console.log('\n' + '='.repeat(60));
}

checkThresholds();
