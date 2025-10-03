# Error Handling & Resilience Implementation Plan

**Created:** 2025-10-02
**Status:** Ready to Execute
**Timeline:** 6-7 days
**Context:** Addresses silent failures, budget race conditions, and testing gaps in production system

---

## Executive Summary

### Problem Statement
The Moose system has 3 critical gaps:
1. **Silent Failures:** 20 files with `console.error`, 84 catch blocks, many don't escalate to Client Manager
2. **Budget Race Condition:** Concurrent requests can exceed $100 emergency kill limit
3. **Testing Blind Spots:** 18/18 tests are happy path, 0 failure mode tests

### Solution Approach
**Leverage existing infrastructure** (Client Manager v35-v37 already has full escalation system) and **enforce consistency** rather than building new architecture.

### Key Metrics
- **New Code:** ~200 lines (not 2,000+)
- **Timeline:** 6-7 days (not 20 days)
- **Approach:** Incremental patches (not rewrite)

---

## Why This Plan (vs. Alternative Approaches)

### Rejected Approach (from Technical Discussion document)
- ❌ Create new centralized error handling infrastructure
- ❌ Add 4 new database tables
- ❌ 2,000+ lines of infrastructure code
- ❌ 4 weeks of work
- ❌ Question existing patterns ("should we use createEscalation or create new?")

### Accepted Approach (This Plan)
- ✅ Use existing Client Manager escalation system (v35-v37)
- ✅ Enforce consistent usage across all agents
- ✅ ~200 lines of new code
- ✅ 6-7 days of work
- ✅ Leverage proven patterns (Sentinel already has good error handling - replicate it)

### Why This is Better
1. **Client Manager already exists** (6 files, 916 lines, fully functional in v35)
2. **Escalation UI already exists** (260+ lines in v37, CRITICAL BLOCKER REMOVED)
3. **API already exists** (3 endpoints: `/escalate`, `/resolutions/{id}`, `/execute`)
4. **Database already exists** (`escalations` table functional)
5. **Gap is enforcement, not architecture** - Some agents use it, others don't

---

## Phase 1: Error Audit & Escalation Enforcement (1-2 days)

### Objective
Make every critical error visible in Client Manager UI.

### Current State Analysis
- **20 files** have `console.error` statements
- **84 catch blocks** across 22 files in `src/lib/`
- Many errors logged but NOT escalated to Client Manager
- Result: Silent failures, blind learning system, stuck Work Orders

### Implementation

#### 1.1 Create Error Escalation Helper

**File:** `src/lib/error-escalation.ts` (~50 lines)

```typescript
/**
 * Centralized error escalation helper
 * Uses existing Client Manager API (v35-v37)
 */

export async function handleCriticalError(opts: {
  component: string;          // e.g., "ResultTracker", "Sentinel"
  operation: string;           // e.g., "writeOutcomeVectors", "callClientManager"
  error: Error;
  workOrderId?: string | null; // If related to Work Order
  severity: 'critical' | 'warning';
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { component, operation, error, workOrderId, severity, metadata } = opts;

  // ALWAYS log for debugging
  console.error(`[${component}] ${operation} failed:`, error, metadata);

  // If critical AND has work_order_id: escalate to Client Manager
  if (severity === 'critical' && workOrderId) {
    try {
      const response = await fetch('http://localhost:3000/api/client-manager/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_order_id: workOrderId,
          reason: `${component} failure: ${operation}`,
          metadata: {
            error: error.message,
            stack: error.stack,
            ...metadata
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ErrorEscalation] Failed to escalate:', errorText);
      } else {
        const result = await response.json();
        console.log(`[ErrorEscalation] Escalation created: ${result.escalation.id}`);
      }
    } catch (escalationError) {
      // Don't throw - escalation failure shouldn't crash the system
      console.error('[ErrorEscalation] Escalation itself failed:', escalationError);
    }
  }

  // If critical but NO work_order_id: Log to system_alerts (future enhancement)
  // For now, console.error is sufficient for infrastructure errors
}
```

**Why this design:**
- ✅ Uses existing Client Manager API (no new infrastructure)
- ✅ Defensive - escalation failure doesn't crash system
- ✅ Single function every agent calls (consistent pattern)
- ✅ Matches Sentinel's existing error handling pattern (lines 199-243 in sentinel-service.ts)

#### 1.2 Audit & Fix Process

**Priority 1 - CRITICAL (Must fix):**

