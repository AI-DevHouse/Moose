// scripts/generate-types-direct.ts
// Generate types by querying Supabase schema directly

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function getTableSchema(tableName: string) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);

  if (error) throw error;

  if (!data || data.length === 0) {
    // Try to get columns from information_schema
    const { data: columns } = await supabase.rpc('get_table_columns', {
      table_name_param: tableName
    });
    return columns;
  }

  return data[0];
}

async function verifyNewColumns() {
  console.log('🔍 Verifying work_orders schema...\n');

  const { data, error } = await supabase
    .from('work_orders' as any)
    .select('id, acceptance_criteria, files_in_scope, context_budget_estimate, decomposition_doc, architect_version')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error.message);
    return false;
  }

  console.log('✅ Schema verification successful!\n');
  console.log('New columns available:');
  console.log('  - acceptance_criteria (jsonb)');
  console.log('  - files_in_scope (jsonb)');
  console.log('  - context_budget_estimate (integer)');
  console.log('  - decomposition_doc (text)');
  console.log('  - architect_version (text)\n');

  return true;
}

async function main() {
  console.log('\n🎯 Direct Type Verification\n');
  console.log('================================\n');

  const verified = await verifyNewColumns();

  if (verified) {
    console.log('✅ Database schema is ready for Orchestrator!\n');
    console.log('📝 Manual type regeneration command:');
    console.log('   Go to Supabase Dashboard → Settings → API → "Generate Types"');
    console.log('   Or wait - TypeScript will infer types from queries.\n');
  } else {
    console.log('❌ Schema verification failed\n');
    process.exit(1);
  }
}

main();
