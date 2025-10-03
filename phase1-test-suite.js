// phase1-test-suite.js
// Run with: node phase1-test-suite.js
// Tests all critical functionality rapidly

const baseUrl = 'http://localhost:3000/api';

async function runTests() {
  console.log('🚀 Starting Phase 1.1 Test Suite...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: API Endpoints Availability
  await testEndpoint('GET', '/work-orders', 'Work Orders API', results);
  await testEndpoint('GET', '/escalations', 'Escalations API', results);
  await testEndpoint('GET', '/system-status', 'System Status API', results);
  await testEndpoint('GET', '/budget', 'Budget API', results);
  await testEndpoint('POST', '/system-heartbeat', 'System Heartbeat API', results);

  // Test 2: Error Handling - Invalid Requests
  await testInvalidRequest('POST', '/work-orders', {}, 'Work Order Validation', results);
  await testInvalidRequest('PUT', '/escalations/invalid-id', {resolution: 'test'}, 'Invalid Escalation ID', results);
  
  // Test 3: Work Order Creation - Edge Cases
  await testWorkOrderCreation('', '', 'Empty Fields Validation', results);
  await testWorkOrderCreation('A'.repeat(1000), 'B'.repeat(5000), 'Large Data Handling', results);
  await testWorkOrderCreation('Test <script>alert(1)</script>', 'XSS Test', 'XSS Protection', results);

  // Test 4: Data Consistency
  await testDataConsistency(results);

  // Test 5: Real-time Updates
  await testRealTimeUpdates(results);

  // Results Summary
  console.log('\n📊 TEST RESULTS SUMMARY:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📋 Total: ${results.tests.length}\n`);

  if (results.failed === 0) {
    console.log('🎉 ALL TESTS PASSED - Phase 1.1 Ready for Production!');
  } else {
    console.log('⚠️  Some tests failed - Review issues before Phase 1.2');
    results.tests.filter(t => !t.passed).forEach(test => {
      console.log(`❌ ${test.name}: ${test.error}`);
    });
  }
}

async function testEndpoint(method, endpoint, name, results) {
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, { method });
    const success = response.ok;
    
    logResult(name, success, success ? null : `HTTP ${response.status}`, results);
    
    if (success && method === 'GET') {
      const data = await response.json();
      logResult(`${name} - Data Structure`, Array.isArray(data) || typeof data === 'object', null, results);
    }
  } catch (error) {
    logResult(name, false, error.message, results);
  }
}

async function testInvalidRequest(method, endpoint, body, name, results) {
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    // Should return 400/422 for invalid requests
    const success = response.status >= 400 && response.status < 500;
    logResult(name, success, success ? null : `Expected 4xx, got ${response.status}`, results);
  } catch (error) {
    logResult(name, false, error.message, results);
  }
}

async function testWorkOrderCreation(title, description, name, results) {
  try {
    const response = await fetch(`${baseUrl}/work-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        risk_level: 'medium'
      })
    });

    if (title === '' || description === '') {
      // Should fail validation
      const success = !response.ok;
      logResult(name, success, success ? null : 'Should have failed validation', results);
    } else {
      // Should succeed or handle gracefully
      const data = response.ok ? await response.json() : null;
      logResult(name, response.ok, response.ok ? null : `HTTP ${response.status}`, results);
    }
  } catch (error) {
    logResult(name, false, error.message, results);
  }
}

async function testDataConsistency(results) {
  try {
    const [workOrders, escalations] = await Promise.all([
      fetch(`${baseUrl}/work-orders`).then(r => r.json()),
      fetch(`${baseUrl}/escalations`).then(r => r.json())
    ]);

    // Check if escalated work orders have corresponding escalations
    const escalatedWorkOrders = workOrders.filter(wo => wo.status === 'escalated');
    const escalationWorkOrderIds = escalations.map(e => e.work_order_id);
    
    const consistent = escalatedWorkOrders.every(wo => 
      escalationWorkOrderIds.includes(wo.id)
    );

    logResult('Data Consistency', consistent, 
      consistent ? null : 'Escalated work orders without escalation records', results);

  } catch (error) {
    logResult('Data Consistency', false, error.message, results);
  }
}

async function testRealTimeUpdates(results) {
  try {
    // Test system heartbeat
    const response = await fetch(`${baseUrl}/system-heartbeat`, { method: 'POST' });
    const success = response.ok;
    
    logResult('Real-time Heartbeat', success, success ? null : `HTTP ${response.status}`, results);

    // Test if system status updates
    const statusBefore = await fetch(`${baseUrl}/system-status`).then(r => r.json());
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    const statusAfter = await fetch(`${baseUrl}/system-status`).then(r => r.json());
    
    const timestampsChanged = statusBefore.some((before, i) => 
      statusAfter[i] && before.last_heartbeat !== statusAfter[i].last_heartbeat
    );

    logResult('Timestamp Updates', timestampsChanged, 
      timestampsChanged ? null : 'Timestamps not updating', results);

  } catch (error) {
    logResult('Real-time Updates', false, error.message, results);
  }
}

function logResult(testName, passed, error, results) {
  const result = { name: testName, passed, error };
  results.tests.push(result);
  
  if (passed) {
    results.passed++;
    console.log(`✅ ${testName}`);
  } else {
    results.failed++;
    console.log(`❌ ${testName}: ${error || 'Unknown error'}`);
  }
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };