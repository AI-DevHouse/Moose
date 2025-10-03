// Test: Trigger an actual error to verify escalation
// This will test the handleCriticalError function by importing it directly

import { handleCriticalError } from './src/lib/error-escalation.ts';

async function testErrorEscalation() {
  console.log('=== Testing Error Escalation System ===\n');

  // Test 1: Trigger error with work_order_id (should escalate)
  console.log('Test 1: Error with work_order_id (should create escalation)');
  try {
    await handleCriticalError({
      component: 'TestRunner',
      operation: 'Phase1ValidationTest',
      error: new Error('Simulated critical error for Phase 1 testing'),
      workOrderId: 'b8dbcb2c-fad4-47e7-941e-c5a5b25f74f4',
      severity: 'critical',
      metadata: {
        test_phase: 'Phase 1',
        trigger_type: 'manual_test',
        timestamp: new Date().toISOString()
      }
    });
    console.log('✅ Error escalation call completed (check logs above)\n');
  } catch (error) {
    console.error('❌ Error escalation failed:', error.message, '\n');
  }

  // Test 2: Trigger error without work_order_id (should only log)
  console.log('Test 2: Error without work_order_id (should only log)');
  try {
    await handleCriticalError({
      component: 'TestRunner',
      operation: 'InfrastructureTest',
      error: new Error('Infrastructure error without WO ID'),
      workOrderId: null,
      severity: 'critical',
      metadata: {
        test_phase: 'Phase 1',
        infrastructure_component: 'database'
      }
    });
    console.log('✅ Infrastructure error logged (no escalation expected)\n');
  } catch (error) {
    console.error('❌ Error handling failed:', error.message, '\n');
  }

  // Test 3: Warning level (should only log)
  console.log('Test 3: Warning severity (should only log)');
  try {
    await handleCriticalError({
      component: 'TestRunner',
      operation: 'WarningTest',
      error: new Error('Warning level error'),
      workOrderId: 'b8dbcb2c-fad4-47e7-941e-c5a5b25f74f4',
      severity: 'warning',
      metadata: {
        test_phase: 'Phase 1'
      }
    });
    console.log('✅ Warning logged (no escalation for warnings)\n');
  } catch (error) {
    console.error('❌ Warning handling failed:', error.message, '\n');
  }

  console.log('=== Next Steps ===');
  console.log('1. Check console output above for escalation logs');
  console.log('2. Navigate to: http://localhost:3000');
  console.log('3. Click the "Escalations" tab');
  console.log('4. Look for escalation with reason: "TestRunner failure: Phase1ValidationTest"');
  console.log('\n=== Test Complete ===');
}

testErrorEscalation();
