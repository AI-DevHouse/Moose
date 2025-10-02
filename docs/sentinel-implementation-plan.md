# Phase 3.1 Sentinel Agent - Implementation Plan
**Version:** MVP Edition with Verified Assumptions
**Created:** 2025-10-02
**Status:** Ready to Implement

---

## 📋 ASSUMPTION VERIFICATION REPORT

### ✅ Assumption 1: GitHub Actions Webhook Architecture
**VERIFIED - Localtunnel exists but simplified approach recommended**

**Findings:**
- ✅ Localtunnel configured: `moose-dev-webhook.loca.lt`
- ✅ Terminal 2 setup exists in rules-and-procedures.md
- ❌ NO deployment URL (no vercel.json, netlify.toml)
- ⚠️ Localtunnel requires manual start each session

**DECISION: Use Localtunnel + Manual Fallback Approach**
- Primary: Localtunnel for webhook delivery (when T2 running)
- Fallback: Manual trigger via POST `/api/sentinel` (for testing without webhooks)
- Future: Poll GitHub API if webhooks prove unreliable

---

### ✅ Assumption 2: PowerShell Script Compatibility
**VERIFIED - Script is Windows/PowerShell Core compatible**

**Findings:**
- ✅ Uses `Invoke-RestMethod` (PowerShell Core cmdlet - works on Linux/Mac/Windows)
- ✅ No Windows-specific paths or registry access
- ✅ Simple HTTP testing logic - portable
- ✅ Can run on `ubuntu-latest` with PowerShell Core

**DECISION: Use PowerShell Core on ubuntu-latest**
- GitHub Actions: Install PowerShell (`sudo apt-get install -y powershell`)
- No conversion needed - script is already cross-platform

---

### ✅ Assumption 3: Supabase IP Allowlisting
**VERIFIED - No IP restrictions (uses service role key)**

**Findings:**
- ✅ `.env.local` has `SUPABASE_SERVICE_ROLE_KEY` (bypasses IP restrictions)
- ✅ Project: `qclxdnbvoruvqnhsshjr.supabase.co`
- ✅ No evidence of IP allowlisting in known-issues.md

**DECISION: Use service role key in GitHub Secrets**
- GitHub Actions can connect directly with `SUPABASE_SERVICE_ROLE_KEY`
- No additional network configuration needed

---

### ✅ Assumption 4: Work Order ↔ PR Number Mapping
**VERIFIED - Column exists, race condition possible**

**Findings:**
- ✅ `work_orders.github_pr_number` exists (nullable number)
- ⚠️ **RACE CONDITION CONFIRMED**: Webhook may arrive before Orchestrator updates WO

**DECISION: Implement retry logic with 3 attempts, 2-second delay**
```typescript
// Webhook retries 3 times before giving up
for (let attempt = 0; attempt < 3; attempt++) {
  const wo = await findWorkOrderByPR(pr_number);
  if (wo) break;
  await sleep(2000); // Wait for Orchestrator
}
```

---

### ✅ Assumption 5: Multiple Workflows - Completion Detection
**VERIFIED - Need to wait for all workflows**

**Findings:**
- Multiple workflows planned: CI + Integration Tests
- ⚠️ Risk: Premature decision if only 1 workflow completes

**DECISION: Use EXPECTED_WORKFLOWS env var**
```typescript
EXPECTED_WORKFLOWS=CI,Integration Tests

// Webhook checks:
const allCompleted = expectedWorkflows.every(name =>
  completedWorkflows.includes(name)
);
if (!allCompleted) return {status: 'waiting'};
```

---

### ✅ Assumption 6: Escalation Data Structure
**VERIFIED - Client Manager doesn't exist yet**

**Findings:**
- ❌ No `src/lib/client-manager/` directory
- ✅ `escalations` table exists with `escalation_data` (jsonb)

**DECISION: Sentinel writes minimal trigger, Client Manager enriches later**
```typescript
escalation_data: {
  type: 'sentinel_test_failure',
  failed_workflows: ['CI'],
  pr_number: 42,
  pr_url: 'https://github.com/...',
  all_workflows: [...]  // Full results for context
}
```

