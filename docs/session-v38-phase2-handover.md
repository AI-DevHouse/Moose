# Session v38 - Phase 2 Handover: Budget Race Fix

**Date:** 2025-10-03
**Status:** Phase 1 Complete ✅ | Starting Phase 2
**Context:** Moose Mission Control - Error Handling & Resilience Implementation

---

## What's Already Done (Phase 1) ✅

### Completed Work:
1. **Created `src/lib/error-escalation.ts`** - Centralized error handler that calls Client Manager API
2. **Fixed 7 critical files** with error escalation:
   - `src/lib/orchestrator/result-tracker.ts` (lines 114-127, 203-214)
   - `src/lib/manager-service.ts` (lines 138-149)
   - `src/lib/orchestrator/orchestrator-service.ts` (3 locations)
   - `src/lib/sentinel/sentinel-service.ts` (2 locations)
   - `src/lib/orchestrator/proposer-executor.ts` (line 114-122)
   - `src/lib/orchestrator/aider-executor.ts` (line 102-110)
   - `src/lib/orchestrator/github-integration.ts` (line 161-168)

3. **TypeScript:** 0 errors
4. **Full escalation workflow tested:**
   - Created test escalation (ID: be8db517-93c4-48ab-8a32-1d787a42d32a)
   - Verified all 3 Client Manager API endpoints work
   - Confirmed escalation appears in database
   - Tested execute decision endpoint

---

## Your Task: Phase 2 - Budget Race Fix

### Problem Statement

**Current race condition in `src/lib/manager-service.ts` lines 126-142:**

```
Time    Request A                Request B
----    -----------              -----------
:00     Read daily_spend = $95
:01                              Read daily_spend = $95
:02     Call LLM ($10)
:03                              Call LLM ($10)
:04     Write cost_tracking
:05                              Write cost_tracking
        Total = $105 (EXCEEDED $100 EMERGENCY KILL!)
```

**Root cause:** `calculateDailySpend()` reads from database without locking.

---

## Implementation Steps (Follow Exactly)

### Step 2.1: Create PostgreSQL Budget Reservation Function

**File:** Create migration SQL (can run directly in Supabase SQL Editor)

```sql
-- Budget reservation function with row-level locking
-- Prevents race conditions on daily spend calculations

CREATE OR REPLACE FUNCTION check_and_reserve_budget(
  p_estimated_cost DECIMAL,
  p_service_name TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS TABLE(
  can_proceed BOOLEAN,
  current_total DECIMAL,
  reservation_id UUID
) AS $$
DECLARE
  v_current_total DECIMAL;
  v_daily_limit DECIMAL := 100.0;
  v_reservation_id UUID;
BEGIN
  -- Lock cost_tracking table for this day
  LOCK TABLE cost_tracking IN SHARE ROW EXCLUSIVE MODE;

  -- Calculate current daily spend
  SELECT COALESCE(SUM(cost), 0) INTO v_current_total
  FROM cost_tracking
  WHERE DATE(created_at) = CURRENT_DATE;

  -- Check if reservation would exceed limit
  IF v_current_total + p_estimated_cost > v_daily_limit THEN
    RETURN QUERY SELECT FALSE, v_current_total, NULL::UUID;
  ELSE
    -- Create reservation record
    v_reservation_id := gen_random_uuid();

    INSERT INTO cost_tracking (id, cost, service_name, metadata, created_at)
    VALUES (
      v_reservation_id,
      p_estimated_cost,
      p_service_name,
      jsonb_build_object(
        'type', 'reservation',
        'original_metadata', p_metadata
      ),
      NOW()
    );

    RETURN QUERY SELECT TRUE, v_current_total, v_reservation_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

**Action:** Run this SQL in Supabase SQL Editor

---

### Step 2.2: Update `src/lib/manager-service.ts`

Add these three functions AFTER the existing `calculateDailySpend()` function:

```typescript
/**
 * Reserve budget slot before calling LLM
 * Returns reservation ID if successful, null if over budget
 */
