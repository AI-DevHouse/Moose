# Session v38 - Phase 4 Handover: Monitoring Dashboard

**Date:** 2025-10-03
**Status:** Phases 1-3 Complete ✅ | Starting Phase 4
**Context:** Moose Mission Control - Error Handling & Resilience Implementation

---

## What's Already Done (Phases 1-3) ✅

### Phase 1: Error Escalation ✅
- **Created:** `src/lib/error-escalation.ts` - Centralized error handler calling Client Manager API
- **Fixed 7 critical files** with error escalation integrated
- **TypeScript:** 0 errors
- **Commit:** `8c865eb`

### Phase 2: Budget Race Fix ✅
- **Created:** PostgreSQL function `check_and_reserve_budget()` with table-level locking
- **Updated:** `src/lib/manager-service.ts` with budget reservation logic
- **Test Results:** Budget race test passes - only 1 of 2 concurrent requests succeeds at limit
- **Commit:** `8c865eb`

### Phase 3: Failure Mode Tests ✅
- **Created:** `src/lib/__tests__/failure-modes.test.ts` with 10 comprehensive tests
- **Created:** `vitest.config.ts` and `src/lib/__tests__/setup.ts`
- **All 10 tests passing** and executing full logic (not just skips)
- **Duration:** 3.18s
- **Commit:** `fa67473`

**Total Commits:** 2 (Phases 1&2 combined, Phase 3 separate)

---

## Your Task: Phase 4 - Monitoring Dashboard

### Objective
Provide real-time visibility into system health and proactive problem detection via a monitoring dashboard.

### Current State
- ✅ Error escalation infrastructure working
- ✅ Budget enforcement with PostgreSQL locking
- ✅ 10 failure mode tests passing
- ❌ **No monitoring dashboard**
- ❌ **No health check API**

---

## Implementation Steps (Follow Exactly)

### Step 4.1: Create Health Check API Endpoint

**File:** Create `src/app/api/admin/health/route.ts`

```typescript
// src/app/api/admin/health/route.ts
// Admin health monitoring endpoint

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
  try {
    const supabase = createSupabaseServiceClient();

    // 1. Detect stuck work orders (>24 hours)
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { data: stuckWOs } = await supabase
      .from('work_orders')
      .select('id, title, status, updated_at')
      .eq('status', 'processing')
      .lt('updated_at', cutoffTime.toISOString());

    const stuckWorkOrders = (stuckWOs || []).map(wo => ({
      id: wo.id,
      title: wo.title,
      status: wo.status,
      stuck_hours: Math.floor((Date.now() - new Date(wo.updated_at).getTime()) / (1000 * 60 * 60)),
      updated_at: wo.updated_at
    }));

    // 2. Calculate daily budget
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const { data: costs } = await supabase
      .from('cost_tracking')
      .select('cost, metadata')
      .gte('created_at', startOfDay.toISOString());

    const totalSpent = costs?.reduce((sum, c) => sum + Number(c.cost), 0) || 0;
    const reservations = costs?.filter(c => c.metadata?.type === 'reservation').length || 0;
    const dailyLimit = 100;

    const budgetPercentage = (totalSpent / dailyLimit) * 100;
    let budgetStatus: 'normal' | 'warning' | 'critical' = 'normal';
    if (budgetPercentage >= 90) budgetStatus = 'critical';
    else if (budgetPercentage >= 75) budgetStatus = 'warning';

    // 3. Calculate error rates
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { data: escalationsLastHour } = await supabase
      .from('escalations')
      .select('id')
      .gte('created_at', oneHourAgo.toISOString());

    const { data: escalationsLast24h } = await supabase
      .from('escalations')
      .select('id')
      .gte('created_at', oneDayAgo.toISOString());

    // 4. Escalation backlog
    const { data: openEscalations } = await supabase
      .from('escalations')
      .select('created_at, resolved_at')
      .eq('status', 'open');

    const { data: resolvedEscalations } = await supabase
      .from('escalations')
      .select('created_at, resolved_at')
      .not('resolved_at', 'is', null)
      .gte('created_at', oneDayAgo.toISOString());

    const avgResolutionTime = resolvedEscalations?.reduce((sum, e) => {
      const created = new Date(e.created_at).getTime();
      const resolved = new Date(e.resolved_at!).getTime();
      return sum + (resolved - created);
    }, 0) || 0;

    const avgResolutionHours = resolvedEscalations?.length
      ? avgResolutionTime / resolvedEscalations.length / (1000 * 60 * 60)
      : 0;

    // 5. Agent health (simplified - can be enhanced with outcome_vectors data)
    const agentHealth = {
      architect: { status: 'healthy' as const, last_success: new Date().toISOString() },
      director: { status: 'healthy' as const, last_success: new Date().toISOString() },
      manager: { status: 'healthy' as const, last_success: new Date().toISOString() },
      proposers: { status: 'healthy' as const, last_success: new Date().toISOString() },
      orchestrator: { status: 'healthy' as const, last_success: new Date().toISOString() },
      sentinel: { status: 'healthy' as const, last_success: new Date().toISOString() },
      client_manager: { status: 'healthy' as const, last_success: new Date().toISOString() }
    };

    const health: SystemHealth = {
      stuckWorkOrders,
      dailyBudget: {
        spent: totalSpent,
        limit: dailyLimit,
        percentage: budgetPercentage,
        status: budgetStatus,
        reservations
      },
      errorRate: {
        last_hour: escalationsLastHour?.length || 0,
        last_24h: escalationsLast24h?.length || 0
      },
      escalationBacklog: {
        open: openEscalations?.length || 0,
        avg_resolution_time_hours: avgResolutionHours
      },
      agentHealth
    };

    return NextResponse.json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    );
  }
}
```

