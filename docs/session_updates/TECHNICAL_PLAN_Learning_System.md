# Technical Plan: Moose Self-Learning System

---
## 📊 STATUS UPDATE - 2025-10-17

**Implementation Progress:** 62.5% complete (5/8 phases)

**Completed Phases:**
- ✅ Phase 0 (Foundation): **100% COMPLETE** - Database schema, failure-classifier.ts (351 lines), decision-logger.ts (264 lines)
- ✅ Phase 1 (Production Feedback): **90% COMPLETE** - Proposer refinement enhanced, result tracking operational, monitoring dashboard skipped

**Not Started:**
- ❌ Phase 2 (Supervised Improvement): **0% COMPLETE** - **BLOCKS PRODUCTION QUALITY CLAIM**
  - Missing: All 6 scripts (cleanup, run, score, analyze, propose, loop)
  - Missing: Scoring rubrics, test_iterations table, moose_improvements table
  - Impact: Cannot prove improvements work or measure quality objectively

**Quality Findings (v99 test):**
- 5/5 test WOs failed refinement with TypeScript import errors (TS2307 - missing modules)
- 4/5 WOs had clean extraction (validator working), 1/5 had persistent code fences
- **Systematic issue:** Proposer generates imports for non-existent dependencies

**Recommendation:** Prioritize Phase 2 implementation (5-7 days) to enable quality validation before production deployment.

**Detailed Assessment:** See [PRODUCTION_READINESS_ASSESSMENT_20251017.md](./PRODUCTION_READINESS_ASSESSMENT_20251017.md)

---

