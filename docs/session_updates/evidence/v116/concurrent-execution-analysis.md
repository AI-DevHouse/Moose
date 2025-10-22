# Concurrent Execution vs Bootstrap WO Dependencies - Analysis

**Date:** 2025-10-22
**Question:** Should WOs execute sequentially, concurrently with dependency-aware queuing, or leave as-is?

---

## TL;DR Answer

**Option 3: Leave concurrent execution as-is** ✅

The system ALREADY has dependency-aware execution built in. However, we discovered a **critical bug** that needs fixing first.

---

## Current Architecture Analysis

### How Dependency Resolution Works

**1. Dependency Resolver** (`dependency-resolver.ts:20-42`):
```typescript
function getExecutableWorkOrders(
  workOrders: WorkOrder[],
  completedWorkOrderIds: Set<string>
): WorkOrder[] {
  // Returns ONLY WOs where ALL dependencies are satisfied
  return workOrders.filter(wo => {
    const deps = extractDependencies(wo);
    return deps.every(depId => completedWorkOrderIds.has(depId));
  });
}
```

**Key insight:** Uses `dependencies.every()` - if even ONE dependency is incomplete, the WO is NOT returned.

---

**2. Work Order Poller** (`work-order-poller.ts:24-69`):
```typescript
async function pollPendingWorkOrders(): Promise<WorkOrder[]> {
  // Get all approved WOs
  const approvedWorkOrders = await fetchApprovedWOs();

  // Get completed WO IDs
  const completedIds = await getCompletedWorkOrderIds();

  // Filter to only executable WOs (dependencies satisfied)
  const executable = getExecutableWorkOrders(approvedWorkOrders, completedIds);

  // Return up to 10 executable WOs
  return executable.slice(0, 10);
}
```

**Key insight:** Poller only returns WOs ready to execute RIGHT NOW (all deps satisfied).

---

### How Bootstrap WO Will Work with Current System

**Scenario:** Decomposition returns:
- WO-0: Bootstrap (deps: [])
- WO-1: Redux Store (deps: [WO-0-UUID])
- WO-2: React Components (deps: [WO-0-UUID])
- WO-3: Testing (deps: [WO-0-UUID, WO-2-UUID])

**Execution Timeline:**

```
Poll #1:
  - Completed: {} (empty)
  - Approved: [WO-0, WO-1, WO-2, WO-3]
  - Executable: [WO-0] (only WO-0 has no dependencies)
  - Execute: WO-0 starts

Poll #2 (30 seconds later):
  - Completed: {} (WO-0 still running)
  - Approved: [WO-0, WO-1, WO-2, WO-3]
  - Executable: [] (WO-0 not completed yet)
  - Execute: Nothing

Poll #3 (60 seconds later):
  - Completed: {WO-0-UUID} (WO-0 finished!)
  - Approved: [WO-1, WO-2, WO-3]
  - Executable: [WO-1, WO-2] (both depend only on WO-0, now satisfied)
  - Execute: WO-1 and WO-2 start concurrently!

Poll #4 (90 seconds later):
  - Completed: {WO-0-UUID} (WO-1, WO-2 still running)
  - Approved: [WO-1, WO-2, WO-3]
  - Executable: [] (WO-3 depends on WO-2, not completed yet)
  - Execute: Nothing

Poll #5 (120 seconds later):
  - Completed: {WO-0-UUID, WO-1-UUID, WO-2-UUID}
  - Approved: [WO-3]
  - Executable: [WO-3] (all deps satisfied)
  - Execute: WO-3 starts
```

**Result:**
- ✅ Bootstrap WO-0 executes FIRST (enforced by dependency resolver)
- ✅ Feature WOs execute concurrently AFTER bootstrap completes
- ✅ Dependencies are respected (WO-3 waits for WO-2)
- ✅ Optimal performance (parallelizes when safe)

---

## Critical Bug Discovered

### Dependencies Are NOT Being Stored for Single-Spec Decompositions

**Location:** `src/app/api/architect/decompose/route.ts:270-302`

**Current code:**
```typescript
// Line 270: For non-preprocessed specs, save work orders
const workOrdersToInsert = allWorkOrders.map((wo: any) => ({
  title: wo.title,
  description: wo.description,
  // ... other fields ...
  metadata: {
    auto_approved: true,
    approved_at: new Date().toISOString(),
    approved_by: 'architect'
    // ❌ NO DEPENDENCIES STORED!
  }
}));
```

