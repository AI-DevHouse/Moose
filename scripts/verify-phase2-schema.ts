/**
 * Verify Phase 2 Database Schema
 *
 * Checks that all Phase 2 schema changes were applied correctly:
 * - failure_class_enum exists
 * - outcome_vectors extended with failure_class, error_context
 * - escalations extended with failure_class, resolved_by
 * - decision_logs has work_order_id
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

async function verifySchema() {
  console.log('🔍 Verifying Phase 2 Database Schema...\n');

  let allPassed = true;

  // Test 1: Check failure_class_enum exists
  try {
    const { data, error } = await supabase
      .from('outcome_vectors')
      .select('failure_class')
      .limit(1);

    if (error) {
      console.error('❌ Test 1 FAILED: failure_class column not found in outcome_vectors');
      console.error('   Error:', error.message);
      allPassed = false;
    } else {
      console.log('✅ Test 1 PASSED: failure_class column exists in outcome_vectors');
    }
  } catch (err) {
    console.error('❌ Test 1 FAILED:', err);
    allPassed = false;
  }

  // Test 2: Check error_context column in outcome_vectors
  try {
    const { data, error } = await supabase
      .from('outcome_vectors')
      .select('error_context')
      .limit(1);

    if (error) {
      console.error('❌ Test 2 FAILED: error_context column not found in outcome_vectors');
      console.error('   Error:', error.message);
      allPassed = false;
    } else {
      console.log('✅ Test 2 PASSED: error_context column exists in outcome_vectors');
    }
  } catch (err) {
    console.error('❌ Test 2 FAILED:', err);
    allPassed = false;
  }

  // Test 3: Check failure_class column in escalations
  try {
    const { data, error } = await supabase
      .from('escalations')
      .select('failure_class')
      .limit(1);

    if (error) {
      console.error('❌ Test 3 FAILED: failure_class column not found in escalations');
      console.error('   Error:', error.message);
      allPassed = false;
    } else {
      console.log('✅ Test 3 PASSED: failure_class column exists in escalations');
    }
  } catch (err) {
    console.error('❌ Test 3 FAILED:', err);
    allPassed = false;
  }

  // Test 4: Check resolved_by column in escalations
  try {
    const { data, error } = await supabase
      .from('escalations')
      .select('resolved_by')
      .limit(1);

    if (error) {
      console.error('❌ Test 4 FAILED: resolved_by column not found in escalations');
      console.error('   Error:', error.message);
      allPassed = false;
    } else {
      console.log('✅ Test 4 PASSED: resolved_by column exists in escalations');
    }
  } catch (err) {
    console.error('❌ Test 4 FAILED:', err);
    allPassed = false;
  }

  // Test 5: Check work_order_id column in decision_logs
  try {
    const { data, error } = await supabase
      .from('decision_logs')
      .select('work_order_id')
      .limit(1);

    if (error) {
      console.error('❌ Test 5 FAILED: work_order_id column not found in decision_logs');
      console.error('   Error:', error.message);
      allPassed = false;
    } else {
      console.log('✅ Test 5 PASSED: work_order_id column exists in decision_logs');
    }
  } catch (err) {
    console.error('❌ Test 5 FAILED:', err);
    allPassed = false;
  }

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED - Phase 2 schema is correct!');
  } else {
    console.log('❌ SOME TESTS FAILED - Please check the schema');
    process.exit(1);
  }
}

verifySchema().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
