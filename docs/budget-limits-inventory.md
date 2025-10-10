# Budget Limits Inventory - All Hardcoded Values

## Current State

### 1. manager-service.ts (Line 84) - ✅ ALREADY DISABLED
```typescript
// Hardcoded $100 in error message (commented out)
error: new Error(`Daily budget exceeded: $${reservation.currentTotal} + $${estimatedCost} > $100`)
```
**Status:** Already disabled via commenting

### 2. client-manager-service.ts (Lines 266-269) - ❌ NEEDS FIX
```typescript
const budgetConfig = budgetConfigRow?.value ? JSON.parse(budgetConfigRow.value) : {
  soft_cap: 20,      // ← HARDCODED $20
  hard_cap: 50,      // ← HARDCODED $50
  emergency_kill: 100 // ← HARDCODED $100
}
```
**Status:** Fallback defaults, needs database entry

### 3. Database: system_config.budget_limits - ✅ EXISTS
```json
{
  "daily_soft_cap": 50,
  "daily_hard_cap": 100,
  "emergency_kill": 200,
  "monthly_target": 500,
  "monthly_hard_cap": 1000
}
```
**Status:** Exists but values are too low

### 4. Database: system_config.budget_thresholds - ❌ MISSING
**Status:** Key doesn't exist, causing fallback to hardcoded values

### 5. RPC Function: check_and_reserve_budget - ⚠️ UNKNOWN
**Location:** Supabase database function
**Status:** May have hardcoded limit, need to check

---

## Solution Plan

### Step 1: Insert budget_thresholds into database
Set to "unlimited" values (very high numbers):
```json
{
  "soft_cap": 999999,
  "hard_cap": 999999,
  "emergency_kill": 999999
}
```

### Step 2: Update budget_limits to unlimited
```json
{
  "daily_soft_cap": 999999,
  "daily_hard_cap": 999999,
  "emergency_kill": 999999,
  "monthly_target": 999999,
  "monthly_hard_cap": 999999
}
```

### Step 3: Remove/Update RPC function
Check `check_and_reserve_budget` and either:
- Remove hardcoded limits
- Make it always return `can_proceed: true`

### Step 4: Clean up code
- Keep disabled budget check in manager-service.ts
- Remove fallback defaults in client-manager-service.ts (fail if missing instead)