**What's missing:**
- Architect returns WOs with `dependencies: ["0", "1"]` (array indices)
- These need to be converted to actual UUIDs
- They need to be stored in `metadata.dependencies`

**Why this matters:**
- Without stored dependencies, ALL WOs appear executable immediately
- Bootstrap WO-0 and feature WOs would start concurrently
- Feature WOs would fail (no package.json/tsconfig.json yet)

---

### Dependency Storage Bug Status

**Works correctly for:**
- ✅ Preprocessed specs (multi-section documents) - lines 162-200 handle conversion

**Broken for:**
- ❌ Single-spec decompositions (most common case)

**Impact:**
- HIGH - bootstrap WO implementation won't work without this fix
- Any decomposition with dependencies will execute out-of-order

---

## Fix Required: Dependency UUID Conversion

### Current Architect Output (array indices):
```json
{
  "work_orders": [
    {
      "title": "Bootstrap Infrastructure",
      "dependencies": []
    },
    {
      "title": "Configure Redux Store",
      "dependencies": ["0"]  // ← Array index, not UUID
    },
    {
      "title": "Implement React Components",
      "dependencies": ["0", "1"]  // ← Array indices
    }
  ]
}
```

### After Database Insert (needs conversion):
```json
[
  {
    "id": "uuid-wo-0",
    "title": "Bootstrap Infrastructure",
    "metadata": {
      "dependencies": []
    }
  },
  {
    "id": "uuid-wo-1",
    "title": "Configure Redux Store",
    "metadata": {
      "dependencies": ["uuid-wo-0"]  // ← Converted!
    }
  },
  {
    "id": "uuid-wo-2",
    "title": "Implement React Components",
    "metadata": {
      "dependencies": ["uuid-wo-0", "uuid-wo-1"]  // ← Converted!
    }
  }
]
```

---

## Implementation Fix

**File:** `src/app/api/architect/decompose/route.ts:270-302`

**Change needed:**
```typescript
// After inserting WOs (line 291-294)
const { data: savedWOs, error: insertError } = await supabase
  .from('work_orders')
  .insert(workOrdersToInsert)
  .select();

if (insertError) {
  throw new Error(`Failed to save work orders: ${insertError.message}`);
}

// **NEW: Convert array indices to UUIDs and update metadata**
const dependencyUpdates = [];

for (let i = 0; i < allWorkOrders.length; i++) {
  const originalWO = allWorkOrders[i];
  const savedWO = savedWOs[i]; // Same order as inserted

  // Get dependencies from architect output (array indices)
  const deps = originalWO.dependencies || [];

  if (deps.length > 0) {
    // Convert array indices to actual UUIDs
    const dependencyUUIDs = deps.map((depIndex: string) => {
      const depIndexNum = parseInt(depIndex);
      return savedWOs[depIndexNum].id; // Get UUID of dependency WO
    });

    dependencyUpdates.push({
      id: savedWO.id,
      metadata: {
        ...savedWO.metadata,
        dependencies: dependencyUUIDs
      }
    });
  }
}

// Update WOs with converted dependencies
if (dependencyUpdates.length > 0) {
  for (const update of dependencyUpdates) {
    await supabase
      .from('work_orders')
      .update({ metadata: update.metadata })
      .eq('id', update.id);
  }
  console.log(`✅ Updated ${dependencyUpdates.length} work orders with dependencies`);
}

allWorkOrders = savedWOs; // Replace with saved work orders (includes IDs)
```

**Estimated effort:** 30 minutes (straightforward conversion logic)

---

## Answer to User's Question

### Option 1: Sequential Execution ❌

**Implementation:**
- Disable worktree pool (force pool size = 1)
- Execute WOs one at a time in dependency order

**Pros:**
- Simple, guaranteed order
- No risk of concurrent conflicts