---

## 🔧 IMPLEMENTATION PLAN (4-5 hours)

### Phase 3.1.A: Infrastructure (1.5-2 hours)

#### Task A1: Health Check Endpoint (5 min)
**File:** `src/app/api/health/route.ts`

```typescript
export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
}
```

**Test:** `curl http://localhost:3000/api/health`

---

#### Task A2: Sentinel Webhook Endpoint (30 min)
**File:** `src/app/api/sentinel/webhook/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  // 1. Verify webhook token
  const authHeader = req.headers.get('authorization');
  const expectedToken = process.env.SENTINEL_WEBHOOK_TOKEN;

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await req.json();
  const supabase = createSupabaseServiceClient();

  // 2. Store in github_events
  const { error: insertError } = await supabase
    .from('github_events')
    .insert({
      event_type: payload.event_type || 'workflow_run',
      action: 'completed',
      workflow_name: payload.workflow_name,
      pr_number: payload.pr_number,
      branch_name: payload.branch_name,
      commit_sha: payload.commit_sha,
      status: 'completed',
      conclusion: payload.conclusion, // 'success' or 'failure'
      event_data: payload,
      created_at: new Date().toISOString()
    });

  if (insertError) {
    console.error('[Sentinel Webhook] Insert error:', insertError);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  // 3. Find Work Order by PR number (WITH RETRY LOGIC - RACE CONDITION FIX)
  let workOrderId: string | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data } = await supabase
      .from('work_orders')
      .select('id')
      .eq('github_pr_number', payload.pr_number)
      .single();

    if (data?.id) {
      workOrderId = data.id;
      break;
    }

    // Wait 2 seconds before retry (Orchestrator might still be writing)
    if (attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  if (!workOrderId) {
    console.warn(`[Sentinel Webhook] No Work Order found for PR #${payload.pr_number} after retries`);
    // Store event anyway for manual investigation
    return NextResponse.json({
      success: true,
      warning: 'Work Order not found - event stored for later processing'
    });
  }

  // 4. Check if all expected workflows completed
  const expectedWorkflows = (process.env.EXPECTED_WORKFLOWS || 'CI,Integration Tests').split(',');
  const { data: completedWorkflows } = await supabase
    .from('github_events')
    .select('workflow_name')
    .eq('pr_number', payload.pr_number)
    .eq('status', 'completed');

  const completedNames = completedWorkflows?.map(w => w.workflow_name) || [];
  const allCompleted = expectedWorkflows.every(expected =>
    completedNames.includes(expected)
  );

  if (!allCompleted) {
    console.log(`[Sentinel Webhook] Waiting for more workflows. Completed: ${completedNames.join(', ')}`);
    return NextResponse.json({
      success: true,
      status: 'waiting_for_workflows',
      completed: completedNames,
      expected: expectedWorkflows
    });
  }

  // 5. All workflows complete - trigger analysis
  // Import at top: import { analyzeWorkOrder } from '@/lib/sentinel/sentinel-service';
  console.log(`[Sentinel Webhook] All workflows complete for WO ${workOrderId} - triggering analysis`);

  try {
    // TODO: Uncomment after sentinel-service.ts is created
    // await analyzeWorkOrder(workOrderId);
    console.log(`[Sentinel Webhook] Analysis complete for WO ${workOrderId}`);
  } catch (error: any) {
    console.error(`[Sentinel Webhook] Analysis error:`, error);
    // Don't fail the webhook - analysis can be retried manually
  }

  return NextResponse.json({ success: true, work_order_id: workOrderId });
}
```

**Test:**
```bash
# Should return 401
curl -X POST http://localhost:3000/api/sentinel/webhook \
  -H "Content-Type: application/json" \
  -d '{"test":true}'

# Should succeed (after adding token to .env.local)
curl -X POST http://localhost:3000/api/sentinel/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_token_here" \
  -d '{"workflow_name":"CI","pr_number":123,"conclusion":"success"}'
