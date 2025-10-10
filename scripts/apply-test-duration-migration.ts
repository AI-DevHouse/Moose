import { createSupabaseServiceClient } from '../src/lib/supabase'
import * as fs from 'fs'
import * as path from 'path'

async function applyMigration() {
  const supabase = createSupabaseServiceClient()

  console.log('📝 Applying test_duration_ms column migration...\n')

  // Read the SQL file
  const sqlPath = path.join(__dirname, 'add-test-duration-column.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  // Execute the migration
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

  if (error) {
    // Try direct approach if RPC doesn't exist
    console.log('Trying direct ALTER TABLE approach...')

    const { error: alterError } = await supabase
      .from('outcome_vectors')
      .select('test_duration_ms')
      .limit(0)

    if (alterError && alterError.message.includes('column')) {
      console.log('❌ Column does not exist. You need to add it via Supabase dashboard SQL editor.')
      console.log('\nPlease run this SQL in your Supabase SQL editor:')
      console.log('=' .repeat(60))
      console.log(sql)
      console.log('=' .repeat(60))
      console.log('\nURL: https://supabase.com/dashboard/project/{your-project}/sql')
      process.exit(1)
    } else {
      console.log('✅ Column already exists or migration already applied!')
    }
  } else {
    console.log('✅ Migration applied successfully!')
  }

  // Verify the column exists
  const { error: verifyError } = await supabase
    .from('outcome_vectors')
    .select('test_duration_ms')
    .limit(1)

  if (verifyError) {
    console.log('\n⚠️  Verification failed:', verifyError.message)
    console.log('\nPlease manually add the column via Supabase dashboard.')
  } else {
    console.log('✅ Verified: test_duration_ms column exists!')
  }
}

applyMigration().catch(console.error)
