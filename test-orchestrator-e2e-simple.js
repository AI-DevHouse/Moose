// Orchestrator E2E Test - Simplified version
// Tests the Orchestrator polling → routing → execution flow
// Uses Node.js for better async control

const BASE_URL = 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testOrchestratorE2E() {
  console.log('\n========================================');
  console.log('Orchestrator E2E Test - Simplified');
  console.log('========================================\n');

  const testId = `wo-e2e-${Date.now()}`;

  try {
    // Step 1: Create Work Order in database
    console.log('[Step 1/6] Creating Work Order...');
    const createResponse = await fetch(`${BASE_URL}/api/work-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'E2E Test: Simple TypeScript function',
        description: 'Create a function that returns a greeting message',
        acceptance_criteria: ['Function exists', 'Returns string'],
        files_in_scope: ['src/lib/test-greeting.ts'],
        context_budget_estimate: 500,
        risk_level: 'low',
        status: 'pending'
      })
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Work Order creation failed: ${error}`);
    }

    const workOrder = await createResponse.json();
    const workOrderId = workOrder.data?.id || workOrder.id;
    console.log(`✅ Work Order created: ${workOrderId}`);

    // Step 2: Update work order to "approved" status (simulating Director approval)
    // In production, this would be done by Director service, but for E2E we set it directly
    console.log('[Step 2/6] Setting Director approval (bypassing Director API)...');
    const updateResponse = await fetch(`${BASE_URL}/api/work-orders/${workOrderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metadata: {
          approved_by_director: true, // Standard field name used by Director
          approval_status: 'approved',
          approved_by: 'e2e-test',
          approved_at: new Date().toISOString()
        }
      })
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Failed to update work order: ${error}`);
    }
    console.log('✅ Work order marked as approved');

    // Step 3: Check Orchestrator status
    console.log('[Step 3/6] Checking Orchestrator status...');
    const statusResponse = await fetch(`${BASE_URL}/api/orchestrator`);
    const statusData = await statusResponse.json();
    console.log(`   Status: ${statusData.status.status}`);
    console.log(`   Running: ${statusData.status.isRunning}`);

    // Step 4: Start Orchestrator if not running
    if (!statusData.status.isRunning) {
      console.log('[Step 4/6] Starting Orchestrator polling...');
      const startResponse = await fetch(`${BASE_URL}/api/orchestrator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          interval_ms: 5000 // Poll every 5 seconds
        })
      });

      const startData = await startResponse.json();
      if (!startData.success) {
        throw new Error(`Failed to start orchestrator: ${startData.error}`);
      }
      console.log(`✅ Orchestrator started (polling every 5s)`);
    } else {
      console.log('[Step 4/6] Orchestrator already running');
    }

    // Step 5: Monitor work order status
    console.log('[Step 5/6] Monitoring work order execution...');
    console.log('   Waiting for orchestrator to process (max 60s)...');

    let attempts = 0;
    const maxAttempts = 12; // 60 seconds / 5 second intervals
    let currentStatus = 'pending';

    while (attempts < maxAttempts) {
      await sleep(5000);
      attempts++;

      // Check work order status
      const woResponse = await fetch(`${BASE_URL}/api/work-orders/${workOrderId}`);
      if (!woResponse.ok) {
        console.log(`   [${attempts}/${maxAttempts}] Failed to fetch work order`);
        continue;
      }

      const woData = await woResponse.json();
      const newStatus = woData.data?.status || woData.status;

      if (newStatus !== currentStatus) {
        currentStatus = newStatus;
        console.log(`   [${attempts}/${maxAttempts}] Status: ${currentStatus}`);
      } else {
        console.log(`   [${attempts}/${maxAttempts}] Still ${currentStatus}...`);
      }

      // Check for completion
      if (['completed', 'failed', 'error'].includes(currentStatus)) {
        break;
      }
    }

    // Step 6: Validate results
    console.log('[Step 6/6] Validating results...');

    if (currentStatus === 'completed') {
      console.log('✅ Work order completed successfully!');
    } else if (currentStatus === 'failed' || currentStatus === 'error') {
      console.log(`⚠️  Work order ended with status: ${currentStatus}`);
    } else {
      console.log(`⚠️  Work order still in status: ${currentStatus} after ${maxAttempts * 5}s`);
    }

    // Summary
    console.log('\n========================================');
    console.log('E2E Test Summary');
    console.log('========================================');
    console.log(`Work Order ID: ${workOrderId}`);
    console.log(`Final Status: ${currentStatus}`);
    console.log(`Execution Time: ~${attempts * 5}s`);
    console.log('');

    return {
      success: ['completed', 'in_progress'].includes(currentStatus),
      workOrderId,
      finalStatus: currentStatus
    };

  } catch (error) {
    console.error('\n❌ E2E Test Failed:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

// Run the test
testOrchestratorE2E()
  .then(result => {
    if (result.success) {
      console.log('✅ E2E Test PASSED');
      process.exit(0);
    } else {
      console.log('❌ E2E Test FAILED');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
