// Verify database schema and apply migration if needed
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyAndApply() {
  console.log('Checking projects table schema...\n');

  // Check if columns exist
  const { data: columns, error } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'projects'
        ORDER BY ordinal_position;
      `
    })
    .single();

  if (error) {
    console.log('Could not query schema directly. Trying alternative method...\n');

    // Try to create a test project to see what columns are available
    const { data: testProject, error: testError } = await supabase
      .from('projects')
      .select('*')
      .limit(1)
      .single();

    if (testProject) {
      console.log('✅ Existing project columns:', Object.keys(testProject));

      if (!testProject.github_org && testProject.github_org !== null) {
        console.log('\n❌ Migration 002 columns NOT found!');
        console.log('Applying migration 002...\n');

        // Read and apply migration
        const migration = fs.readFileSync('scripts/migrations/002_add_project_infrastructure.sql', 'utf-8');

        const { error: migError } = await supabase.rpc('exec_sql', {
          query: migration
        });

        if (migError) {
          console.error('❌ Failed to apply migration:', migError.message);
          console.log('\nPlease apply manually via Supabase SQL Editor:');
          console.log(migration);
        } else {
          console.log('✅ Migration 002 applied successfully!');
        }
      } else {
        console.log('\n✅ Migration 002 columns found! Schema is up to date.');
      }
    } else {
      console.log('\n⚠️  No projects in database yet. Will apply migration now...\n');

      // Read and apply migration
      const migration = fs.readFileSync('scripts/migrations/002_add_project_infrastructure.sql', 'utf-8');
      console.log(migration);
      console.log('\nPlease copy the SQL above and run it in Supabase SQL Editor.');
    }
  } else {
    console.log('Columns:', columns);
  }
}

verifyAndApply().catch(console.error);
