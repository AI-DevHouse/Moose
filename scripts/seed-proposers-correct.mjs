// Seed proposer configs with CORRECT column names
// Run with: node scripts/seed-proposers-correct.mjs

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const SUPABASE_KEY = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seedProposers() {
  console.log('🌱 Seeding proposer configs with correct schema...\n');

  // Use actual column names from the database
  const proposers = [
    {
      id: 'a40c5caf-b0fb-4a8b-a544-ca82bb2ab939',
      name: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      complexity_threshold: 0.7,
      cost_profile: {
        input_cost_per_token: 0.000003,
        output_cost_per_token: 0.000015,
        currency: 'USD'
      }
    },
    {
      id: 'b50d6dbf-c1fc-4b9c-b655-db93cc3bc940',
      name: 'gpt-4o-mini',
      provider: 'openai',
      complexity_threshold: 0.5,
      cost_profile: {
        input_cost_per_token: 0.00000015,
        output_cost_per_token: 0.0000006,
        currency: 'USD'
      }
    }
  ];

  for (const proposer of proposers) {
    console.log(`📝 Upserting: ${proposer.name}`);

    const { data, error } = await supabase
      .from('proposer_configs')
      .upsert(proposer, { onConflict: 'id' })
      .select();

    if (error) {
      console.error(`   ❌ Error: ${error.message}`);
      console.error(`   Details: ${JSON.stringify(error, null, 2)}`);
    } else {
      console.log(`   ✅ Success`);
    }
  }

  // Verify
  console.log('\n🔍 Verifying...\n');
  const { data: all, error } = await supabase
    .from('proposer_configs')
    .select('*')
    .order('complexity_threshold', { ascending: false });

  if (error) {
    console.error('❌ Verification failed:', error.message);
  } else if (all && all.length > 0) {
    console.log(`✅ Found ${all.length} proposers:`);
    console.table(all.map(p => ({
      name: p.name,
      provider: p.provider,
      threshold: p.complexity_threshold
    })));
  } else {
    console.log('⚠️  No proposers found');
  }
}

seedProposers().catch(err => {
  console.error('💥 Seed failed:', err);
  process.exit(1);
});
