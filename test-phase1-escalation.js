// Test Phase 1: Error Escalation
// This script tests the handleCriticalError function

async function testEscalation() {
  console.log('=== Phase 1 Escalation Test ===\n');

  // Test 1: Trigger escalation via API (simulating an error)
  console.log('1. Testing Client Manager escalation API...');

  const testPayload = {
    work_order_id: 'b8dbcb2c-fad4-47e7-941e-c5a5b25f74f4',
    reason: 'Phase 1 Test: Error escalation enforcement',
    metadata: {
      error: 'Simulated error for testing',
      component: 'Phase1Test',
      operation: 'testEscalation',
      test: true
    }
  };

  try {
    const response = await fetch('http://localhost:3000/api/client-manager/escalate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Escalation created successfully');
      console.log('   Escalation ID:', result.escalation.id);
      console.log('   Status:', result.escalation.status);
      console.log('   Recommended action:', result.recommendation.recommended_option_id);
      console.log('   Confidence:', result.recommendation.confidence);
    } else {
      console.log('❌ Escalation failed:', result.error);
      console.log('   This may be expected if escalation criteria not met');
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }

  console.log('\n2. Check escalations in UI:');
  console.log('   Navigate to: http://localhost:3000');
  console.log('   Click: Escalations tab');
  console.log('   Expected: See the escalation listed with Phase1Test metadata');

  console.log('\n=== Test Complete ===');
}

testEscalation();
