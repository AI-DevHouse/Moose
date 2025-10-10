// Check budget configuration in database
import { createSupabaseServiceClient } from '@/lib/supabase';

async function checkBudgetConfig() {
  const supabase = createSupabaseServiceClient();

  console.log('Checking system_config for budget settings...\n');

  // Check budget_limits
  const { data: budgetLimits, error: limitsError } = await supabase
    .from('system_config')
    .select('*')
    .eq('key', 'budget_limits')
    .single();

  console.log('='.repeat(80));
  console.log('budget_limits (used by manager-routing-rules):');
  console.log('='.repeat(80));
  if (budgetLimits) {
    console.log(JSON.stringify(JSON.parse(budgetLimits.value), null, 2));
  } else {
    console.log('❌ NOT FOUND IN DATABASE');
    console.log('Will use defaults from code');
  }

  // Check budget_thresholds
  const { data: budgetThresholds, error: thresholdsError } = await supabase
    .from('system_config')
    .select('*')
    .eq('key', 'budget_thresholds')
    .single();

  console.log('\n' + '='.repeat(80));
  console.log('budget_thresholds (used by client-manager-service):');
  console.log('='.repeat(80));
  if (budgetThresholds) {
    console.log(JSON.stringify(JSON.parse(budgetThresholds.value), null, 2));
  } else {
    console.log('❌ NOT FOUND IN DATABASE');
    console.log('Will use hardcoded defaults:');
    console.log(JSON.stringify({
      soft_cap: 20,
      hard_cap: 50,
      emergency_kill: 100
    }, null, 2));
  }

  // Check all config keys
  const { data: allConfigs } = await supabase
    .from('system_config')
    .select('key, value');

  console.log('\n' + '='.repeat(80));
  console.log('All system_config keys:');
  console.log('='.repeat(80));
  allConfigs?.forEach(config => {
    console.log(`- ${config.key}`);
  });
}

checkBudgetConfig().catch(console.error);
