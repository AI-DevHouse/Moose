import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function displayMigration() {
  console.log('🚀 Migration 004: Add acceptance_result to work_orders\n');
  console.log('=' .repeat(70));
  console.log('INSTRUCTIONS:');
  console.log('=' .repeat(70));
  console.log('');
  console.log('1. Open your Supabase dashboard');
  console.log('2. Navigate to SQL Editor');
  console.log('3. Copy and paste the SQL below');
  console.log('4. Run the query');
  console.log('');
  console.log('=' .repeat(70));
  console.log('SQL TO EXECUTE:');
  console.log('=' .repeat(70));
  console.log('');

  const migrationPath = path.join(__dirname, 'migrations', '004_add_acceptance_result.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log(sql);
  console.log('');
  console.log('=' .repeat(70));
  console.log('');
  console.log('After running the SQL:');
  console.log('');
  console.log('✅ You should see:');
  console.log('   - "✅ Migration 004 complete: acceptance_result column added to work_orders"');
  console.log('   - acceptance_result column added to work_orders table');
  console.log('   - idx_work_orders_acceptance_score index created');
  console.log('   - idx_work_orders_needs_review index created');
  console.log('');
  console.log('🔍 To verify, run this query:');
  console.log('');
  console.log('SELECT column_name, data_type, is_nullable');
  console.log('FROM information_schema.columns');
  console.log('WHERE table_name = \'work_orders\'');
  console.log('AND column_name = \'acceptance_result\';');
  console.log('');
  console.log('=' .repeat(70));
  console.log('');
  console.log('📋 Once applied, Phase 4 (Acceptance Validation) is ready!');
  console.log('');
}

displayMigration().catch(err => {
  console.error('💥 Error displaying migration:', err);
  process.exit(1);
});
