// Test: Create failed WO and trigger escalation
// This tests the complete escalation flow

import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { handleCriticalError } from './src/lib/error-escalation.ts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFullEscalation() {
  console.log('=== Full Escalation Test ===\n');

  // Step 1: Get an existing proposer
  console.log('Step 1a: Getting existing proposer...');
  const { data: proposers, error: propError } = await supabase
    .from('proposers')
    .select('id')
    .limit(1)
    .single();

  if (propError || !proposers) {
    console.error('❌ Failed to get proposer:', propError?.message || 'No proposers found');
    return;
  }

  console.log('✅ Found proposer:', proposers.id, '\n');

  // Step 1b: Create a failed work order
  console.log('Step 1b: Creating failed work order...');

  const testWO = {
    id: randomUUID(),
    title: 'Phase 1 Escalation Test',
    description: 'Test work order to validate error escalation system',
    status: 'failed',
    risk_level: 'low',
    proposer_id: proposers.id,
    estimated_cost: 1.0,
    metadata: {
      test: true,
      phase: 'Phase 1',
      orchestrator_error: {
        stage: 'proposer',
        message: 'Simulated failure for testing',
        timestamp: new Date().toISOString()
      }
    }
  };

  const { data: createdWO, error: createError } = await supabase
    .from('work_orders')
    .insert(testWO)
    .select()
    .single();

  if (createError) {
    console.error('❌ Failed to create work order:', createError.message);
    return;
  }

  console.log('✅ Created work order:', createdWO.id);
  console.log('   Status:', createdWO.status);
  console.log('   Title:', createdWO.title, '\n');

  // Step 2: Trigger error escalation
  console.log('Step 2: Triggering error escalation...');

  await handleCriticalError({
    component: 'ProposerExecutor',
    operation: 'generateCode',
    error: new Error('Failed to generate code: API timeout'),
    workOrderId: createdWO.id,
    severity: 'critical',
    metadata: {
      test: true,
      phase: 'Phase 1',
      proposer: 'claude-sonnet-4-5',
      timeout_seconds: 30
    }
  });

  console.log('✅ Error escalation triggered\n');

  // Step 3: Wait a moment then check if escalation was created
  console.log('Step 3: Checking for escalation in database...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const { data: escalations, error: escalationError } = await supabase
    .from('escalations')
    .select('*')
    .eq('work_order_id', createdWO.id);

  if (escalationError) {
    console.error('❌ Failed to query escalations:', escalationError.message);
  } else if (escalations && escalations.length > 0) {
    console.log('✅ Escalation created successfully!');
    console.log('   Escalation ID:', escalations[0].id);
    console.log('   Status:', escalations[0].status);
    console.log('   Reason:', escalations[0].reason);
    console.log('   Metadata:', JSON.stringify(escalations[0].metadata, null, 2));
  } else {
    console.log('⚠️  No escalation found - check Client Manager criteria');
  }

  console.log('\n=== Manual Verification ===');
  console.log('1. Navigate to: http://localhost:3000');
  console.log('2. Click "Escalations" tab');
  console.log(`3. Look for Work Order: ${createdWO.id}`);
  console.log('4. Verify escalation appears with ProposerExecutor failure reason');

  console.log('\n=== Cleanup ===');
  console.log(`To clean up, delete work order: ${createdWO.id}`);

  console.log('\n=== Test Complete ===');
}

testFullEscalation().catch(console.error);
