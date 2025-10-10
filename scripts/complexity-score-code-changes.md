# Code Changes for Complexity Score Column

**Status:** PREPARED BUT NOT APPLIED
**Apply After:** Current iteration completes
**Requires:** Run `add-complexity-score-column.sql` migration first, then rebuild with these changes

---

## File: src/lib/orchestrator/result-tracker.ts

### Change 1: Update trackSuccessfulExecution (Line 38-67)

**Before:**
```typescript
const { error: woError } = await supabase
  .from('work_orders')
  .update({
    status: 'in_progress',
    github_pr_url: prResult.pr_url,
    github_pr_number: prResult.pr_number,
    github_branch: prResult.branch_name,
    metadata: {
      ...wo.metadata,
      routing_decision: {
        selected_proposer: routingDecision.selected_proposer,
        reason: routingDecision.reason,
        confidence: routingDecision.confidence,
        routing_metadata: routingDecision.routing_metadata
      },
      // ... rest of metadata
    }
  } as any)
  .eq('id', wo.id);
```

**After:**
```typescript
const { error: woError } = await supabase
  .from('work_orders')
  .update({
    status: 'in_progress',
    github_pr_url: prResult.pr_url,
    github_pr_number: prResult.pr_number,
    github_branch: prResult.branch_name,
    complexity_score: routingDecision.routing_metadata.complexity_score, // NEW: Direct column
    metadata: {
      ...wo.metadata,
      routing_decision: {
        selected_proposer: routingDecision.selected_proposer,
        reason: routingDecision.reason,
        confidence: routingDecision.confidence,
        routing_metadata: routingDecision.routing_metadata // KEEP: Also in metadata for backwards compat
      },
      // ... rest of metadata
    }
  } as any)
  .eq('id', wo.id);
```

### Change 2: Update trackFailedExecution (Line 182-196)

**Before:**
```typescript
const { error: woError } = await supabase
  .from('work_orders')
  .update({
    status: 'failed',
    metadata: {
      ...wo.metadata,
      orchestrator_error: {
        stage,
        message: error.message,
        failure_class: classification.failure_class,
        error_context: classification.error_context,
        timestamp: new Date().toISOString()
      }
    }
  } as any)
  .eq('id', wo.id);
```

**After:**
```typescript
// Extract complexity score from existing metadata if available
const existingComplexityScore = wo.metadata?.routing_decision?.routing_metadata?.complexity_score;

const { error: woError } = await supabase
  .from('work_orders')
  .update({
    status: 'failed',
    complexity_score: existingComplexityScore || null, // NEW: Preserve existing complexity score on failure
    metadata: {
      ...wo.metadata,
      orchestrator_error: {
        stage,
        message: error.message,
        failure_class: classification.failure_class,
        error_context: classification.error_context,
        timestamp: new Date().toISOString()
      }
    }
  } as any)
  .eq('id', wo.id);
```

---

## File: src/app/api/architect/decompose/route.ts (Optional)

If Architect creates work orders with complexity scores from the start:

### Change 3: Add complexity_score when creating work orders (Line ~212-225)

**Before:**
```typescript
const workOrderData = {
  title: wo.title,
  description: wo.description,
  risk_level: wo.risk_level,
  estimated_cost: wo.estimated_cost,
  pattern_confidence: wo.pattern_confidence,
  metadata: {
    auto_approved: true,
    // ... other metadata
  }
};
```

**After:**
```typescript
const workOrderData = {
  title: wo.title,
  description: wo.description,
  risk_level: wo.risk_level,
  estimated_cost: wo.estimated_cost,
  pattern_confidence: wo.pattern_confidence,
  complexity_score: wo.complexity_score || null, // NEW: If Architect calculates it
  metadata: {
    auto_approved: true,
    complexity_score: wo.complexity_score, // KEEP: Also in metadata
    // ... other metadata
  }
};
```

---

## Benefits

1. **Easy Querying:**
   ```sql
   SELECT * FROM work_orders WHERE complexity_score > 0.7;
   ```

2. **Indexed for Performance:**
   - Fast filtering and sorting by complexity

3. **Backwards Compatible:**
   - Still stored in metadata for existing code
   - Backfill script migrates existing records

4. **Analytics Friendly:**
   - Direct column joins
   - No JSONB extraction overhead

---

## Testing After Changes

```typescript
// scripts/verify-complexity-column.ts
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify() {
  const { data } = await supabase
    .from('work_orders')
    .select('id, title, complexity_score, metadata')
    .not('complexity_score', 'is', null)
    .limit(5);

  console.log('Sample work orders with complexity_score:');
  data?.forEach(wo => {
    const metadataScore = wo.metadata?.routing_decision?.routing_metadata?.complexity_score;
    console.log(`${wo.title}`);
    console.log(`  Column: ${wo.complexity_score}`);
    console.log(`  Metadata: ${metadataScore}`);
    console.log(`  Match: ${wo.complexity_score === metadataScore ? '✅' : '❌'}`);
    console.log();
  });
}

verify();
```

---

## Deployment Steps

1. ✅ SQL migration created: `scripts/add-complexity-score-column.sql`
2. ⏸️ Wait for current iteration to complete
3. ⏸️ Run SQL migration in Supabase dashboard
4. ⏸️ Apply code changes to result-tracker.ts
5. ⏸️ Run `npm run build` to verify TypeScript
6. ⏸️ Test with verification script
7. ⏸️ Restart orchestrator daemon