async function reserveBudget(
  estimatedCost: number,
  serviceName: string,
  metadata?: Record<string, unknown>
): Promise<{ canProceed: boolean; reservationId: string | null; currentTotal: number }> {
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase.rpc('check_and_reserve_budget', {
    p_estimated_cost: estimatedCost,
    p_service_name: serviceName,
    p_metadata: metadata || {}
  });

  if (error) {
    await handleCriticalError({
      component: 'Manager',
      operation: 'reserveBudget',
      error: error,
      workOrderId: metadata?.work_order_id as string,
      severity: 'critical',
      metadata: { estimatedCost, serviceName }
    });
    return { canProceed: false, reservationId: null, currentTotal: 0 };
  }

  if (!data || data.length === 0) {
    return { canProceed: false, reservationId: null, currentTotal: 0 };
  }

  const result = data[0];
  return {
    canProceed: result.can_proceed,
    reservationId: result.reservation_id,
    currentTotal: result.current_total
  };
}

/**
 * Update reservation with actual cost after LLM call completes
 */
async function updateReservationWithActual(
  reservationId: string,
  actualCost: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const { error } = await supabase
    .from('cost_tracking')
    .update({
      cost: actualCost,
      metadata: {
        type: 'actual',
        updated_at: new Date().toISOString(),
        ...metadata
      }
    })
    .eq('id', reservationId);

  if (error) {
    console.error('Failed to update reservation with actual cost:', error);
    // Non-critical - reservation will remain (over-estimates budget slightly)
  }
}

/**
 * Cancel reservation if LLM call fails
 */
async function cancelReservation(reservationId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const { error } = await supabase
    .from('cost_tracking')
    .delete()
    .eq('id', reservationId);

  if (error) {
    console.error('Failed to cancel reservation:', error);
    // Non-critical - reservation will remain (over-estimates budget slightly)
  }
}

/**
 * Estimate cost for routing decision
 */