**Cons:**
- ⚠️ Very slow (can't parallelize independent WOs)
- ⚠️ Wastes resources (CPU idle while waiting)
- ⚠️ Doesn't scale (10 WOs = 10x execution time)

**Verdict:** NOT RECOMMENDED

---

### Option 2: Concurrent with Manual Queuing ❌

**Implementation:**
- Mark WOs as executable in specific batches
- Manually queue bootstrap first, then features

**Pros:**
- Control over execution order
- Can still parallelize within batches

**Cons:**
- ⚠️ Complex logic to implement
- ⚠️ Duplicates what dependency resolver already does
- ⚠️ More code to maintain

**Verdict:** NOT RECOMMENDED (unnecessary complexity)

---

### Option 3: Leave As-Is (Current System) ✅ RECOMMENDED

**What exists:**
- ✅ Dependency resolver (filters to executable WOs)
- ✅ Poller respects dependencies (only returns ready WOs)
- ✅ Worktree pool handles concurrency (up to 10 parallel)
- ✅ Topological sort ensures correct order

**What needs fixing:**
- ❌ Dependency storage bug (must fix!)
- Add UUID conversion when storing WOs

**After bug fix:**
- ✅ Bootstrap WO-0 executes first (no dependencies)
- ✅ Feature WOs wait for bootstrap (dependency resolver blocks)
- ✅ Independent feature WOs execute concurrently (optimal performance)
- ✅ Dependent feature WOs wait for prerequisites

**Verdict:** RECOMMENDED - system already designed for this, just needs bug fix

---

## Revised Implementation Plan

**Phase 1:** Fix dependency storage bug (NEW - must do first!)
- Location: `src/app/api/architect/decompose/route.ts:290-302`
- Add UUID conversion after WO insertion
- Store converted dependencies in metadata
- **Estimated effort:** 30 minutes

**Phase 2-5:** Original plan (greenfield detection + bootstrap WO)
- Unchanged from `fix1-implementation-plan.md`
- **Estimated effort:** 6-8 hours

**Total effort:** 6.5-8.5 hours

---

## Testing Strategy

### Test 1: Bootstrap Dependency Enforcement

**Setup:**
- Create decomposition with bootstrap WO-0
- All feature WOs depend on WO-0
- Approve all WOs simultaneously

**Expected behavior:**
```
t=0s:   Poll returns [WO-0] → starts execution
t=30s:  Poll returns [] (WO-0 still running)
t=60s:  WO-0 completes → Poll returns [WO-1, WO-2, WO-3, ...] → start concurrently
```

**Success criteria:**
- ✅ WO-0 starts first
- ✅ Feature WOs do NOT start until WO-0 completes
- ✅ Multiple feature WOs start simultaneously after bootstrap

---

### Test 2: Concurrent Execution After Bootstrap

**Setup:**
- Bootstrap WO-0 completes
- 5 feature WOs approved (all depend only on WO-0)
- Worktree pool size = 10

**Expected behavior:**
- All 5 feature WOs should start concurrently in next poll

**Success criteria:**
- ✅ No sequential execution (all start together)
- ✅ Optimal resource usage

---

### Test 3: Multi-Level Dependencies

**Setup:**
- WO-0: Bootstrap (deps: [])
- WO-1: Redux Store (deps: [0])
- WO-2: React Components (deps: [0, 1])
- WO-3: Testing (deps: [0, 2])

**Expected behavior:**
```
Poll 1: Execute WO-0
Poll 2: Execute WO-1 (depends on 0, now complete)
Poll 3: Execute WO-2 (depends on 0+1, now complete)
Poll 4: Execute WO-3 (depends on 0+2, now complete)
```

**Success criteria:**
- ✅ Each WO waits for ALL dependencies
- ✅ No WO executes before prerequisites

---

## Recommendation

**Keep concurrent execution as-is, but fix dependency storage bug first.**

**Why:**
1. ✅ System already designed for dependency-aware concurrency
2. ✅ Optimal performance (parallelizes when safe)
3. ✅ Proven architecture (works for preprocessed specs)
4. ✅ No additional complexity needed
5. ✅ Just needs bug fix to work for single specs

**Action items:**
1. Fix dependency UUID conversion in `decompose/route.ts` (30 min)
2. Test dependency enforcement works correctly (30 min)
3. Proceed with greenfield detection + bootstrap WO implementation (6-8 hours)

---

## Decision Gate

**Question for approval:**

Should we proceed with Option 3 (leave concurrent as-is, fix dependency storage bug)?

**Or do you prefer:**
- Option 1: Force sequential execution (simpler but slower)
- Option 2: Manual queuing logic (complex and unnecessary)

**My recommendation: Option 3** - the system already works correctly, it just needs the bug fixed.