---

### Step 4.2: Create Monitoring Dashboard Component

**File:** Create `src/components/MonitoringDashboard.tsx`

```typescript
// src/components/MonitoringDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import type { SystemHealth } from '@/app/api/admin/health/route';

export default function MonitoringDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/admin/health');
        if (!res.ok) throw new Error('Health check failed');
        const data = await res.json();
        setHealth(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-8">Loading system health...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!health) return null;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">System Health Monitor</h1>

      {/* Budget Status */}
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Daily Budget</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Spent:</span>
            <span className="font-mono">${health.dailyBudget.spent.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Limit:</span>
            <span className="font-mono">${health.dailyBudget.limit.toFixed(2)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className={`h-4 rounded-full ${
                health.dailyBudget.status === 'critical' ? 'bg-red-600' :
                health.dailyBudget.status === 'warning' ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(health.dailyBudget.percentage, 100)}%` }}
            />
          </div>
          <div className="text-sm text-gray-600">
            {health.dailyBudget.percentage.toFixed(1)}% used
            ({health.dailyBudget.reservations} active reservations)
          </div>
        </div>
      </div>

      {/* Stuck Work Orders */}
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">
          Stuck Work Orders ({health.stuckWorkOrders.length})
        </h2>
        {health.stuckWorkOrders.length === 0 ? (
          <p className="text-gray-600">No stuck work orders</p>
        ) : (
          <div className="space-y-2">
            {health.stuckWorkOrders.map(wo => (
              <div key={wo.id} className="border-l-4 border-red-500 pl-4 py-2">
                <div className="font-semibold">{wo.title}</div>
                <div className="text-sm text-gray-600">
                  Stuck for {wo.stuck_hours} hours (Status: {wo.status})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error Rates */}
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Error Rates</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600">Last Hour</div>
            <div className="text-2xl font-bold">{health.errorRate.last_hour}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Last 24 Hours</div>
            <div className="text-2xl font-bold">{health.errorRate.last_24h}</div>
          </div>
        </div>
      </div>

      {/* Escalation Backlog */}
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Escalation Backlog</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Open Escalations:</span>
            <span className="font-bold text-xl">{health.escalationBacklog.open}</span>
          </div>
          <div className="flex justify-between">
            <span>Avg Resolution Time:</span>
            <span className="font-mono">
              {health.escalationBacklog.avg_resolution_time_hours.toFixed(1)}h
            </span>
          </div>
        </div>
      </div>

      {/* Agent Health */}
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Agent Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(health.agentHealth).map(([agent, status]) => (
            <div key={agent} className="text-center">
              <div className="text-sm text-gray-600 capitalize">{agent}</div>
              <div className={`text-lg font-bold ${
                status.status === 'healthy' ? 'text-green-600' :
                status.status === 'degraded' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {status.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

### Step 4.3: Add Dashboard Route

**File:** Create `src/app/admin/health/page.tsx`

```typescript
// src/app/admin/health/page.tsx
import MonitoringDashboard from '@/components/MonitoringDashboard';

export default function HealthPage() {
  return <MonitoringDashboard />;
}
```

---

### Step 4.4: Test Phase 4

**Manual Testing Steps:**

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Visit health API:**
   - Open: `http://localhost:3000/api/admin/health`
   - Verify JSON response with all health metrics

3. **Visit dashboard:**
   - Open: `http://localhost:3000/admin/health`
   - Verify all panels render
   - Wait 30s and verify auto-refresh

4. **Test alerts:**
   - Create stuck work order (>24 hours old)
   - Verify it appears in "Stuck Work Orders" panel
   - Verify budget percentage updates as costs are added

---

## Success Criteria (Phase 4)

Phase 4 is complete when:

- ✅ Health API endpoint returns all metrics
- ✅ Dashboard renders all panels correctly
- ✅ Auto-refresh works (30s interval)
- ✅ Stuck work orders display correctly
- ✅ Budget status shows correct percentage and color coding
- ✅ Error rates display correctly
- ✅ TypeScript: 0 errors

---

## Verification Commands

```bash
# Check TypeScript
npx tsc --noEmit

# Start dev server
npm run dev

# Test health API (in another terminal)
curl http://localhost:3000/api/admin/health

# Visit dashboard
# Open browser: http://localhost:3000/admin/health
```

---

## Important Context

### Environment Variables
- `.env.local` contains Supabase credentials
- Dev server runs on `http://localhost:3000`
- Current branch: `feature/wo-b8dbcb2c-orchestrator-e2e-test`

### Key Files from Previous Phases
- `src/lib/error-escalation.ts` (Phase 1 - don't modify)
- `src/lib/manager-service.ts` (Phase 2 - has budget logic)
- `src/lib/__tests__/failure-modes.test.ts` (Phase 3 - reference for queries)

### Database Tables Used
- `work_orders` - for stuck detection
- `cost_tracking` - for budget monitoring
- `escalations` - for error rates and backlog
- `outcome_vectors` - (optional) for agent health

### Design Decisions
- **30s refresh interval** - Balance between real-time and API load
- **24h threshold** for stuck work orders - Industry standard
- **Budget thresholds:** 75% warning, 90% critical
- **Agent health:** Simplified in initial implementation (can enhance later)

---

## What NOT to Do

❌ Don't modify Phase 1-3 files (`error-escalation.ts`, `manager-service.ts`, test files)
❌ Don't create authentication/authorization (out of scope for Phase 4)
❌ Don't add complex agent health logic yet (keep it simple)
❌ Don't break existing functionality

---

## Reference Documents

**Primary:** `docs/error-handling-resilience-plan.md` (lines 762-809) - Phase 4 details
**Context:** This handover document
**Session State:** `docs/session-state.md` - System status

---

## Next Steps After Phase 4

Once Phase 4 is complete and tested:
1. Report success criteria met
2. Optionally commit: `git commit -m "Phase 4: Monitoring Dashboard"`
3. System is production-ready for error handling & resilience!

---

**Good luck! The monitoring dashboard will provide crucial visibility into system health.**