**Document Type:** Implementation Plan
**Status:** Planning - Partial Implementation
**Date:** 2025-10-09
**Author:** Claude (Sonnet 4.5)
**Context:** Evaluating two learning system proposals for Moose Mission Control

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Option Analysis](#option-analysis)
4. [Recommended Implementation Strategy](#recommended-implementation-strategy)
5. [Phase 0: Foundation (Shared Infrastructure)](#phase-0-foundation-shared-infrastructure)
6. [Phase 1: Production Feedback Loops](#phase-1-production-feedback-loops)
7. [Phase 2: Supervised Improvement System](#phase-2-supervised-improvement-system)
8. [Implementation Decisions & Rationale](#implementation-decisions--rationale)
9. [Risk Assessment](#risk-assessment)
10. [Success Criteria](#success-criteria)
11. [Timeline & Effort Estimates](#timeline--effort-estimates)

---

## Executive Summary

### The Challenge

Moose Mission Control executes work orders but lacks structured learning from outcomes. Two proposals exist:

**Option A:** Strengthen existing feedback loops (small scope, immediate value)
**Option B:** Build supervised improvement system (large scope, systematic validation)

### Recommended Approach: Phased Hybrid

**Don't choose one - build both in sequence.** Option A creates the data foundation that Option B requires. Implement in 3 phases:

1. **Phase 0 (1-2 days):** Shared infrastructure - database schema, failure classification
2. **Phase 1 (2-3 days):** Production feedback loops - capture accurate data from real work orders
3. **Phase 2 (5-7 days):** Supervised improvement - use captured data to improve Moose systematically

**Total timeline:** 8-12 days to full system

**Key insight:** Option B's supervised loop needs the failure classification and structured data from Option A. Building A first isn't wasted work - it's a prerequisite.

---

## Current State Analysis

### What Exists Today (Verified in Codebase)

#### Outcome Tracking Infrastructure

**File:** `src/lib/orchestrator/result-tracker.ts`
**What it does:**
- Updates work_orders table with completion status
- Inserts cost_tracking records
- Inserts outcome_vectors records

**Current outcome_vectors schema (inferred from usage):**
```typescript
{
  id: UUID,
  work_order_id: UUID,
  execution_time: number, // milliseconds
  success: boolean,
  cost: number, // dollars
  metadata: JSONB, // unstructured
  created_at: timestamp
}
```

**Gap:** No failure classification, no structured error context, no learning categorization.

#### Proposer Self-Refinement

**File:** `src/lib/enhanced-proposer-service.ts`
**Lines:** 219-284
**What it does:**
- Detects TypeScript compilation errors
- Retries with error context (max 3 cycles)
- Stores refinement_metadata in response

**Current refinement detection:**
- ✅ TypeScript errors (via regex)
- ❌ Contract violations (not integrated)
- ❌ Failure classification (not tagged)

**Gap:** Contract validation exists (`src/lib/contract-validator.ts`) but isn't called during refinement. Failures aren't categorized.

#### Error Escalation

**File:** `src/lib/error-escalation.ts`
**What it does:**
- Logs errors to console
- Posts to `/api/client-manager/escalate`
- Creates escalation records

**Current escalations schema (inferred from code):**
```typescript
{
  id: UUID,
  work_order_id: UUID,
  reason: string,
  metadata: JSONB, // { error, stack, component, operation }
  status: 'open' | 'resolved',
  created_at: timestamp
}
```

**Gap:** No structured failure_class, no resolution tracking, no pattern analysis.

#### Client Manager

**File:** `src/app/api/client-manager/escalate/route.ts`
**What it does:**
- Receives escalations
- Stores in database
- Returns escalation record

**What it doesn't do:**
- ❌ Generate resolution options
- ❌ Provide recommendations
- ❌ Track which options were chosen
- ❌ Learn from resolutions

**Gap:** No `escalation_scripts` table for tracking human decisions.

### What's Missing (Required for Learning)

1. **Failure Classification:** No consistent taxonomy for why work orders fail
2. **Contract Validation Integration:** Exists but not called during refinement
3. **Structured Error Context:** Errors are logged as strings, not parsed objects
4. **Resolution Tracking:** No record of which solutions worked
5. **Pattern Analysis:** No queries to identify recurring failures
6. **Improvement Tracking:** No way to measure if changes to Moose actually helped

---

## Option Analysis

### Option A: Production Feedback Loops

**Source:** `docs/Discussion - Strengthening Reinforcement Learning Loops.txt`

**Core Idea:** Improve data capture from existing execution pipeline without adding new agents.

**Proposed Changes:**

1. Add `failure_class` enum to outcome_vectors
2. Integrate contract validation into proposer refinement
3. Enhance escalation logging with structured data
4. Add monitoring dashboard failure summary

**Pros:**
- ✅ Small scope, fits MVP mindset
- ✅ Immediate value (better debugging)
- ✅ No new agents or complex systems
- ✅ Reuses existing tables (outcome_vectors, escalations)
- ✅ Foundation for future learning (creates structured data)

**Cons:**
- ⚠️ Doesn't validate that improvements work
- ⚠️ Requires human to interpret patterns
- ⚠️ No systematic improvement process

**Estimated Effort:** 2-3 days

### Option B: Supervised Improvement System

**Source:** `docs/Discussion_Self_Reinforcement_Learning.txt`

**Core Idea:** Iteratively build same test app, score quality, propose improvements, human approves, repeat until quality target met.

**Proposed Changes:**

1. New tables: test_iterations, iteration_work_order_logs, moose_improvements
2. Cleanup script (delete project/WOs between iterations)
3. Iteration test script (run decompose → execute → score)
4. Scoring system with objective rubrics
5. Analysis system (identify root causes)
6. Proposal generation (suggest fixes to Moose)
7. Supervised approval loop (human reviews before applying)

**Pros:**
- ✅ Systematic validation (proves improvements work)
- ✅ Objective measurement (1-10 rubrics)
- ✅ Safe (human approves changes)
- ✅ Self-documenting (reports explain reasoning)
- ✅ Ensures Moose quality increases

**Cons:**
- ⚠️ Large scope (5-7 days)
- ⚠️ Requires structured failure data (dependency on Option A)
- ⚠️ Complex orchestration (cleanup, execute, score, analyze, propose, apply)
- ⚠️ Needs test spec that's representative

**Estimated Effort:** 5-7 days (assumes Option A data structures exist)

### Why Not Choose One?

**Key Insight:** Option B needs the data structures from Option A.

**Evidence:**
- Scoring requires knowing WHY work orders failed → needs `failure_class`
- Analysis requires understanding error patterns → needs structured `error_context`
- Proposals require knowing what works → needs resolution tracking

**Attempting Option B without Option A would result in:**
- Vague analysis ("Some work orders failed")
- Generic proposals ("Improve error handling")
- No measurable impact ("Quality still 5/10 after changes")

**Conclusion:** Build Option A first to create data foundation, then build Option B on top of it.

---

## Recommended Implementation Strategy

### Three-Phase Approach

```
Phase 0 (1-2 days)
  Foundation
  - Database schema extensions
  - Failure classification system
  - Helper functions
  ↓
Phase 1 (2-3 days)
  Production Feedback Loops (Option A)
  - Contract validation integration
  - Failure tagging throughout pipeline
  - Enhanced escalation logging
  - Monitoring dashboard
  ↓
Phase 2 (5-7 days)
  Supervised Improvement (Option B)
  - Test iteration infrastructure
  - Cleanup automation
  - Scoring system
  - Analysis & proposal generation
  - Supervised approval loop
```

**Rationale:** Each phase builds on the previous, no wasted effort, can stop after any phase and still have value.

---

## Phase 0: Foundation (Shared Infrastructure)

### Objective

Create data structures and helpers that both Option A and Option B require.

### Database Schema Extensions

#### Extension 1: Add failure_class to outcome_vectors

**Current schema:**
```sql
CREATE TABLE outcome_vectors (
  id UUID PRIMARY KEY,
  work_order_id UUID REFERENCES work_orders(id),
  execution_time INTEGER,
  success BOOLEAN,
  cost NUMERIC,
  metadata JSONB,
  created_at TIMESTAMPTZ
);
```

**Proposed changes:**
```sql
-- Add failure classification enum
CREATE TYPE failure_class_enum AS ENUM (
  'compile_error',        -- TypeScript/build errors
  'contract_violation',   -- Breaking changes detected
  'test_fail',           -- Tests failed
  'lint_error',          -- Linting issues
  'orchestration_error', -- Aider/git/PR failures
  'budget_exceeded',     -- Hit budget cap
  'dependency_missing',  -- Blocked by dependencies
  'timeout',             -- Execution timeout
  'unknown'              -- Unclassified failure
);

-- Add columns to outcome_vectors
ALTER TABLE outcome_vectors
  ADD COLUMN failure_class failure_class_enum,
  ADD COLUMN error_context JSONB; -- Structured error details
```

**error_context structure:**
```typescript
{
  error_message: string,
  error_type: string, // 'TypeError', 'SyntaxError', etc.
  stack_trace?: string,
  failed_file?: string,
  failed_line?: number,
  failed_tests?: string[], // For test_fail
  contract_violations?: Array<{
    type: 'breaking_change',
    file: string,
    description: string
  }>,
  original_error?: any // Raw error object
}
```

#### Extension 2: Add resolution tracking to escalations

**Current schema:**
```sql
CREATE TABLE escalations (
  id UUID PRIMARY KEY,
  work_order_id UUID REFERENCES work_orders(id),
  reason TEXT,
  metadata JSONB,
  status TEXT, -- 'open' | 'resolved'
  created_at TIMESTAMPTZ
);
```

**Proposed changes:**
```sql
-- Add resolution tracking
ALTER TABLE escalations
  ADD COLUMN failure_class failure_class_enum,
  ADD COLUMN resolved_at TIMESTAMPTZ,
  ADD COLUMN resolution_type TEXT CHECK (resolution_type IN (
    'retry',
    'manual_fix',
    'skip',
    'moose_improvement',
    'external_dependency'
  )),
  ADD COLUMN resolution_notes TEXT,
  ADD COLUMN resolved_by TEXT; -- 'human' | 'system'
```

#### Extension 3: Create decision_logs for pattern tracking

**New table:**
```sql
CREATE TABLE decision_logs (
  id UUID PRIMARY KEY,
  work_order_id UUID REFERENCES work_orders(id),
  decision_type TEXT CHECK (decision_type IN (
    'routing',           -- Manager routing decision
    'refinement_cycle',  -- Proposer self-refinement
    'escalation',        -- Error escalated
    'retry',             -- Retry attempted
    'skip'               -- Work order skipped
  )),
  decision_context JSONB, -- Why this decision was made
  decision_result TEXT,   -- 'success' | 'failure'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decision_logs_wo ON decision_logs(work_order_id);
CREATE INDEX idx_decision_logs_type ON decision_logs(decision_type);
```

**Purpose:** Track all decision points for pattern analysis.

### Helper Functions

#### Function 1: Classify error

**File:** `src/lib/failure-classifier.ts` (new file)

```typescript
export type FailureClass =
  | 'compile_error'
  | 'contract_violation'
  | 'test_fail'
  | 'lint_error'
  | 'orchestration_error'
  | 'budget_exceeded'
  | 'dependency_missing'
  | 'timeout'
  | 'unknown';

export interface ErrorContext {
  error_message: string;
  error_type: string;
  stack_trace?: string;
  failed_file?: string;
  failed_line?: number;
  failed_tests?: string[];
  contract_violations?: Array<{
    type: 'breaking_change';
    file: string;
    description: string;
  }>;
  original_error?: any;
}

export function classifyError(error: Error, context?: {
  component?: string;
  operation?: string;
  metadata?: any;
}): { failure_class: FailureClass; error_context: ErrorContext } {
  const errorMessage = error.message.toLowerCase();

  // TypeScript compilation errors
  if (errorMessage.includes('typescript') ||
      errorMessage.includes('tsc') ||
      errorMessage.includes('type error')) {
    return {
      failure_class: 'compile_error',
      error_context: {
        error_message: error.message,
        error_type: error.name,
        stack_trace: error.stack,
        ...extractTypeScriptDetails(error)
      }
    };
  }

  // Contract violations (from contract-validator)
  if (context?.metadata?.contract_validation?.has_violations) {
    return {
      failure_class: 'contract_violation',
      error_context: {
        error_message: error.message,
        error_type: error.name,
        contract_violations: context.metadata.contract_validation.violations
      }
    };
  }

  // Test failures
  if (errorMessage.includes('test') && errorMessage.includes('fail')) {
    return {
      failure_class: 'test_fail',
      error_context: {
        error_message: error.message,
        error_type: error.name,
        failed_tests: extractFailedTests(error)
      }
    };
  }

  // Orchestration errors (Aider, git, PR creation)
  if (context?.component === 'AiderExecutor' ||
      context?.component === 'GitHubIntegration' ||
      errorMessage.includes('git') ||
      errorMessage.includes('aider')) {
    return {
      failure_class: 'orchestration_error',
      error_context: {
        error_message: error.message,
        error_type: error.name,
        stack_trace: error.stack
      }
    };
  }

  // Budget exceeded
  if (errorMessage.includes('budget') ||
      errorMessage.includes('emergency_kill')) {
    return {
      failure_class: 'budget_exceeded',
      error_context: {
        error_message: error.message,
        error_type: error.name
      }
    };
  }

  // Timeout
  if (errorMessage.includes('timeout') ||
      errorMessage.includes('timed out')) {
    return {
      failure_class: 'timeout',
      error_context: {
        error_message: error.message,
        error_type: error.name
      }
    };
  }

  // Default: unknown
  return {
    failure_class: 'unknown',
    error_context: {
      error_message: error.message,
      error_type: error.name,
      stack_trace: error.stack,
      original_error: JSON.stringify(error, Object.getOwnPropertyNames(error))
    }
  };
}

function extractTypeScriptDetails(error: Error) {
  // Parse TypeScript error for file and line
  // Example: "src/app/page.tsx:42:5 - error TS2322: Type 'string' is not assignable..."
  const match = error.message.match(/([^:]+):(\d+):(\d+)/);
  if (match) {
    return {
      failed_file: match[1],
      failed_line: parseInt(match[2])
    };
  }
  return {};
}

function extractFailedTests(error: Error): string[] {
  // Parse test output for failed test names
  // This depends on test framework (vitest, jest, etc.)
  const lines = error.message.split('\n');
  const failedTests: string[] = [];

  for (const line of lines) {
    if (line.includes('FAIL') || line.includes('✗')) {
      // Extract test name from line
      const testMatch = line.match(/['"](.*?)['"]/);
      if (testMatch) {
        failedTests.push(testMatch[1]);
      }
    }
  }

  return failedTests;
}
```

**Implementation notes:**
- Start with basic classification (exact string matches)
- Improve over time based on real errors encountered
- Can add ML-based classification later

#### Function 2: Log decision

**File:** `src/lib/decision-logger.ts` (new file)

```typescript
import { createSupabaseServiceClient } from './supabase';

export type DecisionType =
  | 'routing'
  | 'refinement_cycle'
  | 'escalation'
  | 'retry'
  | 'skip';

export async function logDecision(params: {
  work_order_id: string;
  decision_type: DecisionType;
  decision_context: any;
  decision_result: 'success' | 'failure';
}) {
  const supabase = createSupabaseServiceClient();

  const { error } = await supabase
    .from('decision_logs')
    .insert({
      work_order_id: params.work_order_id,
      decision_type: params.decision_type,
      decision_context: params.decision_context,
      decision_result: params.decision_result
    });

  if (error) {
    console.error('[DecisionLogger] Failed to log decision:', error);
    // Don't throw - logging failure shouldn't crash pipeline
  }
}
```

### Implementation Steps - Phase 0

**Step 0.1: Apply database migrations (30 minutes)**
- Run SQL in Supabase SQL Editor
- Verify tables and columns created
- Test enum type works correctly

**Step 0.2: Create failure-classifier.ts (2 hours)**
- Implement classifyError function
- Add extractTypeScriptDetails helper
- Add extractFailedTests helper
- Write unit tests for classification logic

**Step 0.3: Create decision-logger.ts (1 hour)**
- Implement logDecision function
- Add error handling (don't throw on log failure)
- Test inserts to decision_logs table

**Step 0.4: Integration test (1 hour)**
- Manually trigger error in test work order
- Verify failure_class is correctly classified
- Verify error_context is populated
- Verify decision logged

**Phase 0 Total: 1-2 days**

---

## Phase 1: Production Feedback Loops

### Objective

Capture accurate, structured failure data from real work order execution.

### Implementation Area 1: Proposer Refinement Enhancement

**Current state:** Proposer detects TypeScript errors and retries, but doesn't validate contracts.

**Target state:** Proposer validates contracts after each refinement cycle and tags failures.

#### Changes Required

**File:** `src/lib/enhanced-proposer-service.ts`
**Function:** Self-refinement loop (lines 219-284)

**Current flow:**
```
1. Generate code
2. Detect TypeScript errors
3. If errors, refine (max 3 cycles)
4. Return result
```

**New flow:**
```
1. Generate code
2. Detect TypeScript errors
3. Validate contracts (NEW)
4. If errors OR violations, classify failure (NEW)
5. If refine count < 3, retry with failure context
6. Log decision (NEW)
7. Return result with failure classification (NEW)
```

**Specific code changes:**

```typescript
// BEFORE (current code)
async executeSelfRefinement(
  originalTask: string,
  previousAttempt: string,
  error: string,
  cycleNumber: number
): Promise<string> {
  // ... existing refinement logic
  return refinedContent;
}

// AFTER (with contract validation)
async executeSelfRefinement(
  originalTask: string,
  previousAttempt: string,
  error: string,
  cycleNumber: number,
  workOrderId?: string
): Promise<{
  content: string;
  failure_class?: FailureClass;
  error_context?: ErrorContext;
}> {
  // ... existing error detection logic

  // NEW: Contract validation
  const contractValidation = await this.validateContracts(
    previousAttempt,
    originalTask
  );

  if (contractValidation.has_violations) {
    // Classify as contract violation
    const { failure_class, error_context } = classifyError(
      new Error('Contract violations detected'),
      {
        component: 'ProposerService',
        operation: 'executeSelfRefinement',
        metadata: { contract_validation: contractValidation }
      }
    );

    // Log decision to retry with contract context
    if (workOrderId) {
      await logDecision({
        work_order_id: workOrderId,
        decision_type: 'refinement_cycle',
        decision_context: {
          cycle_number: cycleNumber,
          failure_class,
          violations: contractValidation.violations
        },
        decision_result: cycleNumber < 3 ? 'success' : 'failure'
      });
    }

    // If max retries, return with failure classification
    if (cycleNumber >= 3) {
      return {
        content: previousAttempt,
        failure_class,
        error_context
      };
    }

    // Otherwise retry with violation context
    error = `Contract violations detected:\n${
      contractValidation.violations.map(v => `- ${v.description}`).join('\n')
    }`;
  }

  // ... rest of refinement logic

  const refinedContent = await this.callLLM(/* ... */);

  return { content: refinedContent };
}

private async validateContracts(
  code: string,
  task: string
): Promise<ContractValidationResult> {
  // Call existing contract-validator.ts
  const contractValidator = new ContractValidator();
  return await contractValidator.validate(code, task);
}
```

**Integration point:**

**File:** `src/lib/orchestrator/proposer-executor.ts`
**Function:** generateCode (line 78)

```typescript
// BEFORE
const response = await fetch('/api/proposer-enhanced', {
  method: 'POST',
  body: JSON.stringify(enhancedRequest)
});

// AFTER - pass work_order_id to enable decision logging
const enhancedRequest = {
  // ... existing fields
  metadata: {
    work_order_id: wo.id // NEW: pass WO ID for logging
  }
};
```

#### Testing Plan

1. Create test work order with contract-breaking change
2. Verify proposer detects violation
3. Verify failure_class = 'contract_violation'
4. Verify decision logged with violation details
5. Verify refinement stops after 3 cycles if unfixable

### Implementation Area 2: Result Tracking Enhancement

**Current state:** result-tracker.ts writes to outcome_vectors but doesn't classify failures.

**Target state:** All failures are classified and logged with structured context.

#### Changes Required

**File:** `src/lib/orchestrator/result-tracker.ts`

**Current code:**
```typescript
export async function trackSuccessfulExecution(params: {
  workOrderId: string;
  proposerResponse: EnhancedProposerResponse;
  prResult: PRResult;
}) {
  // ... update work_orders

  // Insert outcome vector
  await supabase
    .from('outcome_vectors')
    .insert({
      work_order_id: params.workOrderId,
      execution_time: params.proposerResponse.execution_time_ms,
      success: true,
      cost: params.proposerResponse.cost,
      metadata: { /* ... */ }
    });
}
```

**New code:**
```typescript
export async function trackSuccessfulExecution(params: {
  workOrderId: string;
  proposerResponse: EnhancedProposerResponse;
  prResult: PRResult;
}) {
  // ... update work_orders

  // Insert outcome vector with failure classification if present
  const outcomeData = {
    work_order_id: params.workOrderId,
    execution_time: params.proposerResponse.execution_time_ms,
    success: true,
    cost: params.proposerResponse.cost,
    metadata: { /* ... */ }
  };

  // Add failure classification if proposer detected issues
  if (params.proposerResponse.failure_class) {
    outcomeData.failure_class = params.proposerResponse.failure_class;
    outcomeData.error_context = params.proposerResponse.error_context;
  }

  await supabase
    .from('outcome_vectors')
    .insert(outcomeData);
}

export async function trackFailedExecution(params: {
  workOrderId: string;
  error: Error;
  component: string;
  operation: string;
  metadata?: any;
}) {
  const { failure_class, error_context } = classifyError(error, {
    component: params.component,
    operation: params.operation,
    metadata: params.metadata
  });

  // Update work order status
  await supabase
    .from('work_orders')
    .update({
      status: 'failed',
      metadata: {
        failure_class,
        error_context,
        failed_at: new Date().toISOString()
      }
    })
    .eq('id', params.workOrderId);

  // Insert outcome vector
  await supabase
    .from('outcome_vectors')
    .insert({
      work_order_id: params.workOrderId,
      success: false,
      failure_class,
      error_context,
      metadata: params.metadata
    });
}
```

**Integration points:**

**File:** `src/lib/orchestrator/orchestrator-service.ts`
**Function:** executeWorkOrder (line 169)

```typescript
try {
  // ... execute work order
  await trackSuccessfulExecution({ /* ... */ });
} catch (error) {
  // BEFORE
  console.error('Execution failed:', error);
  await handleCriticalError({ /* ... */ });

  // AFTER
  await trackFailedExecution({
    workOrderId: workOrderId,
    error: error as Error,
    component: 'OrchestratorService',
    operation: 'executeWorkOrder',
    metadata: {
      routing_decision: routingResult,
      step_failed: determineFailedStep(error) // NEW helper
    }
  });
  throw error;
}
```

### Implementation Area 3: Escalation Enhancement

**Current state:** Escalations created but not classified or tracked for resolution.

**Target state:** Escalations tagged with failure_class, resolution tracked.

#### Changes Required

**File:** `src/lib/error-escalation.ts`

**Current code:**
```typescript
export async function handleCriticalError(params: {
  component: string;
  operation: string;
  error: Error;
  workOrderId?: string;
  severity: 'critical' | 'high' | 'medium';
  metadata?: any;
}) {
  console.error(`[${params.component}] ${params.operation} failed:`, params.error);

  if (params.workOrderId) {
    // Escalate to Client Manager
    const response = await fetch('/api/client-manager/escalate', {
      method: 'POST',
      body: JSON.stringify({
        work_order_id: params.workOrderId,
        reason: `${params.component}.${params.operation} failed: ${params.error.message}`,
        metadata: params.metadata
      })
    });
  }
}
```

**New code:**
```typescript
export async function handleCriticalError(params: {
  component: string;
  operation: string;
  error: Error;
  workOrderId?: string;
  severity: 'critical' | 'high' | 'medium';
  metadata?: any;
}) {
  // Classify error
  const { failure_class, error_context } = classifyError(params.error, {
    component: params.component,
    operation: params.operation,
    metadata: params.metadata
  });

  console.error(
    `[${params.component}] ${params.operation} failed:`,
    `[${failure_class}]`, // NEW: log classification
    params.error
  );

  if (params.workOrderId) {
    // Escalate to Client Manager with classification
    const response = await fetch('/api/client-manager/escalate', {
      method: 'POST',
      body: JSON.stringify({
        work_order_id: params.workOrderId,
        reason: `${params.component}.${params.operation} failed: ${params.error.message}`,
        failure_class, // NEW
        metadata: {
          ...params.metadata,
          error_context // NEW: structured error details
        }
      })
    });

    // Log escalation decision
    await logDecision({
      work_order_id: params.workOrderId,
      decision_type: 'escalation',
      decision_context: {
        component: params.component,
        operation: params.operation,
        failure_class,
        severity: params.severity
      },
      decision_result: response.ok ? 'success' : 'failure'
    });
  }
}
```

**File:** `src/app/api/client-manager/escalate/route.ts`

**Current code:**
```typescript
export async function POST(request: NextRequest) {
  const { work_order_id, reason, metadata } = await request.json();

  const { data, error } = await supabase
    .from('escalations')
    .insert({
      work_order_id,
      reason,
      metadata,
      status: 'open'
    })
    .select()
    .single();

  return NextResponse.json({ success: true, escalation: data });
}
```

**New code:**
```typescript
export async function POST(request: NextRequest) {
  const {
    work_order_id,
    reason,
    failure_class, // NEW
    metadata
  } = await request.json();

  const { data, error } = await supabase
    .from('escalations')
    .insert({
      work_order_id,
      reason,
      failure_class, // NEW
      metadata,
      status: 'open'
    })
    .select()
    .single();

  return NextResponse.json({ success: true, escalation: data });
}
```

### Implementation Area 4: Monitoring Dashboard

**Objective:** Add failure summary card to existing monitoring dashboard.

**File:** `src/app/dashboard/monitoring/page.tsx` (assumed to exist based on architecture)

**New component:**

```typescript
// components/FailureSummaryCard.tsx
import { useEffect, useState } from 'react';

interface FailureSummary {
  failure_class: string;
  count: number;
  avg_execution_time: number;
  total_cost: number;
}

export function FailureSummaryCard() {
  const [summary, setSummary] = useState<FailureSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSummary() {
      const response = await fetch('/api/admin/failure-summary');
      const data = await response.json();
      setSummary(data.summary);
      setLoading(false);
    }
    fetchSummary();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="failure-summary-card">
      <h3>Failures by Type (Last 7 Days)</h3>
      <table>
        <thead>
          <tr>
            <th>Failure Type</th>
            <th>Count</th>
            <th>Avg Time (s)</th>
            <th>Total Cost</th>
          </tr>
        </thead>
        <tbody>
          {summary.map(s => (
            <tr key={s.failure_class}>
              <td>{s.failure_class}</td>
              <td>{s.count}</td>
              <td>{(s.avg_execution_time / 1000).toFixed(2)}</td>
              <td>${s.total_cost.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**API endpoint:**

**File:** `src/app/api/admin/failure-summary/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServiceClient();

  // Get failures from last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('outcome_vectors')
    .select('failure_class, execution_time, cost')
    .eq('success', false)
    .gte('created_at', sevenDaysAgo.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate by failure_class
  const summary = data.reduce((acc, row) => {
    const key = row.failure_class || 'unknown';
    if (!acc[key]) {
      acc[key] = {
        failure_class: key,
        count: 0,
        total_execution_time: 0,
        total_cost: 0
      };
    }
    acc[key].count++;
    acc[key].total_execution_time += row.execution_time || 0;
    acc[key].total_cost += row.cost || 0;
    return acc;
  }, {} as Record<string, any>);

  // Convert to array and calculate averages
  const summaryArray = Object.values(summary).map(s => ({
    failure_class: s.failure_class,
    count: s.count,
    avg_execution_time: s.total_execution_time / s.count,
    total_cost: s.total_cost
  }));

  // Sort by count descending
  summaryArray.sort((a, b) => b.count - a.count);

  return NextResponse.json({ summary: summaryArray });
}
```

### Implementation Steps - Phase 1

**Step 1.1: Enhance proposer refinement (4 hours)**
- Add contract validation to refinement loop
- Integrate failure classification
- Add decision logging
- Update API response type to include failure_class
- Test with contract-violating code

**Step 1.2: Enhance result tracking (3 hours)**
- Add trackFailedExecution function
- Update trackSuccessfulExecution to handle failure_class
- Integrate classifyError throughout
- Update orchestrator-service.ts to call trackFailedExecution
- Test with failing work order

**Step 1.3: Enhance error escalation (2 hours)**
- Update handleCriticalError to classify errors
- Update escalate API to accept failure_class
- Add decision logging for escalations
- Test escalation flow end-to-end

**Step 1.4: Add monitoring dashboard (3 hours)**
- Create FailureSummaryCard component
- Create /api/admin/failure-summary endpoint
- Integrate into monitoring dashboard
- Test with real failure data

**Step 1.5: Integration testing (2 hours)**
- Run work order that triggers each failure_class
- Verify classification is correct
- Verify error_context is populated
- Verify decisions logged
- Verify dashboard displays correctly

**Step 1.6: Documentation (1 hour)**
- Document failure_class enum values
- Document error_context structure
- Add examples to SOURCE_OF_TRUTH_Moose_Workflow.md

**Phase 1 Total: 2-3 days**

---

## Phase 2: Supervised Improvement System

### Objective

Build systematic validation loop that proves Moose improvements work.

**Dependency:** Requires Phase 1 failure classification to generate meaningful analysis.

### Architecture Decision: Local vs Cloud Execution

**Question:** Where should the supervised loop run?

**Option 1: Cloud-based (Moose on Railway/Render)**
- Pros: Production-like environment
- Cons: Slower feedback, deployment overhead, harder to debug

**Option 2: Local (Moose on localhost)**
- Pros: Fast iteration, easy debugging, identical to dev environment
- Cons: Not production environment

**Decision: Start local, deploy later.**

**Rationale:**
- Aider runs locally (py -3.11 -m aider) - works identically
- Git operations work the same
- Can watch files change in real-time
- Instant feedback loop
- Easy to stop and inspect
- No deployment delays

**Implementation note:** The test project will be built on localhost:3000 just like in development. This is actually MORE realistic since production execution would also be local Aider.

### Database Schema (Additional Tables)

**Note:** This builds on Phase 0 schema.

```sql
-- ============================================================================
-- Table: test_iterations
-- Stores metrics for each iteration (learning data - never delete)
-- ============================================================================

CREATE TABLE test_iterations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  iteration_number INTEGER NOT NULL,
  project_name TEXT NOT NULL, -- "multi-llm-discussion"
  moose_version TEXT, -- Git commit hash

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),

  -- Execution Metrics
  total_work_orders INTEGER,
  work_orders_succeeded INTEGER,
  work_orders_failed INTEGER,
  total_execution_time_seconds INTEGER,
  total_cost_usd DECIMAL(10, 4),

  -- Quality Scores (1-10 scale)
  architecture_score INTEGER CHECK (architecture_score BETWEEN 1 AND 10),
  readability_score INTEGER CHECK (readability_score BETWEEN 1 AND 10),
  completeness_score INTEGER CHECK (completeness_score BETWEEN 1 AND 10),
  test_coverage_score INTEGER CHECK (test_coverage_score BETWEEN 1 AND 10),
  user_experience_score INTEGER CHECK (user_experience_score BETWEEN 1 AND 10),
  overall_score DECIMAL(3, 1), -- Weighted average

  -- Build/Test Results
  builds_successfully BOOLEAN,
  tests_pass BOOLEAN,
  lint_errors INTEGER,

  -- Isolation Verification (CRITICAL)
  moose_files_modified BOOLEAN, -- Should always be FALSE
  isolation_verified BOOLEAN,

  -- Detailed Analysis (JSON)
  scoring_details JSONB, -- Full rubric evaluation
  analysis_summary JSONB, -- What went wrong and why

  -- Failure Breakdown (uses Phase 1 classification)
  failures_by_class JSONB, -- { compile_error: 2, contract_violation: 1, ... }

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_test_iterations_number ON test_iterations(iteration_number);
CREATE INDEX idx_test_iterations_score ON test_iterations(overall_score);

-- ============================================================================
-- Table: moose_improvements
-- Tracks changes made to Moose between iterations
-- ============================================================================

CREATE TABLE moose_improvements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_iteration_id UUID REFERENCES test_iterations(id),
  to_iteration_id UUID REFERENCES test_iterations(id),

  improvement_type TEXT CHECK (improvement_type IN (
    'bug_fix',
    'prompt_enhancement',
    'architecture_change',
    'config_change',
    'contract_addition'
  )),

  description TEXT NOT NULL,
  files_changed TEXT[],
  git_commit_hash TEXT,

  -- Impact tracking
  expected_impact TEXT, -- "Reduce contract_violation failures by 50%"
  actual_impact TEXT,   -- Filled after next iteration

  -- Approval tracking
  proposed_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT, -- 'human' or 'autonomous'

  proposal_details JSONB, -- Full proposal from Claude

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_moose_improvements_from ON moose_improvements(from_iteration_id);
CREATE INDEX idx_moose_improvements_type ON moose_improvements(improvement_type);
```

### Component Architecture

```
scripts/
  supervised-loop.mjs          # Main orchestrator
  cleanup-iteration.mjs        # Reset environment
  run-iteration.mjs            # Execute one iteration
  score-iteration.mjs          # Score built app
  analyze-iteration.mjs        # Identify root causes
  generate-proposals.mjs       # Create improvement proposals
  apply-improvements.mjs       # Apply approved changes

lib/
  failure-classifier.ts        # From Phase 1
  decision-logger.ts          # From Phase 1
  iteration-scorer.ts         # Scoring rubrics
  iteration-analyzer.ts       # Pattern analysis
  proposal-generator.ts       # Improvement suggestions
```

### Script 1: Cleanup Iteration

**File:** `scripts/cleanup-iteration.mjs`

**Purpose:** Reset environment between iterations while preserving learning data.

**What it deletes:**
- Test project record from `projects` table
- All work orders for test project
- All proposals for test work orders
- GitHub branches (feature/moose-wo-*)
- GitHub PRs (closes them)
- Local project directory (C:\dev\multi-llm-discussion)

**What it preserves:**
- `test_iterations` table (all scores)
- `outcome_vectors` table (all execution data)
- `decision_logs` table (all decisions)
- `escalations` table (all escalations)
- `moose_improvements` table (all changes to Moose)

**Key functions:**

```javascript
async function cleanupDatabase(projectName) {
  // Get project ID
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('name', projectName)
    .single();

  if (!project) {
    console.log('ℹ️  No test project found');
    return;
  }

  // Delete work orders (cascades to proposals via foreign key)
  await supabase
    .from('work_orders')
    .delete()
    .eq('project_id', project.id);

  // Delete project
  await supabase
    .from('projects')
    .delete()
    .eq('id', project.id);

  console.log('✅ Database cleaned');
}

async function cleanupGitHub(repoOwner, repoName) {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  // Get all branches matching moose-wo-*
  const { data: branches } = await octokit.rest.repos.listBranches({
    owner: repoOwner,
    repo: repoName
  });

  const mooseBranches = branches.filter(b =>
    b.name.startsWith('feature/moose-wo-') ||
    b.name.startsWith('moose-wo-')
  );

  // Delete each branch
  for (const branch of mooseBranches) {
    await octokit.rest.git.deleteRef({
      owner: repoOwner,
      repo: repoName,
      ref: `heads/${branch.name}`
    });
    console.log(`  Deleted branch: ${branch.name}`);
  }

  // Close open PRs from those branches
  const { data: prs } = await octokit.rest.pulls.list({
    owner: repoOwner,
    repo: repoName,
    state: 'open'
  });

  const moosePRs = prs.filter(pr =>
    pr.head.ref.startsWith('feature/moose-wo-') ||
    pr.head.ref.startsWith('moose-wo-')
  );

  for (const pr of moosePRs) {
    await octokit.rest.pulls.update({
      owner: repoOwner,
      repo: repoName,
      pull_number: pr.number,
      state: 'closed'
    });
    console.log(`  Closed PR #${pr.number}: ${pr.title}`);
  }

  console.log('✅ GitHub cleaned');
}

async function cleanupFilesystem(projectPath) {
  if (fs.existsSync(projectPath)) {
    fs.rmSync(projectPath, { recursive: true, force: true });
    console.log(`✅ Deleted directory: ${projectPath}`);
  } else {
    console.log('ℹ️  Directory does not exist');
  }
}

async function verifyCleanup(projectName, projectPath) {
  // Check database
  const { count: projectCount } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('name', projectName);

  // Check filesystem
  const dirExists = fs.existsSync(projectPath);

  const isClean = projectCount === 0 && !dirExists;

  if (isClean) {
    console.log('✅ Cleanup verified - environment is clean');
  } else {
    console.warn('⚠️  Cleanup incomplete:');
    if (projectCount > 0) console.warn(`   - ${projectCount} project(s) still in database`);
    if (dirExists) console.warn(`   - Directory still exists: ${projectPath}`);
  }

  return isClean;
}
```

**Implementation considerations:**
- Must be idempotent (can run multiple times safely)
- Should handle missing resources gracefully
- Must verify cleanup completed
- Should log all actions for debugging

### Script 2: Run Iteration

**File:** `scripts/run-iteration.mjs`

**Purpose:** Execute one complete iteration and capture all metrics.

**Steps:**

```javascript
async function runIteration(iterationNumber, testSpec) {
  // Create iteration record
  const { data: iteration } = await supabase
    .from('test_iterations')
    .insert({
      iteration_number: iterationNumber,
      project_name: testSpec.project_name,
      moose_version: await getCurrentGitCommit(),
      status: 'running',
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  console.log(`🚀 Starting Iteration ${iterationNumber}`);
  console.log(`   Moose Version: ${iteration.moose_version}`);

  try {
    // Step 1: Initialize project
    console.log('\n📦 Step 1: Initializing project...');
    const project = await initializeProject(testSpec);

    // Step 2: Decompose specification
    console.log('\n🏗️  Step 2: Decomposing specification...');
    const decomposition = await decomposeSpecification(project.id, testSpec);
    console.log(`   Generated ${decomposition.work_orders_created} work orders`);

    // Step 3: Execute all work orders
    console.log('\n⚙️  Step 3: Executing work orders...');
    const executionResults = await executeAllWorkOrders(project.id);

    // Step 4: Verify isolation
    console.log('\n🔒 Step 4: Verifying isolation...');
    const isolationCheck = await verifyIsolation();

    // Step 5: Test built application
    console.log('\n🧪 Step 5: Testing built application...');
    const testResults = await testBuiltApp(testSpec.project_path);

    // Update iteration with results
    await supabase
      .from('test_iterations')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_work_orders: decomposition.work_orders_created,
        work_orders_succeeded: executionResults.succeeded,
        work_orders_failed: executionResults.failed,
        total_execution_time_seconds: executionResults.total_time,
        total_cost_usd: executionResults.total_cost,
        builds_successfully: testResults.build_success,
        tests_pass: testResults.tests_pass,
        lint_errors: testResults.lint_errors,
        moose_files_modified: !isolationCheck.clean,
        isolation_verified: isolationCheck.clean,
        failures_by_class: calculateFailuresByClass(executionResults)
      })
      .eq('id', iteration.id);

    console.log('\n✅ Iteration complete');

    return iteration.id;

  } catch (error) {
    // Mark iteration as failed
    await supabase
      .from('test_iterations')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        analysis_summary: {
          error: error.message,
          stack: error.stack
        }
      })
      .eq('id', iteration.id);

    throw error;
  }
}

async function initializeProject(testSpec) {
  // Call Moose's project initialization API
  const response = await fetch('http://localhost:3000/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: testSpec.project_name,
      local_path: testSpec.project_path,
      github_org: testSpec.github_org,
      github_repo_name: testSpec.github_repo_name,
      github_repo_url: testSpec.github_repo_url
    })
  });

  const data = await response.json();
  return data.project;
}

async function decomposeSpecification(projectId, testSpec) {
  // Call Architect Agent API
  const response = await fetch('http://localhost:3000/api/architect/decompose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      spec: testSpec.technical_spec
    })
  });

  const data = await response.json();
  return data;
}

async function executeAllWorkOrders(projectId) {
  // Wait for orchestrator to pick up and execute all work orders
  // This is where Moose's normal execution happens

  let allCompleted = false;
  const startTime = Date.now();

  while (!allCompleted) {
    // Query work orders status
    const { data: workOrders } = await supabase
      .from('work_orders')
      .select('id, status')
      .eq('project_id', projectId);

    const pending = workOrders.filter(wo => wo.status === 'pending').length;
    const inProgress = workOrders.filter(wo => wo.status === 'in_progress').length;
    const completed = workOrders.filter(wo => wo.status === 'completed').length;
    const failed = workOrders.filter(wo => wo.status === 'failed').length;

    console.log(`   Progress: ${completed}/${workOrders.length} completed, ${failed} failed, ${pending} pending`);

    // Check if all are done
    if (pending === 0 && inProgress === 0) {
      allCompleted = true;
    } else {
      // Wait 10 seconds and check again
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    // Timeout after 30 minutes
    if (Date.now() - startTime > 30 * 60 * 1000) {
      throw new Error('Execution timeout - work orders did not complete in 30 minutes');
    }
  }

  // Collect results
  const { data: outcomes } = await supabase
    .from('outcome_vectors')
    .select('*')
    .in('work_order_id', workOrders.map(wo => wo.id));

  return {
    succeeded: outcomes.filter(o => o.success).length,
    failed: outcomes.filter(o => !o.success).length,
    total_time: Math.floor((Date.now() - startTime) / 1000),
    total_cost: outcomes.reduce((sum, o) => sum + (o.cost || 0), 0)
  };
}

async function verifyIsolation() {
  // Check if any Moose files were modified
  const mooseDir = process.cwd(); // C:\dev\moose-mission-control

  // Run git status
  const gitStatus = execSync('git status --porcelain', {
    cwd: mooseDir,
    encoding: 'utf-8'
  });

  const modifiedFiles = gitStatus.trim().split('\n').filter(line => line.trim());

  if (modifiedFiles.length > 0) {
    console.error('⚠️  ISOLATION VIOLATED - Moose files were modified:');
    modifiedFiles.forEach(file => console.error(`   - ${file}`));
    return { clean: false, modified_files: modifiedFiles };
  }

  console.log('✅ Isolation verified - no Moose files modified');
  return { clean: true, modified_files: [] };
}

async function testBuiltApp(projectPath) {
  const results = {};

  // Test build
  try {
    console.log('   Testing build...');
    execSync('npm run build', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    results.build_success = true;
    console.log('   ✅ Build succeeded');
  } catch (error) {
    results.build_success = false;
    results.build_error = error.message;
    console.log('   ❌ Build failed');
  }

  // Test tests
  try {
    console.log('   Running tests...');
    execSync('npm test', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    results.tests_pass = true;
    console.log('   ✅ Tests passed');
  } catch (error) {
    results.tests_pass = false;
    results.test_error = error.message;
    console.log('   ❌ Tests failed');
  }

  // Check lint
  try {
    console.log('   Checking lint...');
    const lintOutput = execSync('npm run lint', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    results.lint_errors = 0; // Assuming no errors if no exception
    console.log('   ✅ No lint errors');
  } catch (error) {
    // Parse error count from output
    const match = error.message.match(/(\d+) error/);
    results.lint_errors = match ? parseInt(match[1]) : 1;
    console.log(`   ⚠️  ${results.lint_errors} lint errors`);
  }

  return results;
}

function calculateFailuresByClass(executionResults) {
  // Query outcome_vectors grouped by failure_class
  const summary = {};

  executionResults.outcomes
    .filter(o => !o.success && o.failure_class)
    .forEach(o => {
      summary[o.failure_class] = (summary[o.failure_class] || 0) + 1;
    });

  return summary;
}

async function getCurrentGitCommit() {
  return execSync('git rev-parse HEAD', {
    encoding: 'utf-8'
  }).trim();
}
```

### Script 3: Score Iteration

**File:** `scripts/score-iteration.mjs`

**Purpose:** Apply scoring rubrics and calculate overall quality score.

**Note:** This uses Claude Code to evaluate the built application against objective rubrics.

**Rubrics implementation:**

**File:** `src/lib/iteration-scorer.ts`

```typescript
export interface ScoringRubrics {
  architecture: RubricCriteria;
  readability: RubricCriteria;
  completeness: RubricCriteria;
  test_coverage: RubricCriteria;
  user_experience: RubricCriteria;
}

export interface RubricCriteria {
  score_10: string[];  // Criteria for 10/10
  score_8_9: string[]; // Criteria for 8-9/10
  score_6_7: string[]; // Criteria for 6-7/10
  score_4_5: string[]; // Criteria for 4-5/10
  score_1_3: string[]; // Criteria for 1-3/10
}

export const SCORING_RUBRICS: ScoringRubrics = {
  architecture: {
    score_10: [
      'Perfect separation of concerns (UI/logic/data separate)',
      'Follows framework conventions exactly',
      'Proper use of Server/Client Components',
      'Clean dependency flow (no circular dependencies)',
      'Reusable abstractions (DRY principle)'
    ],
    score_8_9: [
      'Separation of concerns mostly correct',
      'Follows conventions with minor deviations',
      '1-2 misplaced concerns acceptable',
      'Clean dependency flow',
      'Mostly DRY'
    ],
    // ... (rest from rubrics document)
  },
  // ... other dimensions
};

export async function scoreIteration(
  iterationId: string,
  projectPath: string
): Promise<ScoringResult> {
  // This would call Claude Code with the rubrics
  // Claude Code reads the project files and evaluates against rubrics

  // For now, outline the process:
  // 1. Read all source files
  // 2. Apply each rubric dimension
  // 3. Provide evidence for each score
  // 4. Calculate weighted overall score

  // Implementation detail: This is a complex evaluation
  // Best done by calling Claude Code CLI with a detailed prompt

  const prompt = buildScoringPrompt(SCORING_RUBRICS, projectPath);

  // Execute Claude Code and parse results
  const result = await executeClaudeCode(prompt);

  return result;
}

function buildScoringPrompt(rubrics: ScoringRubrics, projectPath: string): string {
  return `
You are evaluating a Next.js application against objective quality rubrics.

Project path: ${projectPath}

Read all source files in src/ and apply the following rubrics.
For each dimension, select the score tier that best matches the code.
Provide specific evidence (file paths, line numbers, examples).

${JSON.stringify(rubrics, null, 2)}

Return a JSON object with:
{
  "architecture_score": <1-10>,
  "architecture_evidence": "<specific examples>",
  "readability_score": <1-10>,
  "readability_evidence": "<specific examples>",
  "completeness_score": <1-10>,
  "completeness_evidence": "<specific examples>",
  "test_coverage_score": <1-10>,
  "test_coverage_evidence": "<specific examples>",
  "user_experience_score": <1-10>,
  "user_experience_evidence": "<specific examples>",
  "overall_score": <weighted average>,
  "summary": "<2-3 sentence summary>"
}
`;
}
```

### Script 4: Analyze Iteration

**File:** `scripts/analyze-iteration.mjs`

**Purpose:** Identify root causes of failures using Phase 1 failure classification data.

**Key insight:** This is where Phase 1 pays off. We have structured failure data to analyze.

```javascript
async function analyzeIteration(iterationId) {
  // Get iteration data
  const { data: iteration } = await supabase
    .from('test_iterations')
    .select('*')
    .eq('id', iterationId)
    .single();

  // Get all outcome_vectors for this iteration's work orders
  const { data: workOrders } = await supabase
    .from('work_orders')
    .select('id')
    .eq('project_id', /* ... */);

  const { data: outcomes } = await supabase
    .from('outcome_vectors')
    .select('*')
    .in('work_order_id', workOrders.map(wo => wo.id));

  // Group failures by failure_class
  const failureAnalysis = {};

  outcomes
    .filter(o => !o.success)
    .forEach(o => {
      const cls = o.failure_class || 'unknown';
      if (!failureAnalysis[cls]) {
        failureAnalysis[cls] = {
          count: 0,
          examples: []
        };
      }
      failureAnalysis[cls].count++;
      failureAnalysis[cls].examples.push({
        work_order_id: o.work_order_id,
        error_context: o.error_context
      });
    });

  // Identify patterns
  const patterns = identifyPatterns(failureAnalysis);

  // Generate root cause analysis using Claude
  const rootCauses = await generateRootCauseAnalysis(
    iteration,
    failureAnalysis,
    patterns
  );

  // Save analysis
  await supabase
    .from('test_iterations')
    .update({
      analysis_summary: {
        failure_analysis: failureAnalysis,
        patterns: patterns,
        root_causes: rootCauses
      }
    })
    .eq('id', iterationId);

  return rootCauses;
}

function identifyPatterns(failureAnalysis) {
  const patterns = [];

  // Pattern 1: Repeated failure type
  Object.entries(failureAnalysis).forEach(([cls, data]) => {
    if (data.count >= 3) {
      patterns.push({
        type: 'repeated_failure',
        failure_class: cls,
        frequency: data.count,
        description: `${cls} occurred ${data.count} times`
      });
    }
  });

  // Pattern 2: Same error across multiple WOs
  // (Implement by comparing error_context.error_message)

  // Pattern 3: Cascading failures
  // (Implement by analyzing dependency chains)

  return patterns;
}

async function generateRootCauseAnalysis(iteration, failureAnalysis, patterns) {
  const prompt = `
You are analyzing why a test iteration of Moose Mission Control produced low-quality code.

Iteration Results:
- Overall Score: ${iteration.overall_score}/10
- Architecture: ${iteration.architecture_score}/10
- Readability: ${iteration.readability_score}/10
- Completeness: ${iteration.completeness_score}/10
- Test Coverage: ${iteration.test_coverage_score}/10
- User Experience: ${iteration.user_experience_score}/10

Builds: ${iteration.builds_successfully ? 'Yes' : 'No'}
Tests: ${iteration.tests_pass ? 'Yes' : 'No'}
Lint Errors: ${iteration.lint_errors}

Failure Breakdown:
${JSON.stringify(failureAnalysis, null, 2)}

Patterns Detected:
${JSON.stringify(patterns, null, 2)}

For each significant issue (score <7, build failure, >3 failures of same type):
1. Identify the ROOT CAUSE (why did Moose produce this result?)
2. Explain the MECHANISM (what in Moose's code caused this?)
3. Link to EVIDENCE (specific failure_class, error_context, scores)

Return JSON array of root causes:
[
  {
    "issue": "<what went wrong>",
    "root_cause": "<why it happened>",
    "mechanism": "<what in Moose's code/prompts caused this>",
    "evidence": ["<failure_class>", "<score dimension>", ...],
    "severity": "high" | "medium" | "low"
  }
]
`;

  // Call Claude Code for analysis
  const result = await executeClaudeCode(prompt);

  return result.root_causes;
}
```

### Script 5: Generate Proposals

**File:** `scripts/generate-proposals.mjs`

**Purpose:** Convert root cause analysis into actionable improvement proposals.

```javascript
async function generateProposals(iterationId, rootCauses) {
  const proposals = [];

  for (const rootCause of rootCauses) {
    const proposal = await generateProposalForRootCause(rootCause);
    proposals.push(proposal);
  }

  // Save proposals
  for (const proposal of proposals) {
    await supabase
      .from('moose_improvements')
      .insert({
        from_iteration_id: iterationId,
        improvement_type: proposal.type,
        description: proposal.description,
        expected_impact: proposal.expected_impact,
        proposal_details: proposal
      });
  }

  return proposals;
}

async function generateProposalForRootCause(rootCause) {
  const prompt = `
You are proposing a specific, actionable change to Moose Mission Control to fix a root cause.

Root Cause Analysis:
${JSON.stringify(rootCause, null, 2)}

Generate a detailed proposal with:
1. Exact file to modify (from Moose codebase)
2. Exact code changes (show before/after diff)
3. Rationale (why this fixes the root cause)
4. Testing plan (how to verify it works)
5. Rollback plan (how to undo if needed)
6. Expected impact (which scores/failure_classes improve)
7. Risks (what could go wrong)

Return JSON:
{
  "type": "bug_fix" | "prompt_enhancement" | "architecture_change" | "config_change",
  "description": "<concise summary>",
  "file_path": "src/...",
  "code_changes": {
    "before": "<current code>",
    "after": "<new code>"
  },
  "rationale": "<why this fixes the issue>",
  "testing_plan": "<how to verify>",
  "rollback_plan": "<how to undo>",
  "expected_impact": "<which metrics improve>",
  "risks": ["<potential issue>"],
  "estimated_effort_minutes": <number>
}
`;

  const result = await executeClaudeCode(prompt);
  return result;
}
```

### Script 6: Supervised Loop (Main Orchestrator)

**File:** `scripts/supervised-loop.mjs`

**Purpose:** Orchestrate the complete supervised improvement cycle.

```javascript
async function supervisedLoop(testSpec, targetScore = 8.0, maxIterations = 20) {
  let iterationNumber = 1;
  let consecutiveSuccesses = 0;

  while (consecutiveSuccesses < 3 && iterationNumber <= maxIterations) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`ITERATION ${iterationNumber}`);
    console.log('='.repeat(80));

    // Step 1: Cleanup
    console.log('\n🧹 Cleaning up environment...');
    await cleanup(testSpec);

    // Step 2: Run iteration
    console.log('\n🚀 Running iteration...');
    const iterationId = await runIteration(iterationNumber, testSpec);

    // Step 3: Score
    console.log('\n📊 Scoring iteration...');
    const scores = await scoreIteration(iterationId, testSpec.project_path);

    // Update iteration with scores
    await supabase
      .from('test_iterations')
      .update({
        architecture_score: scores.architecture_score,
        readability_score: scores.readability_score,
        completeness_score: scores.completeness_score,
        test_coverage_score: scores.test_coverage_score,
        user_experience_score: scores.user_experience_score,
        overall_score: scores.overall_score,
        scoring_details: scores
      })
      .eq('id', iterationId);

    console.log(`\n📈 Overall Score: ${scores.overall_score}/10`);

    // Check if target met
    if (scores.overall_score >= targetScore) {
      consecutiveSuccesses++;
      console.log(`✅ Target met! (${consecutiveSuccesses}/3 consecutive)`);

      if (consecutiveSuccesses >= 3) {
        console.log('\n🎉 SUCCESS! Quality target achieved consistently!');
        break;
      }
    } else {
      consecutiveSuccesses = 0;

      // Step 4: Analyze
      console.log('\n🔍 Analyzing failures...');
      const rootCauses = await analyzeIteration(iterationId);

      // Step 5: Generate proposals
      console.log('\n💡 Generating improvement proposals...');
      const proposals = await generateProposals(iterationId, rootCauses);

      // Step 6: Generate report
      console.log('\n📄 Generating improvement report...');
      const reportPath = await generateReport(iterationId, scores, rootCauses, proposals);

      // Step 7: WAIT FOR HUMAN APPROVAL
      console.log(`\n📋 Report saved to: ${reportPath}`);
      console.log('\nReview the report and choose an action:');
      console.log('  [a] approve - Apply all proposals');
      console.log('  [e] edit - Modify proposals before applying');
      console.log('  [s] skip - Move to next iteration without changes');
      console.log('  [x] stop - Exit loop');
      console.log('  [v] view - Show report in terminal');

      const choice = await promptUser('Your choice: ');

      switch (choice.toLowerCase()) {
        case 'a':
          // Apply proposals
          console.log('\n✅ Applying approved proposals...');
          await applyProposals(proposals, iterationId);
          break;

        case 'e':
          // Open editor, let user modify, then apply
          console.log('\n📝 Opening editor...');
          await editProposals(reportPath);
          const editedProposals = await parseEditedReport(reportPath);
          await applyProposals(editedProposals, iterationId);
          break;

        case 's':
          console.log('\n⏭️  Skipping improvements, moving to next iteration');
          break;

        case 'x':
          console.log('\n🛑 Stopping loop');
          return;

        case 'v':
          console.log('\n' + fs.readFileSync(reportPath, 'utf-8'));
          // Ask again
          continue;
      }
    }

    iterationNumber++;
  }

  if (iterationNumber > maxIterations) {
    console.log(`\n⚠️  Reached max iterations (${maxIterations}) without achieving target`);
  }
}

async function applyProposals(proposals, iterationId) {
  for (const proposal of proposals) {
    console.log(`\n  Applying: ${proposal.description}`);

    try {
      // Apply code changes
      fs.writeFileSync(
        proposal.file_path,
        proposal.code_changes.after,
        'utf-8'
      );

      // Verify build still works
      execSync('npm run build', { cwd: process.cwd() });

      // Commit change
      execSync(`git add ${proposal.file_path}`);
      execSync(`git commit -m "${proposal.description}

${proposal.rationale}

Expected Impact: ${proposal.expected_impact}

🤖 Generated by Moose supervised learning loop
From iteration ${iterationId}"`);

      const commitHash = execSync('git rev-parse HEAD', {
        encoding: 'utf-8'
      }).trim();

      // Update improvement record
      await supabase
        .from('moose_improvements')
        .update({
          git_commit_hash: commitHash,
          approved_at: new Date().toISOString(),
          approved_by: 'human'
        })
        .eq('description', proposal.description)
        .eq('from_iteration_id', iterationId);

      console.log(`  ✅ Applied and committed: ${commitHash.substring(0, 7)}`);

    } catch (error) {
      console.error(`  ❌ Failed to apply proposal: ${error.message}`);
      console.log(`  🔙 Rolling back...`);
      execSync('git reset --hard HEAD');

      // Mark as failed
      await supabase
        .from('moose_improvements')
        .delete()
        .eq('description', proposal.description)
        .eq('from_iteration_id', iterationId);
    }
  }
}
```

### Implementation Steps - Phase 2

**Step 2.1: Database schema (30 min)**
- Add test_iterations table
- Add moose_improvements table
- Create indexes

**Step 2.2: Cleanup script (4 hours)**
- Implement database cleanup
- Implement GitHub cleanup
- Implement filesystem cleanup
- Add verification
- Test idempotency

**Step 2.3: Run iteration script (6 hours)**
- Implement project initialization
- Implement decomposition
- Implement execution monitoring
- Implement isolation verification
- Implement app testing
- Test full iteration

**Step 2.4: Scoring system (8 hours)**
- Implement scoring rubrics
- Create Claude Code prompts
- Implement score calculation
- Test scoring accuracy

**Step 2.5: Analysis system (6 hours)**
- Implement pattern detection
- Create root cause analysis prompts
- Test analysis quality

**Step 2.6: Proposal generation (6 hours)**
- Implement proposal generator
- Create proposal prompts
- Test proposal actionability

**Step 2.7: Supervised loop (8 hours)**
- Implement main loop
- Add approval interface
- Implement proposal application
- Add rollback handling
- Test end-to-end

**Step 2.8: Report generation (4 hours)**
- Create report template
- Implement markdown generation
- Test report readability

**Step 2.9: Integration testing (8 hours)**
- Run full supervised loop
- Test all approval flows
- Verify proposals work
- Test rollback
- Document findings

**Phase 2 Total: 5-7 days**

---

## Implementation Decisions & Rationale

### Decision 1: Phased vs All-at-Once

**Options:**
- A) Build Option A only (feedback loops)
- B) Build Option B only (supervised loop)
- C) Build both in parallel
- D) Build in phases (A then B)

**Decision: D (Phased)**

**Rationale:**
- Option B depends on data structures from Option A
- Phased approach allows stopping after Phase 1 if needed
- Each phase delivers value independently
- Lower risk (can validate each phase before proceeding)
- Easier to debug (smaller scope per phase)

### Decision 2: Failure Classification Approach

**Options:**
- A) Simple string matching
- B) Regex-based classification
- C) ML-based classification
- D) LLM-based classification

**Decision: B (Regex-based) initially, with path to D**

**Rationale:**
- Regex provides good accuracy for known error types
- Fast and deterministic
- Easy to debug and extend
- Can add LLM classification for 'unknown' category later
- No training data needed upfront

### Decision 3: Scoring Approach

**Options:**
- A) Fully automated metrics (complexity, coverage, etc.)
- B) LLM evaluation against rubrics
- C) Human scoring
- D) Hybrid (automated + LLM)

**Decision: D (Hybrid)**

**Rationale:**
- Automated metrics are objective but limited (can't evaluate UX)
- LLM can evaluate subjective dimensions (architecture, readability)
- Rubrics make LLM evaluation more consistent
- Human can override if needed
- Best of both worlds

### Decision 4: Proposal Application Method

**Options:**
- A) Fully automated application
- B) Human reviews and applies manually
- C) Automated with human approval gate
- D) Autonomous after N successful approvals

**Decision: C initially, with option to D**

**Rationale:**
- Human approval gate provides safety
- Automated application saves time
- Builds confidence gradually
- Can switch to autonomous once validated
- Rollback capability makes this safe

### Decision 5: Local vs Cloud Execution

**Options:**
- A) Run on cloud (Railway/Render)
- B) Run locally (localhost)
- C) Hybrid (Moose on cloud, testing local)

**Decision: B (Local)**

**Rationale:**
- Aider runs locally anyway (CLI tool)
- Faster iteration (no deployment delays)
- Easier debugging
- Can watch files change in real-time
- Production deployment is separate concern
- Can deploy to cloud later for production use

### Decision 6: Test Spec Choice

**Options:**
- A) Simple CRUD app
- B) Complex multi-feature app
- C) Real client project
- D) Multi-LLM Discussion (as proposed)

**Decision: D (Multi-LLM Discussion)**

**Rationale:**
- Representative complexity (authentication, real-time, database)
- Well-defined spec
- Known requirements
- Not too simple (would hide issues)
- Not too complex (would be slow)
- Good test of Moose's capabilities

### Decision 7: Storage of Iteration Data

**Options:**
- A) Supabase tables (as proposed)
- B) Local files (JSON)
- C) Separate analytics database
- D) Both A and B

**Decision: A (Supabase tables)**

**Rationale:**
- Consistent with Moose architecture
- Easy to query and aggregate
- Persists across machines
- Can build dashboards on top
- Already have Supabase setup

---

## Risk Assessment

### High-Risk Areas

#### Risk 1: Isolation Violation

**Risk:** Moose modifies its own files during test execution

**Likelihood:** Medium
**Impact:** Critical (corrupts Moose codebase)

**Mitigation:**
- Add safety check in aider-executor.ts before execution
- Verify working directory is not Moose's directory
- Check git status after each iteration
- Automatic rollback if violation detected
- Keep Moose under version control (can reset)

**Contingency:** If violated, `git reset --hard HEAD` to restore

#### Risk 2: Cleanup Failures

**Risk:** Cleanup script fails, leaving orphaned data

**Likelihood:** Medium
**Impact:** High (pollutes next iteration)

**Mitigation:**
- Make cleanup idempotent
- Add verification step
- Log all cleanup actions
- Handle missing resources gracefully
- Test cleanup multiple times before using

**Contingency:** Manual cleanup via SQL and filesystem

#### Risk 3: Poor Analysis Quality

**Risk:** Root cause analysis is incorrect or vague

**Likelihood:** Medium
**Impact:** High (generates useless proposals)

**Mitigation:**
- Use structured failure data from Phase 1
- Provide rich evidence to LLM
- Use specific rubrics
- Human reviews analysis in report
- Can skip proposals if analysis unclear

**Contingency:** Human can edit or skip proposals

### Medium-Risk Areas

#### Risk 4: Proposals Don't Improve Scores

**Risk:** Applied changes don't actually help

**Likelihood:** Medium
**Impact:** Medium (wasted iteration)

**Mitigation:**
- Track actual_impact in moose_improvements table
- Compare scores before/after
- Learn which proposal types work
- Can rollback if scores decrease
- Supervised mode prevents runaway changes

**Contingency:** Git revert to undo changes

#### Risk 5: Iteration Timeout

**Risk:** Work orders don't complete in reasonable time

**Likelihood:** Low
**Impact:** Medium (blocks iteration)

**Mitigation:**
- Set 30-minute timeout
- Monitor progress (log every 10s)
- Can investigate stuck work orders
- Failed iterations still provide data

**Contingency:** Mark iteration as failed, analyze why it stuck

#### Risk 6: GitHub Rate Limits

**Risk:** Cleanup/PR creation hits API limits

**Likelihood:** Low
**Impact:** Medium (delays iteration)

**Mitigation:**
- Use GitHub App authentication (higher limits)
- Batch API calls where possible
- Add rate limit checking
- Exponential backoff on errors

**Contingency:** Wait for rate limit reset (1 hour)

### Low-Risk Areas

#### Risk 7: Cost Overruns

**Risk:** Iterations cost too much

**Likelihood:** Low
**Impact:** Low (budget controls exist)

**Mitigation:**
- Budget enforcement already in place
- Iterations should cost $1-3 each
- Can track cumulative cost
- Can stop loop if needed

**Contingency:** Stop loop, review costs

---

## Success Criteria

### Phase 0 Success Criteria

- [ ] Database schema applied successfully
- [ ] failure_class enum works correctly
- [ ] classifyError function accurately classifies common errors (80%+ accuracy on test cases)
- [ ] decision_logs table receives entries
- [ ] No breaking changes to existing pipeline

**Validation:** Run manual test work order that triggers each failure type, verify classification.

### Phase 1 Success Criteria

- [ ] Proposer detects contract violations and tags as failure_class='contract_violation'
- [ ] All work order failures tagged with appropriate failure_class
- [ ] error_context contains structured, parseable data
- [ ] Monitoring dashboard displays failure summary
- [ ] Decision logs track all routing, refinement, escalation decisions
- [ ] No regression in work order execution (still completes successfully)

**Validation:** Run 10 work orders with intentional failures, verify all are classified correctly.

### Phase 2 Success Criteria

- [ ] Cleanup script removes all test artifacts
- [ ] Cleanup is idempotent (can run multiple times)
- [ ] Iteration script completes full cycle (init → decompose → execute → test)
- [ ] Isolation verified (Moose files never modified)
- [ ] Scoring produces consistent results (same code = same score ±0.5)
- [ ] Analysis identifies correct root causes (validated by human review)
- [ ] Proposals are actionable (can be applied without errors)
- [ ] Applied proposals improve scores in next iteration
- [ ] Supervised loop reaches quality target (8/10 for 3 consecutive iterations) within 15 iterations

**Validation:** Run supervised loop to completion, verify quality target met.

### Overall Success Criteria

- [ ] System captures accurate failure data from production work orders
- [ ] System can systematically improve Moose's code quality
- [ ] Quality improvements persist (don't regress)
- [ ] Human understands why each change was made (reports are clear)
- [ ] System is safe (can stop, rollback, edit at any time)
- [ ] Documentation exists for all components

**Validation:** Deploy improved Moose, build different spec, verify higher quality.

---

## Timeline & Effort Estimates

### Phase 0: Foundation

| Task | Effort | Dependencies |
|------|--------|--------------|
| Database schema | 0.5 days | None |
| failure-classifier.ts | 0.5 days | Schema |
| decision-logger.ts | 0.25 days | Schema |
| Integration testing | 0.25 days | All above |
| **Total** | **1-2 days** | |

### Phase 1: Production Feedback Loops

| Task | Effort | Dependencies |
|------|--------|--------------|
| Proposer refinement enhancement | 0.5 days | Phase 0 |
| Result tracking enhancement | 0.4 days | Phase 0 |
| Error escalation enhancement | 0.25 days | Phase 0 |
| Monitoring dashboard | 0.4 days | Phase 0 |
| Integration testing | 0.25 days | All above |
| Documentation | 0.2 days | All above |
| **Total** | **2-3 days** | |

### Phase 2: Supervised Improvement System

| Task | Effort | Dependencies |
|------|--------|--------------|
| Database schema | 0.25 days | Phase 1 |
| Cleanup script | 0.5 days | Schema |
| Run iteration script | 0.75 days | Cleanup |
| Scoring system | 1 day | None |
| Analysis system | 0.75 days | Phase 1 data |
| Proposal generation | 0.75 days | Analysis |
| Supervised loop | 1 day | All above |
| Report generation | 0.5 days | Proposals |
| Integration testing | 1 day | All above |
| **Total** | **5-7 days** | |

### Complete Timeline

```
Week 1:
  Day 1-2: Phase 0 (Foundation)
  Day 3-5: Phase 1 (Feedback Loops)

Week 2:
  Day 6-12: Phase 2 (Supervised Improvement)

Total: 8-12 days
```

### Critical Path

```
Phase 0 → Phase 1 → Phase 2
  ↓         ↓          ↓
 Must    Must use   Must have
finish  Phase 0    Phase 1
first   structs    failures
```

**Bottleneck:** Scoring and analysis systems (most complex, requires iteration to get right)

**Parallelization opportunities:**
- Within Phase 1: Can work on different areas concurrently (proposer, result tracking, escalation, dashboard)
- Within Phase 2: Cleanup, scoring, and analysis can be developed in parallel

### Resource Requirements

**Developer time:** 1 full-time developer, 8-12 days

**External dependencies:**
- Claude Code CLI (for scoring and analysis)
- Supabase database access
- GitHub API access
- Test project spec (Multi-LLM Discussion)

**Infrastructure:**
- Local development machine
- Moose running on localhost:3000
- Supabase project (already exists)
- GitHub repository for test project

---

## Conclusion

### Recommended Path Forward

**Implement all three phases in sequence:**

1. **Phase 0 (1-2 days):** Foundation - Create shared infrastructure
2. **Phase 1 (2-3 days):** Production feedback loops - Capture accurate data
3. **Phase 2 (5-7 days):** Supervised improvement - Systematic validation

**Total timeline: 8-12 days to full system**

### Key Success Factors

1. **Phase 1 must be solid** - Phase 2 depends on accurate failure classification
2. **Scoring must be consistent** - Use objective rubrics, not gut feeling
3. **Proposals must be specific** - "Add error handling" is too vague, "Add try-catch to fetch() calls in src/app/api/" is actionable
4. **Safety is paramount** - Isolation verification, rollback capability, human approval

### Value Proposition

**After Phase 1 (2-3 days):**
- Better debugging (know why work orders fail)
- Pattern visibility (see recurring issues)
- Foundation for learning

**After Phase 2 (8-12 days total):**
- Proven quality (8/10 consistently)
- Systematic improvement (not ad-hoc)
- Self-validation (Moose proves itself)
- Confidence for production (tested on real spec)

### Next Steps

1. **Review this plan** with stakeholders
2. **Validate assumptions** about Multi-LLM Discussion spec
3. **Verify Claude Code CLI** can perform scoring/analysis tasks
4. **Set up test environment** (GitHub repo, local directories)
5. **Begin Phase 0 implementation**

---

**END OF TECHNICAL PLAN**

**Document Status:** Planning - Ready for Implementation
**Approval Required:** Yes
**Estimated Start Date:** Upon approval
**Estimated Completion:** 8-12 days from start
