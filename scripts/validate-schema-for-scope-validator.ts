// scripts/validate-schema-for-scope-validator.ts
// Validates database schema for WO Scope Validation feature
// Per Implementation Plan V113 Task 1

import { config } from 'dotenv';
import { resolve } from 'path';
import { createSupabaseServiceClient } from '../src/lib/supabase';

config({ path: resolve(__dirname, '../.env.local') });

const supabase = createSupabaseServiceClient();

async function main() {
  console.log('🔍 Validating schema for WO Scope Validator...\n');

  let allChecksPass = true;

  // Check 1: Query 5 sample WOs to verify structure
  console.log('1️⃣ Querying sample work orders...');
  const { data: sampleWOs, error } = await supabase
    .from('work_orders')
    .select('id, title, files_in_scope, acceptance_criteria, metadata, risk_level, context_budget_estimate')
    .limit(5);

  if (error) {
    console.error('❌ Failed to query work orders:', error.message);
    allChecksPass = false;
  } else if (!sampleWOs || sampleWOs.length === 0) {
    console.warn('⚠️  No work orders found in database');
    allChecksPass = false;
  } else {
    console.log(`✅ Retrieved ${sampleWOs.length} sample work orders\n`);

    // Check 2: Verify files_in_scope is Json type (not array)
    console.log('2️⃣ Checking files_in_scope type...');
    let filesInScopeValid = true;
    for (const wo of sampleWOs) {
      if (wo.files_in_scope !== null) {
        const isArray = Array.isArray(wo.files_in_scope);
        const isObject = typeof wo.files_in_scope === 'object';

        if (!isArray && !isObject) {
          console.error(`❌ WO ${wo.id}: files_in_scope is not Json type (got ${typeof wo.files_in_scope})`);
          filesInScopeValid = false;
        }
      }
    }

    if (filesInScopeValid) {
      console.log('✅ files_in_scope is Json type (can be array or object)\n');
    } else {
      allChecksPass = false;
    }

    // Check 3: Verify acceptance_criteria is Json type
    console.log('3️⃣ Checking acceptance_criteria type...');
    let acceptanceCriteriaValid = true;
    for (const wo of sampleWOs) {
      if (wo.acceptance_criteria !== null) {
        const isArray = Array.isArray(wo.acceptance_criteria);
        const isObject = typeof wo.acceptance_criteria === 'object';

        if (!isArray && !isObject) {
          console.error(`❌ WO ${wo.id}: acceptance_criteria is not Json type (got ${typeof wo.acceptance_criteria})`);
          acceptanceCriteriaValid = false;
        }
      }
    }

    if (acceptanceCriteriaValid) {
      console.log('✅ acceptance_criteria is Json type\n');
    } else {
      allChecksPass = false;
    }

    // Check 4: Verify metadata structure (where dependencies stored)
    console.log('4️⃣ Checking metadata structure...');
    let metadataValid = true;
    for (const wo of sampleWOs) {
      if (wo.metadata !== null) {
        const isObject = typeof wo.metadata === 'object';

        if (!isObject) {
          console.error(`❌ WO ${wo.id}: metadata is not an object (got ${typeof wo.metadata})`);
          metadataValid = false;
        } else {
          const metadata = wo.metadata as any;

          // Check if dependencies field exists when metadata is present
          if (metadata.dependencies !== undefined) {
            if (!Array.isArray(metadata.dependencies)) {
              console.warn(`⚠️  WO ${wo.id}: metadata.dependencies exists but is not an array`);
            }
          }
        }
      }
    }

    if (metadataValid) {
      console.log('✅ metadata structure is valid (Json object)\n');
    } else {
      allChecksPass = false;
    }

    // Check 5: Verify risk_level enum values
    console.log('5️⃣ Checking risk_level values...');
    const validRiskLevels = new Set(['low', 'medium', 'high']);
    let riskLevelValid = true;

    for (const wo of sampleWOs) {
      if (!validRiskLevels.has(wo.risk_level)) {
        console.error(`❌ WO ${wo.id}: risk_level has invalid value "${wo.risk_level}" (expected: low, medium, high)`);
        riskLevelValid = false;
      }
    }

    if (riskLevelValid) {
      console.log('✅ risk_level values are valid (low, medium, high)\n');
    } else {
      allChecksPass = false;
    }

    // Check 6: Verify context_budget_estimate exists
    console.log('6️⃣ Checking context_budget_estimate...');
    let contextBudgetValid = true;

    for (const wo of sampleWOs) {
      if (wo.context_budget_estimate === null) {
        console.warn(`⚠️  WO ${wo.id}: context_budget_estimate is null (will use default 1000)`);
      }
    }

    console.log('✅ context_budget_estimate field exists\n');

    // Print sample data structure
    console.log('📋 Sample WO structure:');
    if (sampleWOs[0]) {
      console.log(`   ID: ${sampleWOs[0].id}`);
      console.log(`   Title: ${sampleWOs[0].title}`);
      console.log(`   files_in_scope type: ${Array.isArray(sampleWOs[0].files_in_scope) ? 'array' : typeof sampleWOs[0].files_in_scope}`);
      console.log(`   files_in_scope count: ${Array.isArray(sampleWOs[0].files_in_scope) ? sampleWOs[0].files_in_scope.length : 'N/A'}`);
      console.log(`   acceptance_criteria type: ${Array.isArray(sampleWOs[0].acceptance_criteria) ? 'array' : typeof sampleWOs[0].acceptance_criteria}`);
      console.log(`   acceptance_criteria count: ${Array.isArray(sampleWOs[0].acceptance_criteria) ? sampleWOs[0].acceptance_criteria.length : 'N/A'}`);
      console.log(`   metadata: ${sampleWOs[0].metadata ? JSON.stringify(sampleWOs[0].metadata).substring(0, 100) + '...' : 'null'}`);
      console.log(`   risk_level: ${sampleWOs[0].risk_level}`);
      console.log(`   context_budget_estimate: ${sampleWOs[0].context_budget_estimate}`);
    }
  }

  // Final result
  console.log('\n' + '='.repeat(60));
  if (allChecksPass) {
    console.log('✅ Schema validation passed - safe to proceed with implementation');
  } else {
    console.log('❌ Schema validation failed - review errors above before continuing');
    process.exit(1);
  }
}

main().catch(console.error);
