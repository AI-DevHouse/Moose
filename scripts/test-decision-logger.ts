/**
 * Test Decision Logger
 *
 * Verifies that the decision logger correctly logs decisions to the database
 */

import {
  logRoutingDecision,
  logRefinementCycle,
  logEscalationDecision
} from '../src/lib/decision-logger';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

async function testDecisionLogger() {
  console.log('🧪 Testing Decision Logger...\n');

  let passed = 0;
  let failed = 0;
  const testWorkOrderId = ''; // Empty string = NULL in database (no FK constraint)

  // Test 1: Log routing decision
  try {
    await logRoutingDecision({
      work_order_id: testWorkOrderId,
      selected_proposer: 'gpt-4o-mini',
      complexity_score: 42,
      reasoning: 'Low complexity task',
      success: true
    });

    // Verify it was logged
    const { data, error } = await supabase
      .from('decision_logs')
      .select('*')
      .is('work_order_id', null)
      .eq('decision_type', 'routing')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.log('❌ Test 1 FAILED: Routing decision not logged');
      console.error('   Error:', error?.message);
      failed++;
    } else {
      console.log('✅ Test 1 PASSED: Routing decision logged correctly');
      passed++;
    }
  } catch (err) {
    console.log('❌ Test 1 FAILED:', err);
    failed++;
  }

  // Test 2: Log refinement cycle
  try {
    await logRefinementCycle({
      work_order_id: testWorkOrderId,
      cycle_number: 1,
      failure_class: 'compile_error',
      error_message: '5 TypeScript errors remain',
      retry_strategy: 'error_focused',
      success: false
    });

    // Verify it was logged
    const { data, error } = await supabase
      .from('decision_logs')
      .select('*')
      .is('work_order_id', null)
      .eq('decision_type', 'refinement_cycle')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.log('❌ Test 2 FAILED: Refinement cycle not logged');
      console.error('   Error:', error?.message);
      failed++;
    } else {
      console.log('✅ Test 2 PASSED: Refinement cycle logged correctly');
      passed++;
    }
  } catch (err) {
    console.log('❌ Test 2 FAILED:', err);
    failed++;
  }

  // Test 3: Log escalation decision
  try {
    await logEscalationDecision({
      work_order_id: testWorkOrderId,
      component: 'ResultTracker',
      operation: 'trackFailure',
      failure_class: 'orchestration_error',
      severity: 'critical',
      success: true
    });

    // Verify it was logged
    const { data, error } = await supabase
      .from('decision_logs')
      .select('*')
      .is('work_order_id', null)
      .eq('decision_type', 'escalation')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.log('❌ Test 3 FAILED: Escalation decision not logged');
      console.error('   Error:', error?.message);
      failed++;
    } else {
      console.log('✅ Test 3 PASSED: Escalation decision logged correctly');
      passed++;
    }
  } catch (err) {
    console.log('❌ Test 3 FAILED:', err);
    failed++;
  }

  // Cleanup: Delete test records
  try {
    await supabase
      .from('decision_logs')
      .delete()
      .is('work_order_id', null)
      .in('decision_type', ['routing', 'refinement_cycle', 'escalation']);
    console.log('\n🧹 Cleanup: Test records deleted');
  } catch (err) {
    console.warn('⚠️  Cleanup warning:', err);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED - Decision logger works correctly!');
    process.exit(0);
  } else {
    console.log('\n❌ SOME TESTS FAILED - Decision logger needs fixes');
    process.exit(1);
  }
}

testDecisionLogger().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
