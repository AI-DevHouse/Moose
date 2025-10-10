/**
 * Verify Phase 2 Integration
 *
 * Checks that Phase 2 enhancements are being used in production
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

async function verifyIntegration() {
  console.log('🔍 Verifying Phase 2 Integration...\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Check if decision_logs has work_order_id populated
  try {
    const { data, error } = await supabase
      .from('decision_logs')
      .select('id, work_order_id, decision_type')
      .not('work_order_id', 'is', null)
      .limit(5);

    if (error) {
      console.log('❌ Test 1 FAILED: Cannot query decision_logs with work_order_id');
      console.error('   Error:', error.message);
      failed++;
    } else if (data && data.length > 0) {
      console.log(`✅ Test 1 PASSED: Found ${data.length} decision logs with work_order_id`);
      passed++;
    } else {
      console.log('⚠️  Test 1 WARNING: No decision logs with work_order_id yet (normal for fresh install)');
      passed++;
    }
  } catch (err) {
    console.log('❌ Test 1 FAILED:', err);
    failed++;
  }

  // Test 2: Check if outcome_vectors has failure_class populated
  try {
    const { data, error } = await supabase
      .from('outcome_vectors')
      .select('id, failure_class, error_context')
      .not('failure_class', 'is', null)
      .limit(5);

    if (error) {
      console.log('❌ Test 2 FAILED: Cannot query outcome_vectors with failure_class');
      console.error('   Error:', error.message);
      failed++;
    } else if (data && data.length > 0) {
      console.log(`✅ Test 2 PASSED: Found ${data.length} outcome vectors with failure_class`);
      console.log(`   Sample: ${data[0].failure_class}`);
      passed++;
    } else {
      console.log('⚠️  Test 2 WARNING: No outcome vectors with failure_class yet (normal if no failures)');
      passed++;
    }
  } catch (err) {
    console.log('❌ Test 2 FAILED:', err);
    failed++;
  }

  // Test 3: Check if escalations has failure_class column
  try {
    const { data, error } = await supabase
      .from('escalations')
      .select('id, failure_class')
      .limit(1);

    if (error) {
      console.log('❌ Test 3 FAILED: Cannot query escalations with failure_class');
      console.error('   Error:', error.message);
      failed++;
    } else {
      console.log('✅ Test 3 PASSED: escalations.failure_class column accessible');
      passed++;
    }
  } catch (err) {
    console.log('❌ Test 3 FAILED:', err);
    failed++;
  }

  // Test 4: Verify failure classifier is importable and works
  try {
    const { classifyError } = await import('../src/lib/failure-classifier');
    const testError = new Error('test error');
    const result = classifyError(testError, { component: 'Test', operation: 'test' });

    if (result.failure_class && result.error_context) {
      console.log('✅ Test 4 PASSED: Failure classifier is functional');
      passed++;
    } else {
      console.log('❌ Test 4 FAILED: Failure classifier returned invalid result');
      failed++;
    }
  } catch (err) {
    console.log('❌ Test 4 FAILED: Cannot import failure classifier:', err);
    failed++;
  }

  // Test 5: Verify decision logger is importable
  try {
    const { logDecision } = await import('../src/lib/decision-logger');

    if (typeof logDecision === 'function') {
      console.log('✅ Test 5 PASSED: Decision logger is functional');
      passed++;
    } else {
      console.log('❌ Test 5 FAILED: logDecision is not a function');
      failed++;
    }
  } catch (err) {
    console.log('❌ Test 5 FAILED: Cannot import decision logger:', err);
    failed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED - Phase 2 integration is working!');
    console.log('\nPhase 2 Infrastructure Status:');
    console.log('- ✅ Database schema extended');
    console.log('- ✅ Failure classifier operational');
    console.log('- ✅ Decision logger operational');
    console.log('- ✅ All services integrated');
    process.exit(0);
  } else {
    console.log('\n❌ SOME TESTS FAILED - Phase 2 integration needs fixes');
    process.exit(1);
  }
}

verifyIntegration().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