```

---

#### Task A3: GitHub Actions Workflows (45 min)

**File:** `.github/workflows/ci.yml`

```yaml
name: CI
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript check
        run: npx tsc --noEmit

      - name: Build Next.js
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      - name: Report to Sentinel
        if: always()
        run: |
          curl -X POST https://moose-dev-webhook.loca.lt/api/sentinel/webhook \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.SENTINEL_WEBHOOK_TOKEN }}" \
            -d "{
              \"event_type\": \"workflow_run\",
              \"workflow_name\": \"CI\",
              \"pr_number\": ${{ github.event.pull_request.number }},
              \"conclusion\": \"${{ job.status }}\",
              \"branch_name\": \"${{ github.head_ref }}\",
              \"commit_sha\": \"${{ github.event.pull_request.head.sha }}\"
            }"
```

**File:** `.github/workflows/integration-tests.yml`

```yaml
name: Integration Tests
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  integration:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Start dev server
        run: |
          npm run dev &
          echo $! > server.pid
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      - name: Install PowerShell Core
        run: |
          sudo apt-get update
          sudo apt-get install -y powershell

      - name: Wait for server health
        run: |
          for i in {1..30}; do
            if curl -f http://localhost:3000/api/health; then
              echo "Server is ready"
              exit 0
            fi
            echo "Waiting for server... ($i/30)"
            sleep 5
          done
          echo "Server failed to start"
          exit 1

      - name: Run integration tests
        run: pwsh ./phase1-2-integration-test.ps1
        timeout-minutes: 10

      - name: Report to Sentinel
        if: always()
        run: |
          curl -X POST https://moose-dev-webhook.loca.lt/api/sentinel/webhook \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.SENTINEL_WEBHOOK_TOKEN }}" \
            -d "{
              \"event_type\": \"workflow_run\",
              \"workflow_name\": \"Integration Tests\",
              \"pr_number\": ${{ github.event.pull_request.number }},
              \"conclusion\": \"${{ job.status }}\",
              \"branch_name\": \"${{ github.head_ref }}\",
              \"commit_sha\": \"${{ github.event.pull_request.head.sha }}\"
            }"
```

**GitHub Secrets Required:**
1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `ANTHROPIC_API_KEY`
5. `OPENAI_API_KEY`
6. `SENTINEL_WEBHOOK_TOKEN` (generate random token)

---

#### Task A4: Environment Setup (15 min)

**Update:** `.env.local.example`

Add these lines:
```
# Sentinel Configuration
SENTINEL_WEBHOOK_TOKEN=generate_random_token_here
EXPECTED_WORKFLOWS=CI,Integration Tests
```

**Update:** `.env.local`

Add actual values:
```
SENTINEL_WEBHOOK_TOKEN=<generate with: openssl rand -hex 32>
EXPECTED_WORKFLOWS=CI,Integration Tests
```

---

### Phase 3.1.B: Sentinel Logic (1.5 hours)

#### Task B1: Type Definitions (15 min)
**File:** `src/lib/sentinel/types.ts`

```typescript
import { Tables } from '@/types/supabase';

export type GitHubEvent = Tables<'github_events'>;
export type WorkOrder = Tables<'work_orders'>;

export interface WorkflowSummary {
  workflow_name: string;
  conclusion: 'success' | 'failure' | null;
  created_at: string;
}

export interface SentinelDecision {
  decision: 'ready_for_merge' | 'failed' | 'no_data';
  reasoning: string;
  should_escalate: boolean;
  all_workflows_passed: boolean;
  failed_workflows: string[];
  workflows_analyzed: number;
}

export interface SentinelAnalysis {
  work_order_id: string;
  pr_number: number;
  decision: SentinelDecision;
  workflows: WorkflowSummary[];
  analyzed_at: string;
}
```

---

#### Task B2: Test Parser (30 min)
**File:** `src/lib/sentinel/test-parser.ts`

```typescript
import { createSupabaseServiceClient } from '@/lib/supabase';
import type { WorkflowSummary } from './types';

