import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function displayMigration() {
  console.log('🚀 Migration 002: Add Project Infrastructure Fields\n');
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

  const migrationPath = path.join(__dirname, 'migrations', '002_add_project_infrastructure.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log(sql);
  console.log('');
  console.log('=' .repeat(70));
  console.log('');
  console.log('After running the SQL:');
  console.log('');
  console.log('✅ You should see:');
  console.log('   - github_org column added to projects');
  console.log('   - supabase_project_url column added');
  console.log('   - supabase_anon_key column added');
  console.log('   - vercel_team_id column added');
  console.log('   - infrastructure_status column added');
  console.log('   - setup_notes column added');
  console.log('');
  console.log('🔍 To verify, run this query:');
  console.log('');
  console.log('SELECT column_name, data_type, is_nullable');
  console.log('FROM information_schema.columns');
  console.log('WHERE table_name = \'projects\'');
  console.log('AND column_name IN (\'github_org\', \'supabase_project_url\', \'infrastructure_status\');');
  console.log('');
  console.log('=' .repeat(70));
  console.log('');
  console.log('📋 Once applied, you can use the new project setup wizard!');
  console.log('');
}

displayMigration().catch(err => {
  console.error('💥 Error displaying migration:', err);
  process.exit(1);
});
