import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('=== Running Budget Reservation Function Migration ===\n');

  const sqlPath = join(__dirname, 'create-budget-reservation-function.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  console.log('Executing SQL migration...');
  console.log('\n⚠️  Manual Step Required:');
  console.log('   1. Go to: https://supabase.com/dashboard/project/qclxdnbvoruvqnhsshjr/sql');
  console.log('   2. Copy the contents of: scripts/create-budget-reservation-function.sql');
  console.log('   3. Paste and execute in the SQL Editor');
  console.log('\nWaiting for you to run the SQL... Press Enter when done.');

  // Wait for user input
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  // Test the function
  console.log('\nTesting budget reservation function...');
  const { data: testData, error: testError } = await supabase.rpc('check_and_reserve_budget', {
    p_estimated_cost: 1.0,
    p_service_name: 'migration-test',
    p_metadata: { test: true }
  });

  if (testError) {
    console.error('❌ Function test failed:', testError);
    process.exit(1);
  }

  console.log('✅ Function test passed:', testData);
}

runMigration();