export async function parseWorkflowResults(pr_number: number): Promise<WorkflowSummary[]> {
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from('github_events')
    .select('workflow_name, conclusion, created_at')
    .eq('pr_number', pr_number)
    .eq('event_type', 'workflow_run')
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Sentinel] Error parsing workflows:', error);
    throw error;
  }

  // Deduplicate by workflow_name (keep most recent)
  const uniqueWorkflows = new Map<string, WorkflowSummary>();
  for (const event of data || []) {
    if (!uniqueWorkflows.has(event.workflow_name)) {
      uniqueWorkflows.set(event.workflow_name, {
        workflow_name: event.workflow_name,
        conclusion: event.conclusion as 'success' | 'failure' | null,
        created_at: event.created_at!
      });
    }
  }

  return Array.from(uniqueWorkflows.values());
}
```

---

#### Task B3: Decision Maker (25 min)
**File:** `src/lib/sentinel/decision-maker.ts`

```typescript
import type { WorkflowSummary, SentinelDecision } from './types';

export function makeDecision(workflows: WorkflowSummary[]): SentinelDecision {
  // Handle no workflows
  if (workflows.length === 0) {
    return {
      decision: 'no_data',
      reasoning: 'No workflow results found - workflows may not have run or PR created before GitHub Actions configured',
      should_escalate: true,
      all_workflows_passed: false,
      failed_workflows: [],
      workflows_analyzed: 0
    };
  }

  // Check for null conclusions (shouldn't happen, but defensive)
  const incompleteWorkflows = workflows.filter(w => w.conclusion === null);
  if (incompleteWorkflows.length > 0) {
    return {
      decision: 'no_data',
      reasoning: `${incompleteWorkflows.length} workflow(s) have incomplete results`,
      should_escalate: false, // Don't escalate incomplete - wait for completion
      all_workflows_passed: false,
      failed_workflows: incompleteWorkflows.map(w => w.workflow_name),
      workflows_analyzed: workflows.length
    };
  }

  // Binary pass/fail logic
  const failedWorkflows = workflows.filter(w => w.conclusion === 'failure');
  const allPassed = failedWorkflows.length === 0;

  if (allPassed) {
    return {
      decision: 'ready_for_merge',
      reasoning: `All ${workflows.length} workflow(s) passed: ${workflows.map(w => w.workflow_name).join(', ')}`,
      should_escalate: false,
      all_workflows_passed: true,
      failed_workflows: [],
      workflows_analyzed: workflows.length
    };
  } else {
    return {
      decision: 'failed',
      reasoning: `${failedWorkflows.length} of ${workflows.length} workflow(s) failed: ${failedWorkflows.map(w => w.workflow_name).join(', ')}`,
      should_escalate: true,
      all_workflows_passed: false,
      failed_workflows: failedWorkflows.map(w => w.workflow_name),
      workflows_analyzed: workflows.length
    };
  }
}
```

---

#### Task B4: Sentinel Service (45 min)
**File:** `src/lib/sentinel/sentinel-service.ts`

```typescript
import { createSupabaseServiceClient } from '@/lib/supabase';
import { parseWorkflowResults } from './test-parser';
import { makeDecision } from './decision-maker';
import type { SentinelAnalysis, WorkOrder } from './types';

