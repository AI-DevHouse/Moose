// Apply Migration 001: Add Projects Table
// Run with: node scripts/apply-migration-001.mjs
//
// NOTE: This script requires Supabase SQL Editor or service_role key
// For security, we'll display the SQL and instructions instead of executing directly

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function displayMigration() {
  console.log('🚀 Migration 001: Add Projects Table\n');
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

  const migrationPath = path.join(__dirname, 'migrations', '001_add_projects_table.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log(sql);
  console.log('');
  console.log('=' .repeat(70));
  console.log('');
  console.log('After running the SQL:');
  console.log('');
  console.log('✅ You should see:');
  console.log('   - projects table created');
  console.log('   - project_id column added to work_orders');
  console.log('   - Indexes created');
  console.log('   - Trigger created');
  console.log('');
  console.log('🔍 To verify, run this query:');
  console.log('');
  console.log('SELECT column_name, data_type');
  console.log('FROM information_schema.columns');
  console.log('WHERE table_name = \'projects\';');
  console.log('');
  console.log('SELECT column_name, data_type');
  console.log('FROM information_schema.columns');
  console.log('WHERE table_name = \'work_orders\' AND column_name = \'project_id\';');
  console.log('');
  console.log('=' .repeat(70));
  console.log('');
  console.log('📋 Once applied, proceed with Phase 1 implementation!');
  console.log('');
}

displayMigration().catch(err => {
  console.error('💥 Error displaying migration:', err);
  process.exit(1);
});