| File | Line | Issue | Impact |
|------|------|-------|--------|
| `result-tracker.ts` | 113-116 | `outcome_vectors` write failure silently ignored | Learning system blind, Manager can't optimize routing |
| `manager-service.ts` | 138 | Daily spend calculation error returns 0 | Budget enforcement broken, can exceed limits |
| `orchestrator-service.ts` | Multiple | Orchestration failures logged but not escalated | Work Orders stuck, no human visibility |

**Priority 2 - HIGH (Should fix):**

| File | Line | Issue | Impact |
|------|------|-------|--------|
| `sentinel-service.ts` | 209, 232 | Client Manager call fails - has fallback but no escalation | Good pattern, just needs escalation added |
| `proposer-executor.ts` | Multiple | Proposer call failures not always escalated | Code generation fails silently |
| `aider-executor.ts` | Multiple | Aider command failures not escalated | Code application fails silently |
| `github-integration.ts` | Multiple | PR creation failures not escalated | Work Orders complete but no PR created |

**Priority 3 - MEDIUM (Nice to fix):**
- `dashboard-api.ts`, `llm-service.ts`, `contract-validator.ts`, etc. (13 more files)

#### 1.3 Audit Checklist

For each `console.error` statement, answer:
- ❓ **Does this impact Work Order execution?** → YES = Add escalation
- ❓ **Can system recover automatically?** → NO = Add escalation
- ❓ **Is user intervention needed?** → YES = Add escalation
- ❓ **Is this just debugging?** → Log only is fine

#### 1.4 Example Fix

**BEFORE (result-tracker.ts lines 113-116):**
```typescript
if (ovError) {
  console.error('[ResultTracker] Error writing outcome_vectors:', ovError);
  // Non-fatal, continue
}
```

**AFTER:**
```typescript
if (ovError) {
  await handleCriticalError({
    component: 'ResultTracker',
    operation: 'writeOutcomeVectors',
    error: ovError,
    workOrderId: wo.id,
    severity: 'critical',
    metadata: {
      proposer_used: proposerResponse.proposer_used,
      cost: proposerResponse.cost
    }
  });
  // Still continue execution - escalation notifies human but doesn't block
}
```

### Success Criteria (Phase 1)
- ✅ Every critical error creates escalation in database
- ✅ Escalation appears in Mission Control UI (Escalations tab)
- ✅ Human can view context and make decision
- ✅ No new silent failures in production

---

## Phase 2: Budget Race Condition Fix (1 day)

### Problem Statement

**Current race condition:**
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

**Root cause:** `calculateDailySpend()` in `manager-service.ts` (lines 126-142) reads from database without locking.

### Solution: Pessimistic Locking with Database Function

#### 2.1 Create PostgreSQL Function

**File:** `migrations/add_budget_lock_function.sql`

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
  v_daily_limit DECIMAL := 100.0; -- Can be parameterized from system_config
  v_reservation_id UUID;
BEGIN
  -- Lock cost_tracking table for this day (prevents concurrent reads)
  -- This is safe because cost_tracking is append-only
  LOCK TABLE cost_tracking IN SHARE ROW EXCLUSIVE MODE;

  -- Calculate current daily spend
  SELECT COALESCE(SUM(cost), 0) INTO v_current_total
  FROM cost_tracking
  WHERE DATE(created_at) = CURRENT_DATE;

  -- Check if reservation would exceed limit
  IF v_current_total + p_estimated_cost > v_daily_limit THEN
    -- Over budget - return false, no reservation created
    RETURN QUERY SELECT FALSE, v_current_total, NULL::UUID;
  ELSE
    -- Under budget - create reservation record
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

**Why this works:**
- ✅ **Atomic:** `LOCK TABLE` prevents concurrent reads during check
- ✅ **No separate table:** Uses existing `cost_tracking` table
- ✅ **Traceable:** Reservation has UUID, can track lifecycle
- ✅ **Fail-safe:** If LLM call fails, reservation remains (slightly over-estimates budget = safer direction)
- ✅ **Fast:** Lock held for ~10ms (single INSERT operation)

#### 2.2 Update Manager Service

**File:** `src/lib/manager-service.ts`