export async function analyzeWorkOrder(work_order_id: string): Promise<SentinelAnalysis> {
  const supabase = createSupabaseServiceClient();

  // 1. Get Work Order
  const { data: wo, error: woError } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', work_order_id)
    .single();

  if (woError || !wo) {
    throw new Error(`Work Order ${work_order_id} not found: ${woError?.message}`);
  }

  const workOrder = wo as WorkOrder;

  // 2. Verify PR number exists
  if (!workOrder.github_pr_number) {
    throw new Error(`Work Order ${work_order_id} has no github_pr_number - Orchestrator may not have created PR yet`);
  }

  // 3. Parse workflow results
  const workflows = await parseWorkflowResults(workOrder.github_pr_number);

  // 4. Make decision
  const decision = makeDecision(workflows);

  // 5. Update Work Order
  const updatePayload: any = {
    metadata: {
      ...workOrder.metadata,
      sentinel_analysis: {
        status: decision.decision,
        all_workflows_passed: decision.all_workflows_passed,
        failed_workflows: decision.failed_workflows,
        workflows_analyzed: decision.workflows_analyzed,
        reasoning: decision.reasoning,
        ready_for_merge: decision.decision === 'ready_for_merge',
        analyzed_at: new Date().toISOString()
      }
    }
  };

  // If failed, update status
  if (decision.decision === 'failed') {
    updatePayload.status = 'failed';
  }

  const { error: updateError } = await supabase
    .from('work_orders')
    .update(updatePayload)
    .eq('id', work_order_id);

  if (updateError) {
    console.error('[Sentinel] Error updating Work Order:', updateError);
  }

  // 6. Write to outcome_vectors for learning
  if (workOrder.metadata?.proposer_response && workOrder.metadata?.routing_decision) {
    const { error: ovError } = await supabase
      .from('outcome_vectors')
      .insert({
        work_order_id: work_order_id,
        model_used: workOrder.metadata.proposer_response.proposer_used,
        route_reason: workOrder.metadata.routing_decision.reason,
        success: decision.all_workflows_passed,
        cost: workOrder.metadata.proposer_response.cost || 0,
        execution_time_ms: workOrder.metadata.proposer_response.execution_time_ms || 0,
        diff_size_lines: 0, // TODO: Parse from Aider output
        test_duration_ms: null, // TODO: Extract from workflow results
        failure_classes: decision.all_workflows_passed ? null : decision.failed_workflows,
        metadata: {
          sentinel_decision: decision.decision,
          workflows_analyzed: decision.workflows_analyzed,
          reasoning: decision.reasoning
        }
      } as any);

    if (ovError) {
      console.error('[Sentinel] Error writing outcome_vectors:', ovError);
    }
  }

  // 7. Escalate if needed
  if (decision.should_escalate) {
    const { error: escalationError } = await supabase
      .from('escalations')
      .insert({
        work_order_id: work_order_id,
        reason: `Sentinel detected: ${decision.reasoning}`,
        status: 'pending',
        escalation_data: {
          type: 'sentinel_test_failure',
          failed_workflows: decision.failed_workflows,
          pr_number: workOrder.github_pr_number,
          pr_url: workOrder.github_pr_url,
          all_workflows: workflows
        }
      } as any);

    if (escalationError) {
      console.error('[Sentinel] Error creating escalation:', escalationError);
    }
  }

  // 8. Return analysis
  return {
    work_order_id,
    pr_number: workOrder.github_pr_number,
    decision,
    workflows,
    analyzed_at: new Date().toISOString()
  };
}
```

---

#### Task B5: API Endpoint (20 min)
**File:** `src/app/api/sentinel/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { analyzeWorkOrder } from '@/lib/sentinel/sentinel-service';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const work_order_id = searchParams.get('work_order_id');

  if (!work_order_id) {
    return NextResponse.json(
      { error: 'work_order_id query parameter required' },
      { status: 400 }
    );
  }

  try {
    const analysis = await analyzeWorkOrder(work_order_id);
    return NextResponse.json({
      success: true,
      analysis
    });
  } catch (error: any) {
    console.error('[Sentinel API] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Manual trigger for testing
  const { work_order_id } = await req.json();

  if (!work_order_id) {
    return NextResponse.json(
      { error: 'work_order_id required in request body' },
      { status: 400 }
    );
  }

  try {
    const analysis = await analyzeWorkOrder(work_order_id);
    return NextResponse.json({
      success: true,
      analysis
    });
  } catch (error: any) {
    console.error('[Sentinel API] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

---

### Phase 3.1.C: Testing & Documentation (1 hour)

#### Task C1: Integration Tests (30 min)

**Update:** `phase1-2-integration-test.ps1`

Add before "CROSS-PHASE INTEGRATION" section:

```powershell
Write-Host "`n=== PHASE 3.1: Sentinel ===" -ForegroundColor Cyan

Test-Endpoint "Sentinel webhook auth" "401 unauthorized" {
    try {
        Invoke-RestMethod -Uri http://localhost:3000/api/sentinel/webhook `
          -Method POST -Body '{}' -ContentType "application/json"
        $false
    } catch {
        $_.Exception.Response.StatusCode -eq 401
    }
}

Test-Endpoint "Sentinel analysis endpoint" "400 bad request" {
    try {
        Invoke-RestMethod -Uri http://localhost:3000/api/sentinel
        $false
    } catch {
        $_.Exception.Response.StatusCode -eq 400
    }
}
```

---

#### Task C2: Documentation Updates (30 min)

**1. Update `docs/architecture-decisions.md`:**

Find the Sentinel section and update:
```markdown
### SENTINEL (Phase 3.1 - ✅ MVP Complete)

**Status:** Binary pass/fail logic only. No flaky detection, no baselines, no auto-merge.

**Implementation:**
- Parses GitHub Actions results from github_events
- Binary decision: all workflows passed = ready_for_merge, any failed = escalate
- Writes to outcome_vectors for learning
- Creates escalations for Client Manager
- NEVER auto-merges (humans review every PR)

**Deferred to Phase 3.2 (after 100+ test runs):**
- Flaky test detection
- Adaptive baselines (±5% variance)
- Quality drift detection
- Custom quality rules
- Auto-merge capability

**Files:**
- `src/lib/sentinel/types.ts`
- `src/lib/sentinel/test-parser.ts`
- `src/lib/sentinel/decision-maker.ts`
- `src/lib/sentinel/sentinel-service.ts`
- `src/app/api/sentinel/route.ts`
- `src/app/api/sentinel/webhook/route.ts`
- `.github/workflows/ci.yml`
- `.github/workflows/integration-tests.yml`
```

**2. Update `docs/session-state.md`:**

Update "Current Status" section:
```markdown
- ✅ Phase 3.1: Sentinel - Binary pass/fail MVP (GitHub Actions integration)
```

Update test count:
```markdown
4. [ ] Run integration tests: `.\phase1-2-integration-test.ps1` (expect 22/22 passing as of v35)
```

**3. Update `docs/known-issues.md`:**

Add any issues encountered during implementation.

---

## 🎯 SUCCESS CRITERIA

**Infrastructure:**
1. ✅ Health check endpoint responds
2. ✅ Webhook endpoint validates auth (returns 401 without token)
3. ✅ GitHub Actions workflows created
4. ✅ GitHub Secrets configured

**Sentinel Logic:**
5. ✅ Parses github_events correctly
6. ✅ Binary decision works (all pass = ready, any fail = escalate)
7. ✅ Work Order updated with analysis
8. ✅ Failures create escalations
9. ✅ Writes to outcome_vectors

**Testing:**
10. ✅ TypeScript: 0 errors
11. ✅ Integration tests: 22/22 passing
12. ✅ Manual test: Webhook → Parse → Decision → Escalate

---

## ⚠️ KNOWN LIMITATIONS (Document These)

1. **NO Auto-Merge**: Sentinel ONLY creates escalations, never auto-merges (humans review all PRs)
2. **NO Flaky Detection**: Binary pass/fail only - flaky learning deferred to Phase 3.2
3. **NO Baselines**: No historical variance analysis - deferred to Phase 3.2
4. **Localtunnel Dependency**: Requires Terminal 2 running (`lt --port 3000 --subdomain moose-dev-webhook`)
5. **Race Condition Mitigation**: 3-attempt retry with 2-second delays (not guaranteed)

---

## 📦 DELIVERABLES CHECKLIST

**Infrastructure:**
- [ ] `src/app/api/health/route.ts` - Health check
- [ ] `src/app/api/sentinel/webhook/route.ts` - Webhook handler (with retry logic)
- [ ] `.github/workflows/ci.yml` - CI workflow
- [ ] `.github/workflows/integration-tests.yml` - Integration tests
- [ ] `.env.local` - Add SENTINEL_WEBHOOK_TOKEN and EXPECTED_WORKFLOWS

**Sentinel Logic:**
- [ ] `src/lib/sentinel/types.ts` - Types
- [ ] `src/lib/sentinel/test-parser.ts` - Parse github_events
- [ ] `src/lib/sentinel/decision-maker.ts` - Binary pass/fail logic
- [ ] `src/lib/sentinel/sentinel-service.ts` - Orchestration
- [ ] `src/app/api/sentinel/route.ts` - API endpoint

**Testing & Docs:**
- [ ] Integration tests added (Tests 24-25)
- [ ] TypeScript: 0 errors
- [ ] Update architecture-decisions.md
- [ ] Update session-state.md
- [ ] Update known-issues.md (if issues found)

---

## 🚀 IMPLEMENTATION ORDER

1. **Health check** (5 min) - TEST IMMEDIATELY with curl
2. **Webhook endpoint** (30 min) - TEST WITH CURL (auth check)
3. **Environment vars** (15 min) - Add to .env.local
4. **Sentinel types** (15 min) - Create types.ts
5. **Test parser** (30 min) - Create test-parser.ts
6. **Decision maker** (25 min) - Create decision-maker.ts
7. **Sentinel service** (45 min) - Create sentinel-service.ts
8. **API endpoint** (20 min) - Create route.ts
9. **Wire webhook to service** (10 min) - Uncomment analyzeWorkOrder call
10. **GitHub Actions** (45 min) - Create workflows (AFTER service works locally)
11. **Integration tests** (30 min) - Add Tests 24-25
12. **Documentation** (30 min) - Update all docs

**Total: 4-5 hours**

---

## 🧪 TESTING STRATEGY

### Local Testing (Before GitHub Actions)
1. Test health endpoint: `curl http://localhost:3000/api/health`
2. Test webhook auth: `curl -X POST http://localhost:3000/api/sentinel/webhook -H "Content-Type: application/json" -d '{}'` (expect 401)
3. Test manual analysis: Create test Work Order → call POST `/api/sentinel` with work_order_id

### GitHub Actions Testing (After Workflows Created)
1. Start localtunnel: `lt --port 3000 --subdomain moose-dev-webhook` (Terminal 2)
2. Create dummy PR
3. Watch GitHub Actions run
4. Verify webhook received
5. Verify Sentinel analysis triggered
6. Verify escalation created (if tests fail)

---

## 🔧 TROUBLESHOOTING GUIDE

### Webhook Not Receiving Events
- ✅ Check localtunnel is running (Terminal 2)
- ✅ Verify GitHub Secrets contain SENTINEL_WEBHOOK_TOKEN
- ✅ Check webhook URL in workflows matches localtunnel subdomain
- ✅ Check GitHub Actions logs for curl errors

### Work Order Not Found (Race Condition)
- ✅ Verify Orchestrator sets github_pr_number before webhook arrives
- ✅ Check retry logic is working (3 attempts, 2-second delays)
- ✅ Manually trigger analysis after PR created: POST `/api/sentinel` with work_order_id

### Workflows Waiting Forever
- ✅ Check EXPECTED_WORKFLOWS env var matches workflow names exactly (case-sensitive)
- ✅ Verify both workflows are configured in GitHub Actions
- ✅ Check github_events table for stored workflow results

### TypeScript Errors
- ✅ Regenerate types: `npx supabase gen types typescript --project-id qclxdnbvoruvqnhsshjr > src/types/supabase.ts`
- ✅ Check all imports use correct paths
- ✅ Verify (as any) type assertions where needed

---

## 📝 SESSION HANDOVER NOTES

**If terminal crashes or session ends, next Claude Code should:**
1. Read this file first: `docs/sentinel-implementation-plan.md`
2. Check what's been completed (review checklist above)
3. Verify TypeScript compilation: `npx tsc --noEmit`
4. Run integration tests: `.\phase1-2-integration-test.ps1`
5. Continue from where previous session left off

**Context preserved in:**
- `docs/sentinel-implementation-plan.md` (this file)
- `docs/architecture-decisions.md` (updated with Sentinel status)
- `docs/session-state.md` (tracks overall progress)

---

**Created:** 2025-10-02
**Last Updated:** 2025-10-02
**Next Session:** Continue with Task A1 (Health Check Endpoint)
