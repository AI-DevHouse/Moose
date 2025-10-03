# Moose Mission Control - API Reference

**Version:** v38
**Last Updated:** 2025-10-03
**Base URL:** `http://localhost:3000/api`

---

## Table of Contents

1. [Health Monitoring API](#health-monitoring-api)
2. [Client Manager API](#client-manager-api)
3. [Orchestrator API](#orchestrator-api)
4. [Manager API](#manager-api)
5. [Error Handling](#error-handling)
6. [Rate Limiting & Budget](#rate-limiting--budget)

---

## Health Monitoring API

### GET `/api/admin/health`

Returns comprehensive system health metrics for monitoring and observability.

**Authentication:** None (admin access recommended)

#### Response Schema

```typescript
{
  status: 'healthy' | 'warning' | 'error';
  timestamp: string; // ISO 8601
  checks: {
    stuckWorkOrders: {
      status: 'healthy' | 'warning' | 'error';
      count: number;
      details: Array<{
        id: string;
        title: string;
        status: string;
        created_at: string;
      }>;
    };
    pendingEscalations: {
      status: 'healthy' | 'warning' | 'error';
      count: number;
      details: Array<{
        id: string;
        reason: string;
        status: string;
        created_at: string;
      }>;
    };
    budgetUsage: {
      status: 'healthy' | 'warning' | 'error';
      dailySpend: number;
      dailyLimit: number;
      percentUsed: number;
    };
    recentErrors: {
      status: 'healthy' | 'warning' | 'error';
      count: number;
      details: Array<{
        id: string;
        failure_classes: string[];
        created_at: string;
        work_order_id: string;
      }>;
    };
    workOrderStates: Record<string, number>;
  };
}
```

#### Status Logic

- **ERROR**: Stuck work orders OR pending escalations detected
- **WARNING**: Budget >80% used OR >10 recent errors in 24h
- **HEALTHY**: All systems operating normally

#### Example Request

```bash
curl http://localhost:3000/api/admin/health
```

#### Example Response

```json
{
  "status": "error",
  "timestamp": "2025-10-03T12:14:40.701Z",
  "checks": {
    "stuckWorkOrders": {
      "status": "error",
      "count": 6,
      "details": [
        {
          "id": "91470e6e-08ce-47ce-9662-270958dc94fb",
          "title": "Add TypeScript strict mode",
          "status": "pending",
          "created_at": "2025-09-18T10:43:10.919718+00:00"
        }
      ]
    },
    "pendingEscalations": {
      "status": "healthy",
      "count": 0,
      "details": []
    },
    "budgetUsage": {
      "status": "healthy",
      "dailySpend": 0,
      "dailyLimit": 100,
      "percentUsed": 0
    },
    "recentErrors": {
      "status": "healthy",
      "count": 0,
      "details": []
    },
    "workOrderStates": {
      "completed": 1,
      "pending": 4,
      "escalated": 1,
      "processing": 1
    }
  }
}
```

---

## Client Manager API

### POST `/api/client-manager/escalate`

Creates an escalation for a work order when critical errors occur.

**Phase 1 Implementation:** Error Audit & Escalation Enforcement

#### Request Schema

```typescript
{
  work_order_id: string;
  reason: string;
  metadata?: {
    error?: string;
    stack?: string;
    component?: string;
    operation?: string;
    [key: string]: any;
  };
}
```

#### Response Schema

```typescript
{
  success: boolean;
  escalation_id?: string;
  error?: string;
}
```

#### Example Request

```bash
curl -X POST http://localhost:3000/api/client-manager/escalate \
  -H "Content-Type: application/json" \
  -d '{
    "work_order_id": "b8dbcb2c-fad4-47e7-941e-c5a5b25f74f4",
    "reason": "Outcome vector write failure",
    "metadata": {
      "error": "Database connection timeout",
      "component": "ResultTracker",
      "operation": "writeOutcomeVectors"
    }
  }'
```

#### Example Response

```json
{
  "success": true,
  "escalation_id": "esc_123456"
}
```

#### Error Responses

- **400 Bad Request**: Missing required fields
- **500 Internal Server Error**: Database error

---

## Orchestrator API

### POST `/api/orchestrator/poll`

Polls for pending work orders and processes them through the Manager Coordinator.

**Phase 1 & 2 Implementation:** E2E orchestration with budget safety

#### Request Schema

```typescript
{
  // No request body required
}
```

#### Response Schema

```typescript
{
  success: boolean;
  processed?: number;
  errors?: Array<{
    work_order_id: string;
    error: string;
  }>;
}
```

#### Example Request

```bash
curl -X POST http://localhost:3000/api/orchestrator/poll
```

#### Example Response

```json
{
  "success": true,
  "processed": 3
}
```

#### Budget Protection

The orchestrator enforces the PostgreSQL budget reservation system:
1. Checks daily spend against $100 limit
2. Reserves budget before processing
3. Updates with actual cost after completion
4. Prevents race conditions via database locks

---

## Manager API

### POST `/api/manager/route-work-order`

Routes a work order to the appropriate proposer based on complexity analysis.

**Phase 2 Implementation:** Budget race condition fix with PostgreSQL function

#### Request Schema

```typescript
{
  work_order_id: string;
  title: string;
  description: string;
  estimated_cost: number;
}
```

#### Response Schema

```typescript
{
  success: boolean;
  routed_to?: string; // proposer_id
  reservation_id?: string;
  error?: string;
  budget_exceeded?: boolean;
}
```

#### Budget Reservation Flow

1. Calls PostgreSQL function `check_and_reserve_budget()`
2. Acquires `SHARE ROW EXCLUSIVE` lock on `cost_tracking`
3. Checks if `current_total + estimated_cost <= $100`
4. Creates reservation record if within budget
5. Returns `reservation_id` for later update

#### Example Request

```bash
curl -X POST http://localhost:3000/api/manager/route-work-order \
  -H "Content-Type: application/json" \
  -d '{
    "work_order_id": "wo_123",
    "title": "Implement feature X",
    "description": "Add new API endpoint",
    "estimated_cost": 2.50
  }'
```

#### Example Response (Success)

```json
{
  "success": true,
  "routed_to": "claude-sonnet-4-proposer",
  "reservation_id": "res_789"
}
```

#### Example Response (Budget Exceeded)

```json
{
  "success": false,
  "budget_exceeded": true,
  "error": "Daily budget limit reached ($100.00)"
}
```

---

## Error Handling

### Escalation Infrastructure

**Phase 1:** All critical errors are escalated to Client Manager

#### Error Severity Levels

1. **CRITICAL**: Requires immediate escalation
   - Database write failures
   - Budget reservation failures
   - Work order processing failures
   - LLM API failures with retries exhausted

2. **WARNING**: Logged but not escalated
   - Transient network errors (before retry exhaustion)
   - Non-critical metadata updates
   - Cache misses

#### Error Escalation Flow

```typescript
try {
  // Critical operation
  await writeOutcomeVectors(data);
} catch (error) {
  // Log error
  console.error('[ResultTracker] writeOutcomeVectors failed:', error);

  // Escalate to Client Manager
  await fetch('/api/client-manager/escalate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      work_order_id: workOrderId,
      reason: 'Outcome vector write failure',
      metadata: {
        error: error.message,
        stack: error.stack,
        component: 'ResultTracker',
        operation: 'writeOutcomeVectors'
      }
    })
  });

  // Continue with graceful degradation
}
```

---

## Rate Limiting & Budget

### Budget System

**Daily Limit:** $100.00
**Implementation:** PostgreSQL function with row-level locking
**Phase 2:** Budget race condition fix

#### Budget Reservation Function

```sql
CREATE OR REPLACE FUNCTION check_and_reserve_budget(
  p_estimated_cost DECIMAL,
  p_service_name TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS TABLE(
  can_proceed BOOLEAN,
  current_total DECIMAL,
  reservation_id UUID
)
```

#### Budget States

1. **Normal** (0-50%): All operations proceed
2. **Warning** (50-80%): Monitor closely
3. **Critical** (80-100%): Prioritize high-value work orders
4. **Exceeded** (>100%): Emergency kill - all new requests blocked

#### Checking Budget Status

```bash
curl http://localhost:3000/api/admin/health | jq '.checks.budgetUsage'
```

#### Budget Reservation Lifecycle

1. **Reserve**: `check_and_reserve_budget()` creates reservation record
2. **Process**: Work order executes, tracks actual cost
3. **Update**: Replace reservation with actual cost record
4. **Cancel**: If work order fails, reservation is removed

---

## Testing

### Phase 3: Failure Mode Tests

10 comprehensive tests validate error handling:

1. **Outcome Vectors Write Failure**: Validates escalation infrastructure
2. **Budget Race Condition**: Confirms PostgreSQL locking prevents concurrent overruns
3. **Concurrent Metadata Updates**: Tests last-write-wins semantics
4. **Malformed LLM JSON Response**: Validates JSON parsing error handling
5. **Database Connection Failure**: Tests graceful degradation
6. **GitHub Webhook Race Condition**: Tests webhook handling when PR number missing
7. **Invalid State Transition**: Tests state machine transitions
8. **Aider Command Failure**: Validates execution failure handling
9. **Sentinel Webhook Invalid Auth**: Tests signature validation logic
10. **Stuck Work Orders Detection**: Tests monitoring query for >24hr old work orders

#### Running Tests

```bash
npm test src/lib/__tests__/failure-modes.test.ts
```

---

## Monitoring Dashboard

Access the health monitoring dashboard at:

```
http://localhost:3000/admin/health
```

Or via the Mission Control Dashboard → **Health Monitor** tab

### Dashboard Features

- Real-time system health status
- Auto-refresh every 30 seconds
- Visual budget usage progress bar
- Stuck work order details
- Pending escalations list
- Work order state distribution
- Recent error summary

---

## Version History

### v38 (2025-10-03) - Error Handling & Resilience

**Phase 1:** Error Audit & Escalation Enforcement
- Added escalation infrastructure to all critical error paths
- Created `/api/client-manager/escalate` endpoint
- 84 catch blocks now escalate to Client Manager

**Phase 2:** Budget Race Condition Fix
- Implemented PostgreSQL `check_and_reserve_budget()` function
- Added `SHARE ROW EXCLUSIVE` locking to prevent race conditions
- Budget reservations prevent concurrent requests from exceeding $100 limit

**Phase 3:** Failure Mode Tests
- 10 comprehensive failure mode tests
- Validates error handling, escalation, and graceful degradation
- All tests passing (10/10)

**Phase 4:** Monitoring & Observability
- Health check API endpoint (`/api/admin/health`)
- Real-time monitoring dashboard
- System health indicators (healthy/warning/error)
- Budget tracking and visualization

---

## Support

For issues or questions, see:
- [Architecture Decisions](./architecture-decisions.md)
- [Known Issues](./known-issues.md)
- [Session State](./session-state.md)