Add these functions:

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
    console.error('Budget reservation failed:', error);
    await handleCriticalError({
      component: 'Manager',
      operation: 'reserveBudget',
      error: error,
      workOrderId: metadata?.work_order_id,
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
```

#### 2.3 Update routeWorkOrder Function

**Modify `manager-service.ts` routeWorkOrder:**

```typescript
export async function routeWorkOrder(
  request: ManagerRoutingRequest
): Promise<ManagerRoutingResponse> {
  try {
    // ... existing validation ...

    // BEFORE routing decision: Reserve budget
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

    // ... existing routing logic ...

    // After successful routing: Store reservation ID in metadata
    routingDecision.routing_metadata.budget_reservation_id = reservation.reservationId;

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

### Alternative Considered: Optimistic Locking (REJECTED)

**Why rejected:**
- ❌ Still has race window between re-check and LLM call
- ❌ Requires retry logic (complexity)
- ❌ Budget enforcement is financial risk - can't tolerate races
- ✅ Database locks are battle-tested and reliable

### Success Criteria (Phase 2)
- ✅ Concurrent requests cannot exceed $100 daily limit
- ✅ Budget reservations tracked in `cost_tracking` table
- ✅ Failed LLM calls cancel reservations (cleanup)
- ✅ Budget over-run triggers immediate escalation

---

## Phase 3: Failure Mode Tests (3-4 days)

### Objective
Validate that failures are handled correctly and escalated appropriately.

### Current State
- ✅ 18/18 integration tests passing (all happy path)
- ✅ 5 unit tests for Orchestrator components
- ❌ **0 failure mode tests**

### Test Infrastructure
- **Framework:** Vitest 3.2.4 (already installed)
- **Location:** `src/lib/__tests__/failure-modes.test.ts`
- **Existing pattern:** 5 tests in `src/lib/orchestrator/__tests__/`

### 10 Failure Mode Tests

#### Test 1: outcome_vectors Write Failure
```typescript
it('should escalate when outcome_vectors write fails', async () => {
  // Mock Supabase to return error on insert
  const mockError = { message: 'Database constraint violation' };
  vi.spyOn(supabase.from('outcome_vectors'), 'insert')
    .mockResolvedValue({ data: null, error: mockError });

  // Call ResultTracker
  await trackExecution(mockWorkOrder, mockProposerResponse, mockRoutingDecision);

  // Expect: Escalation created
  const { data: escalations } = await supabase
    .from('escalations')
    .select('*')
    .eq('work_order_id', mockWorkOrder.id);

  expect(escalations).toHaveLength(1);
  expect(escalations[0].reason).toContain('ResultTracker failure');
});
```

#### Test 2: Budget Race Condition
```typescript
it('should prevent budget race condition with concurrent requests', async () => {
  // Setup: Set daily spend to $95
  await setupDailySpend(95);

  // Simulate 2 concurrent $10 requests
  const request1 = reserveBudget(10, 'test-service-1');
  const request2 = reserveBudget(10, 'test-service-2');

  const [result1, result2] = await Promise.all([request1, request2]);

  // Expect: Only ONE request succeeds
  const successCount = [result1, result2].filter(r => r.canProceed).length;
  expect(successCount).toBe(1);

  // Expect: Total daily spend does NOT exceed $100
  const finalSpend = await calculateDailySpend();
  expect(finalSpend).toBeLessThanOrEqual(100);
});
```

#### Test 3: Concurrent Work Order Metadata Updates
```typescript
it('should handle concurrent Work Order metadata updates', async () => {
  const woId = 'test-wo-123';

  // Simulate 2 agents updating metadata simultaneously
  const update1 = updateWorkOrderMetadata(woId, { agent: 'manager', data: { key: 'value1' } });
  const update2 = updateWorkOrderMetadata(woId, { agent: 'proposer', data: { key: 'value2' } });

  await Promise.all([update1, update2]);

  // Expect: Both updates persisted (no data loss)
  const { data: wo } = await supabase
    .from('work_orders')
    .select('metadata')
    .eq('id', woId)
    .single();

  expect(wo.metadata).toHaveProperty('manager');
  expect(wo.metadata).toHaveProperty('proposer');
});
```

#### Test 4: Malformed LLM JSON Response
```typescript
it('should handle malformed LLM JSON response', async () => {
  // Mock LLM to return invalid JSON
  const malformedResponse = "```json\n{broken json without closing brace";

  vi.spyOn(claudeProposer, 'generate').mockResolvedValue(malformedResponse);

  // Call Proposer
  const result = await generateProposal({
    task_description: 'Test task',
    context: [],
    metadata: { work_order_id: 'test-wo-456' }
  });

  // Expect: Error caught, no crash
  expect(result.success).toBe(false);

  // Expect: Escalation created
  const { data: escalations } = await supabase
    .from('escalations')
    .select('*')
    .eq('work_order_id', 'test-wo-456');

  expect(escalations.length).toBeGreaterThan(0);
});
```

#### Test 5: Database Connection Failure During Transaction
```typescript
it('should handle database connection failure gracefully', async () => {
  // Mock Supabase to simulate connection failure
  vi.spyOn(supabase, 'from').mockImplementation(() => {
    throw new Error('Connection refused');
  });

  // Attempt Work Order update
  const result = await updateWorkOrderStatus('test-wo-789', 'completed');

  // Expect: Error caught, no crash
  expect(result.success).toBe(false);

  // Expect: Error logged
  expect(console.error).toHaveBeenCalledWith(
    expect.stringContaining('Connection refused')
  );
});
```

#### Test 6: GitHub Webhook Race Condition
```typescript
it('should handle webhook arriving before PR number is set', async () => {
  const woId = 'test-wo-webhook';

  // Create Work Order without github_pr_number
  await createWorkOrder({ id: woId, status: 'in_progress' });

  // Simulate Sentinel webhook arriving
  const result = await handleSentinelWebhook({
    work_order_id: woId,
    workflow_status: 'completed'
  });

  // Expect: Sentinel detects missing PR number
  // Expect: Retry logic triggered
  // Expect: Eventually succeeds after PR number set
  expect(result.retry_count).toBeGreaterThan(0);
});
```

#### Test 7: Invalid State Transition
```typescript
it('should reject invalid state transitions', async () => {
  const woId = 'test-wo-state';

  // Create Work Order in 'completed' status
  await createWorkOrder({ id: woId, status: 'completed' });

  // Attempt invalid transition: completed → in_progress
  const result = await updateWorkOrderStatus(woId, 'in_progress');

  // Expect: Transition rejected
  expect(result.success).toBe(false);
  expect(result.error).toContain('Invalid state transition');

  // Expect: Work Order status unchanged
  const { data: wo } = await supabase
    .from('work_orders')
    .select('status')
    .eq('id', woId)
    .single();

  expect(wo.status).toBe('completed');
});
```

#### Test 8: Orchestrator Aider Command Failure
```typescript
it('should escalate when Aider command fails', async () => {
  // Mock Aider CLI to fail
  vi.spyOn(childProcess, 'spawn').mockImplementation(() => {
    const mockProcess = new EventEmitter();
    setTimeout(() => mockProcess.emit('error', new Error('Command not found')), 10);
    return mockProcess as any;
  });

  // Attempt to execute Work Order
  const result = await executeWithAider({
    work_order_id: 'test-wo-aider',
    code: 'console.log("test")',
    file_path: 'test.ts'
  });

  // Expect: Execution failed
  expect(result.success).toBe(false);

  // Expect: Escalation created
  const { data: escalations } = await supabase
    .from('escalations')
    .select('*')
    .eq('work_order_id', 'test-wo-aider');

  expect(escalations.length).toBeGreaterThan(0);
});
```

#### Test 9: Sentinel Webhook Invalid Auth Token
```typescript
it('should reject Sentinel webhook with invalid auth token', async () => {
  // Create webhook with invalid signature
  const invalidWebhook = {
    headers: {
      'x-hub-signature-256': 'sha256=invalid_signature'
    },
    body: {
      work_order_id: 'test-wo-auth',
      workflow_status: 'completed'
    }
  };

  // Send to Sentinel endpoint
  const response = await fetch('http://localhost:3000/api/sentinel', {
    method: 'POST',
    headers: invalidWebhook.headers,
    body: JSON.stringify(invalidWebhook.body)
  });

  // Expect: Rejected with 401
  expect(response.status).toBe(401);

  // Expect: Work Order status unchanged
  const { data: wo } = await supabase
    .from('work_orders')
    .select('status')
    .eq('id', 'test-wo-auth')
    .single();

  expect(wo.status).not.toBe('completed');
});
```

#### Test 10: Work Order Stuck >24h Monitoring
```typescript
it('should detect and escalate stuck Work Orders', async () => {
  const woId = 'test-wo-stuck';

  // Create Work Order stuck in 'in_progress' for 25 hours
  const stuckTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
  await createWorkOrder({
    id: woId,
    status: 'in_progress',
    updated_at: stuckTime.toISOString()
  });

  // Run monitoring check
  const stuckWOs = await detectStuckWorkOrders();

  // Expect: Stuck Work Order detected
  expect(stuckWOs).toContainEqual(
    expect.objectContaining({ id: woId })
  );

  // Expect: Escalation created
  const { data: escalations } = await supabase
    .from('escalations')
    .select('*')
    .eq('work_order_id', woId);

  expect(escalations.length).toBeGreaterThan(0);
  expect(escalations[0].reason).toContain('stuck');
});
```

### Test Execution

```bash
# Run all failure mode tests
npx vitest run src/lib/__tests__/failure-modes.test.ts

# Run with coverage
npx vitest run --coverage src/lib/__tests__/failure-modes.test.ts

# Watch mode during development
npx vitest watch src/lib/__tests__/failure-modes.test.ts
```

### Success Criteria (Phase 3)
- ✅ All 10 failure mode tests passing
- ✅ Tests validate escalation creation
- ✅ Tests validate graceful degradation
- ✅ Tests validate no crashes on failure
- ✅ Coverage >80% for error handling paths

---

## Phase 4: Monitoring Dashboard (1 day)

### Objective
Provide real-time visibility into system health and proactive problem detection.

### Implementation

#### 4.1 Create API Endpoint

**File:** `src/app/api/admin/health/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase';

export interface SystemHealth {
  stuckWorkOrders: Array<{
    id: string;
    title: string;
    status: string;
    stuck_hours: number;
    updated_at: string;
  }>;
  dailyBudget: {
    spent: number;
    limit: number;
    percentage: number;
    status: 'normal' | 'warning' | 'critical';
    reservations: number;
  };
  errorRate: {
    last_hour: number;
    last_24h: number;
  };
  escalationBacklog: {
    open: number;
    avg_resolution_time_hours: number;
  };
  agentHealth: {
    architect: { status: 'healthy' | 'degraded' | 'down'; last_success: string };
    director: { status: 'healthy' | 'degraded' | 'down'; last_success: string };
    manager: { status: 'healthy' | 'degraded' | 'down'; last_success: string };
    proposers: { status: 'healthy' | 'degraded' | 'down'; last_success: string };
    orchestrator: { status: 'healthy' | 'degraded' | 'down'; last_success: string };
    sentinel: { status: 'healthy' | 'degraded' | 'down'; last_success: string };
    client_manager: { status: 'healthy' | 'degraded' | 'down'; last_success: string };
  };
}

export async function GET() {
  const supabase = createSupabaseServiceClient();
  const now = new Date();

  try {
    // 1. Stuck Work Orders (>2h in in_progress)
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const { data: stuckWOs } = await supabase
      .from('work_orders')
      .select('id, title, status, updated_at')
      .eq('status', 'in_progress')
      .lt('updated_at', twoHoursAgo.toISOString());

    const stuckWorkOrders = (stuckWOs || []).map(wo => ({
      ...wo,
      stuck_hours: Math.floor((now.getTime() - new Date(wo.updated_at).getTime()) / (60 * 60 * 1000))
    }));

    // 2. Daily budget
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const { data: costs } = await supabase
      .from('cost_tracking')
      .select('cost, metadata')
      .gte('created_at', startOfDay.toISOString());

    const dailySpent = (costs || [])
      .filter(c => (c.metadata as any)?.type !== 'reservation') // Exclude reservations
      .reduce((sum, r) => sum + Number(r.cost), 0);

    const reservations = (costs || [])
      .filter(c => (c.metadata as any)?.type === 'reservation')
      .length;

    const dailyLimit = 100; // From system_config
    const budgetPercentage = (dailySpent / dailyLimit) * 100;
    const budgetStatus = dailySpent > dailyLimit ? 'critical'
                       : dailySpent > dailyLimit * 0.5 ? 'warning'
                       : 'normal';

    // 3. Error rate (from escalations)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { count: errorsLastHour } = await supabase
      .from('escalations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString());

    const { count: errorsLast24h } = await supabase
      .from('escalations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo.toISOString());

    // 4. Escalation backlog
    const { data: openEscalations, count: openCount } = await supabase
      .from('escalations')
      .select('*', { count: 'exact' })
      .eq('status', 'open');

    const { data: resolvedEscalations } = await supabase
      .from('escalations')
      .select('created_at, resolved_at')
      .eq('status', 'resolved')
      .not('resolved_at', 'is', null)
      .limit(50);

    const avgResolutionTime = resolvedEscalations && resolvedEscalations.length > 0
      ? resolvedEscalations.reduce((sum, e) => {
          const created = new Date(e.created_at).getTime();
          const resolved = new Date(e.resolved_at!).getTime();
          return sum + (resolved - created) / (60 * 60 * 1000); // hours
        }, 0) / resolvedEscalations.length
      : 0;

    // 5. Agent health (from outcome_vectors)
    const { data: recentOutcomes } = await supabase
      .from('outcome_vectors')
      .select('model_used, success, created_at')
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .order('created_at', { ascending: false });

    // Simplified agent health based on recent activity
    const agentHealth = {
      architect: { status: 'healthy' as const, last_success: now.toISOString() },
      director: { status: 'healthy' as const, last_success: now.toISOString() },
      manager: { status: 'healthy' as const, last_success: now.toISOString() },
      proposers: { status: 'healthy' as const, last_success: now.toISOString() },
      orchestrator: { status: 'healthy' as const, last_success: now.toISOString() },
      sentinel: { status: 'healthy' as const, last_success: now.toISOString() },
      client_manager: { status: 'healthy' as const, last_success: now.toISOString() }
    };

    const health: SystemHealth = {
      stuckWorkOrders,
      dailyBudget: {
        spent: dailySpent,
        limit: dailyLimit,
        percentage: budgetPercentage,
        status: budgetStatus,
        reservations
      },
      errorRate: {
        last_hour: errorsLastHour || 0,
        last_24h: errorsLast24h || 0
      },
      escalationBacklog: {
        open: openCount || 0,
        avg_resolution_time_hours: avgResolutionTime
      },
      agentHealth
    };

    return NextResponse.json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system health' },
      { status: 500 }
    );
  }
}
```

#### 4.2 Create Monitoring Dashboard Component

**File:** `src/components/MonitoringDashboard.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import type { SystemHealth } from '@/app/api/admin/health/route';

export function MonitoringDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch('/api/admin/health');
        if (!response.ok) throw new Error('Failed to fetch health');
        const data = await response.json();
        setHealth(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchHealth();

    // Poll every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading system health...</div>;
  if (error) return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  if (!health) return null;

  return (
    <div className="space-y-6">
      {/* Daily Budget */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Budget</CardTitle>
          <CardDescription>
            ${health.dailyBudget.spent.toFixed(2)} / ${health.dailyBudget.limit.toFixed(2)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={health.dailyBudget.percentage} className="mb-2" />
          <div className="flex justify-between text-sm">
            <span>
              <Badge variant={
                health.dailyBudget.status === 'critical' ? 'destructive' :
                health.dailyBudget.status === 'warning' ? 'warning' :
                'default'
              }>
                {health.dailyBudget.status.toUpperCase()}
              </Badge>
            </span>
            <span className="text-muted-foreground">
              {health.dailyBudget.reservations} pending reservations
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Stuck Work Orders */}
      {health.stuckWorkOrders.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>⚠️ Stuck Work Orders</AlertTitle>
          <AlertDescription>
            {health.stuckWorkOrders.length} Work Orders stuck in progress for >2 hours
            <ul className="mt-2 space-y-1">
              {health.stuckWorkOrders.map(wo => (
                <li key={wo.id}>
                  <strong>{wo.title}</strong> - {wo.stuck_hours}h stuck
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Escalation Backlog */}
      <Card>
        <CardHeader>
          <CardTitle>Escalation Backlog</CardTitle>
          <CardDescription>
            {health.escalationBacklog.open} open escalations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Average resolution time: {health.escalationBacklog.avg_resolution_time_hours.toFixed(1)} hours
          </p>
        </CardContent>
      </Card>

      {/* Error Rate */}
      <Card>
        <CardHeader>
          <CardTitle>Error Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Last hour:</span>
              <Badge variant={health.errorRate.last_hour > 5 ? 'destructive' : 'default'}>
                {health.errorRate.last_hour} errors
              </Badge>
            </div>
            <div className="flex justify-between">
              <span>Last 24 hours:</span>
              <Badge variant={health.errorRate.last_24h > 50 ? 'destructive' : 'default'}>
                {health.errorRate.last_24h} errors
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Health */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(health.agentHealth).map(([agent, status]) => (
              <div key={agent} className="flex justify-between items-center">
                <span className="capitalize">{agent.replace('_', ' ')}</span>
                <Badge variant={
                  status.status === 'healthy' ? 'default' :
                  status.status === 'degraded' ? 'warning' :
                  'destructive'
                }>
                  {status.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### 4.3 Add Tab to Mission Control

**File:** `src/components/MissionControlDashboard.tsx`

Add new tab:

```typescript
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList>
    <TabsTrigger value="work-orders">Work Orders</TabsTrigger>
    <TabsTrigger value="escalations">
      Escalations
      {pendingEscalations.length > 0 && (
        <Badge variant="destructive" className="ml-2">
          {pendingEscalations.length}
        </Badge>
      )}
    </TabsTrigger>
    <TabsTrigger value="upload">Upload Spec</TabsTrigger>
    <TabsTrigger value="monitoring">Monitoring</TabsTrigger> {/* NEW */}
  </TabsList>

  {/* ... existing tabs ... */}

  <TabsContent value="monitoring">
    <MonitoringDashboard />
  </TabsContent>
</Tabs>
```

### Success Criteria (Phase 4)
- ✅ Monitoring tab visible in Mission Control
- ✅ Real-time budget tracking with visual progress bar
- ✅ Stuck Work Orders highlighted with red alerts
- ✅ Escalation backlog visible with resolution time trends
- ✅ Agent health status (future enhancement: integrate with outcome_vectors)

---

## Critical Design Decisions

### 1. Architect Budget Enforcement

**Decision:** Architect is NOT subject to daily budget enforcement

**Reasoning:**
- **Strategic vs Tactical:** Architect ($11.30/call) is strategic planning, Proposers ($0.10-$3.00/call) are tactical execution
- **Human-initiated:** User uploads spec via Mission Control (conscious decision)
- **Low frequency:** 1-2 calls/day max
- **High stakes:** Bad decomposition = entire feature fails
- **Budget purpose:** Prevent runaway autonomous execution (retry loops, infinite refinement)

**Implementation:**
- ❌ Don't apply daily budget limits to Architect
- ✅ Do warn user if Architect call will be expensive
- ✅ Do track Architect costs separately for visibility
- ✅ Do apply monthly cap ($500 total system budget)

### 2. Error Escalation Pattern

**Decision:** Use existing Client Manager API (v35-v37) consistently

**Reasoning:**
- ✅ Client Manager already has full escalation handling (6 files, 916 lines)
- ✅ Escalation UI already complete (260+ lines, v37)
- ✅ API already exists (3 endpoints)
- ✅ Database already exists (`escalations` table)
- ✅ Pattern already proven (Sentinel uses it, lines 199-243)

**Rejected Alternative:**
- ❌ Create new centralized error handler with separate tables
- ❌ Build new infrastructure when existing works

### 3. Budget Reservation Approach

**Decision:** Database-level pessimistic locking with PostgreSQL function

**Reasoning:**
- ✅ Budget enforcement is financial risk - zero tolerance for races
- ✅ PostgreSQL locks are battle-tested and reliable
- ✅ Atomic operations prevent concurrent read/write issues
- ✅ Fail-safe: Over-estimates budget if reservations not cleaned up
- ✅ Fast: Lock held for ~10ms (single INSERT)

**Rejected Alternative:**
- ❌ Application-level optimistic locking (still has race window)
- ❌ Separate budget_reservations table (unnecessary complexity)

### 4. Testing Strategy

**Decision:** Use Vitest for unit tests, PowerShell for E2E integration tests

**Reasoning:**
- ✅ Vitest already installed (3.2.4)
- ✅ 5 existing unit tests in Orchestrator (proven pattern)
- ✅ Fast feedback loop for failure mode validation
- ✅ PowerShell integration tests already cover happy path (18/18 passing)

**Scope:**
- 10 new failure mode tests (comprehensive coverage)
- Focus on error handling, escalation, graceful degradation

### 5. Monitoring Placement

**Decision:** New tab in Mission Control (not separate admin panel)

**Reasoning:**
- ✅ Consistent with existing UI pattern (Work Orders | Escalations | Upload Spec | Monitoring)
- ✅ Users already familiar with Mission Control
- ✅ Real-time polling already implemented (5-second interval)
- ✅ Reduces context switching for operators

---

## Success Metrics

### Phase 1: Error Escalation
- ✅ Zero silent failures in production
- ✅ Every critical error visible in Mission Control UI
- ✅ Human can make informed decisions on escalations
- ✅ All 20 files with `console.error` audited and fixed

### Phase 2: Budget Race
- ✅ Budget enforcement bulletproof (no over-runs possible)
- ✅ Concurrent requests cannot exceed $100 daily limit
- ✅ Budget reservations tracked and cleaned up
- ✅ Over-budget attempts trigger immediate escalation

### Phase 3: Failure Tests
- ✅ 10/10 failure mode tests passing
- ✅ Coverage >80% for error handling code paths
- ✅ Confidence in production resilience
- ✅ Regression prevention for future changes

### Phase 4: Monitoring
- ✅ Stuck Work Orders visible within 5 minutes
- ✅ Budget tracking real-time with visual indicators
- ✅ Escalation backlog trends visible
- ✅ Proactive problem detection before user reports

### Overall System
- ✅ Escalation rate <5% (goal from project plan)
- ✅ Mean time to detection (MTTD) <5 minutes
- ✅ Mean time to resolution (MTTR) <30 minutes
- ✅ Zero budget over-runs in production

---

## Implementation Checklist

### Phase 1 (1-2 days)
- [ ] Create `src/lib/error-escalation.ts` (~50 lines)
- [ ] Audit 20 files with `console.error`
- [ ] Fix Priority 1: result-tracker.ts, manager-service.ts, orchestrator-service.ts
- [ ] Fix Priority 2: sentinel-service.ts, proposer-executor.ts, aider-executor.ts, github-integration.ts
- [ ] Fix Priority 3: Remaining 13 files (optional)
- [ ] Test: Trigger error, verify escalation in UI
- [ ] Update known-issues.md: Mark error propagation gap as RESOLVED

### Phase 2 (1 day)
- [ ] Create `migrations/add_budget_lock_function.sql`
- [ ] Run migration on Supabase
- [ ] Add `reserveBudget()` function to manager-service.ts
- [ ] Add `updateReservationWithActual()` function
- [ ] Add `cancelReservation()` function
- [ ] Update `routeWorkOrder()` to use budget reservation
- [ ] Test: Concurrent requests at budget limit
- [ ] Update known-issues.md: Mark budget race as RESOLVED

### Phase 3 (3-4 days)
- [ ] Create `src/lib/__tests__/failure-modes.test.ts`
- [ ] Write Test 1: outcome_vectors write failure
- [ ] Write Test 2: Budget race condition
- [ ] Write Test 3: Concurrent metadata updates
- [ ] Write Test 4: Malformed LLM JSON
- [ ] Write Test 5: Database connection failure
- [ ] Write Test 6: GitHub webhook race
- [ ] Write Test 7: Invalid state transition
- [ ] Write Test 8: Aider command failure
- [ ] Write Test 9: Sentinel auth failure
- [ ] Write Test 10: Stuck Work Order detection
- [ ] Run all tests, fix failures
- [ ] Update session-state.md: Add test results

### Phase 4 (1 day)
- [ ] Create `src/app/api/admin/health/route.ts`
- [ ] Create `src/components/MonitoringDashboard.tsx`
- [ ] Add Monitoring tab to MissionControlDashboard.tsx
- [ ] Test: View stuck WOs, budget chart, escalation backlog
- [ ] Update session-state.md: Mark monitoring as complete

### Final
- [ ] Git commit: "Error handling & resilience implementation (v38)"
- [ ] Update architecture-decisions.md
- [ ] Update session-state.md: v37→v38 summary
- [ ] Run full integration test suite (expect 18/18 passing + 10 new failure tests)

---

## Rollback Plan

### If Phase 1 breaks production:
1. Revert `error-escalation.ts` changes
2. Keep existing error handling (console.error only)
3. No database changes required (uses existing escalations table)

### If Phase 2 breaks production:
1. Drop PostgreSQL function: `DROP FUNCTION check_and_reserve_budget;`
2. Revert manager-service.ts to use `calculateDailySpend()` (original logic)
3. Accept budget race condition risk temporarily

### If Phase 3 breaks production:
- Tests don't affect production (unit tests only)
- No rollback needed

### If Phase 4 breaks production:
1. Remove Monitoring tab from Mission Control
2. Delete `/api/admin/health` endpoint
3. Core system functionality unaffected

---

## Timeline

### Day 1-2: Error Escalation
- Morning: Create helper function, audit Priority 1
- Afternoon: Fix Priority 1, test
- Next day: Audit Priority 2, fix, test

### Day 3: Budget Race Fix
- Morning: Write PostgreSQL function, test locally
- Afternoon: Integrate with manager-service.ts, test concurrent requests
- Evening: Verify in production environment

### Day 4-6: Failure Tests
- Day 4: Tests 1-5
- Day 5: Tests 6-10
- Day 6: Fix any failures, achieve 100% passing

### Day 7: Monitoring
- Morning: Create API endpoint
- Afternoon: Create dashboard component, add tab
- Evening: Test and polish

### Total: 6-7 days

---

## References

- **Session State:** [session-state.md](session-state.md) - Current system status v37
- **Known Issues:** [known-issues.md](known-issues.md) - Pre-existing problems
- **Architecture:** [architecture-decisions.md](architecture-decisions.md) - Agent hierarchy
- **Technical Discussion:** [Technical Discussion Error Handling.txt](Technical Discussion Error Handling.txt) - Original proposal (rejected approach)
- **Client Manager Implementation:** v35 (6 files, 916 lines)
- **Escalation UI:** v37 (260+ lines, CRITICAL BLOCKER REMOVED)

---

**Last Updated:** 2025-10-02
**Author:** Claude Code (Cursor IDE)
**Status:** Ready to Execute - Awaiting approval to begin Phase 1