function estimateRoutingCost(
  complexityScore: number,
  hardStopRequired: boolean
): number {
  // Rough estimates based on historical data
  if (hardStopRequired || complexityScore >= 1.0) {
    return 2.50; // Claude Sonnet 4.5 average
  } else if (complexityScore < 0.3) {
    return 0.10; // GPT-4o-mini average
  } else {
    return 1.00; // Medium complexity
  }
}
```

---

### Step 2.3: Modify `routeWorkOrder` Function

Find the `routeWorkOrder` function in `src/lib/manager-service.ts` (around line 36-100).

Add budget reservation BEFORE routing decision:

```typescript
export async function routeWorkOrder(
  request: ManagerRoutingRequest
): Promise<ManagerRoutingResponse> {
  try {
    const {
      work_order_id,
      task_description,
      context_requirements,
      complexity_score,
      approved_by_director
    } = request;

    // Verify Director approval
    if (!approved_by_director) {
      throw new Error('Work Order must be approved by Director before routing');
    }

    // Initialize proposer registry
    await proposerRegistry.initialize();
    const activeProposers = proposerRegistry.listActiveProposers();

    if (activeProposers.length === 0) {
      throw new Error('No active proposers available');
    }

    // Get budget limits from config service
    const budgetLimits = await configService.getBudgetLimits();

    // Calculate daily spend
    const dailySpend = await calculateDailySpend();

    // Detect Hard Stop requirement
    const hard_stop_required = detectHardStop(task_description);

    // **NEW: Reserve budget BEFORE routing**
    const estimatedCost = estimateRoutingCost(complexity_score, hard_stop_required);
    const reservation = await reserveBudget(
      estimatedCost,
      'manager-routing',
      { work_order_id }
    );

    if (!reservation.canProceed) {
      // Over budget - escalate immediately
      await handleCriticalError({
        component: 'Manager',
        operation: 'routeWorkOrder',
        error: new Error(`Daily budget exceeded: $${reservation.currentTotal} + $${estimatedCost} > $100`),
        workOrderId: work_order_id,
        severity: 'critical',
        metadata: { estimatedCost, currentTotal: reservation.currentTotal }
      });

      return {
        success: false,
        error: 'Daily budget limit exceeded'
      };
    }

    // Build routing context
    const context: RoutingContext = {
      task_description,
      complexity_score,
      context_requirements,
      hard_stop_required,
      daily_spend: dailySpend
    };

    // Make routing decision using centralized rules
    const routingDecision = makeRoutingDecision(
      context,
      activeProposers,
      budgetLimits
    );

    // **NEW: Store reservation ID in metadata**
    routingDecision.routing_metadata.budget_reservation_id = reservation.reservationId;

    // Update work order with routing metadata
    await updateWorkOrderRouting(work_order_id, routingDecision);

    return {
      success: true,
      routing_decision: routingDecision
    };
  } catch (error) {
    console.error('Manager routing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

---

### Step 2.4: Test Phase 2

**Test 1: Simulate concurrent requests at budget limit**

Create test file `test-budget-race.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testBudgetRace() {
  console.log('=== Budget Race Condition Test ===\n');

  // 1. Set daily spend to $95
  const today = new Date().toISOString().split('T')[0];
  await supabase.rpc('set_daily_spend_for_test', {
    target_spend: 95,
    test_date: today
  });

  // 2. Try to reserve $10 twice concurrently
  const request1 = supabase.rpc('check_and_reserve_budget', {
    p_estimated_cost: 10,
    p_service_name: 'test-1',
    p_metadata: { test: true }
  });

  const request2 = supabase.rpc('check_and_reserve_budget', {
    p_estimated_cost: 10,
    p_service_name: 'test-2',
    p_metadata: { test: true }
  });

  const [result1, result2] = await Promise.all([request1, request2]);

  console.log('Request 1:', result1.data);
  console.log('Request 2:', result2.data);

  const successCount = [result1.data?.[0], result2.data?.[0]]
    .filter(r => r?.can_proceed).length;

  console.log('\n✅ Test Result:');
  console.log(`  Requests succeeded: ${successCount}/2`);
  console.log(`  Expected: 1 (one should be blocked)`);

  if (successCount === 1) {
    console.log('  ✅ PASS: Budget race condition prevented!');
  } else {
    console.log('  ❌ FAIL: Both requests succeeded (race condition exists)');
  }
}

testBudgetRace();
```

Run: `node --import tsx -r dotenv/config test-budget-race.js dotenv_config_path=.env.local`

**Expected:** Only 1 request succeeds

---

## Success Criteria

### Phase 2 Complete When:
- ✅ PostgreSQL function created and deployed
- ✅ `manager-service.ts` uses budget reservations
- ✅ Concurrent request test: Only 1 of 2 succeeds at budget limit
- ✅ Budget over-run creates escalation (verify in database)
- ✅ TypeScript: 0 errors

---

## Verification Commands

```bash
# Check TypeScript
npx tsc --noEmit

# Run budget race test
node --import tsx -r dotenv/config test-budget-race.js dotenv_config_path=.env.local

# Verify escalation created for budget overrun
# Check Supabase: SELECT * FROM escalations WHERE reason LIKE '%budget%' ORDER BY created_at DESC LIMIT 5;
```

---

## Important Context

### Environment Variables
- `.env.local` contains Supabase credentials
- Dev server runs on `http://localhost:3000`
- Current branch: `feature/wo-b8dbcb2c-orchestrator-e2e-test`

### Key Files Modified in Phase 1
- `src/lib/error-escalation.ts` (NEW - don't modify)
- `src/lib/manager-service.ts` (will modify in Phase 2)
- 6 other files have error escalation integrated (don't touch)

### Database Schema
- `cost_tracking` table exists with: id (uuid), cost (decimal), service_name (text), metadata (jsonb), created_at (timestamp)
- `escalations` table exists
- `work_orders` table exists

### Design Decision: Why Database Locking
- Budget enforcement is financial risk - zero tolerance for races
- PostgreSQL locks are battle-tested and atomic
- Fail-safe: Over-estimates budget if reservations not cleaned up
- Alternative (optimistic locking) still has race window - REJECTED

---

## What NOT to Do

❌ Don't apply budget limits to Architect (strategic, not tactical - see plan doc)
❌ Don't use application-level optimistic locking
❌ Don't create new database tables
❌ Don't modify Phase 1 files (error-escalation.ts, result-tracker.ts, etc.)

---

## Reference Documents

**Primary:** `docs/error-handling-resilience-plan.md` (lines 196-461) - Phase 2 details
**Context:** This handover document
**Session State:** `docs/session-state.md` - System status v37

---

## Next Steps After Phase 2

Once Phase 2 is complete and tested:
1. Report success criteria met
2. Create handover for Phase 3 (10 Failure Mode Tests)
3. Optionally commit: `git commit -m "Phase 2: Budget race fix with PostgreSQL locking"`

---

**Good luck! The budget race fix is critical for production safety.**
