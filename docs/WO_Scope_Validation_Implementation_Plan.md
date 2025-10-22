# Work Order Scope Validation: Implementation Plan

**Document Version:** 1.0
**Date:** 2025-10-22
**Status:** Approved - Ready for Implementation
**Estimated Duration:** 4-5 sessions (20-25 hours total)
**Budget:** $10-20 total cost

---

## Overview

This document provides a session-by-session implementation plan for WO Scope Validation with Tier 3 Validator. Each session is designed to:

1. **Fit within token budget** (~50-70k tokens for implementation)
2. **End at logical breakpoints** (no mid-task handovers)
3. **Include verification steps** (test before proceeding)
4. **Be resumable** (clear entry criteria)

**Reference Documents:**
- **Analysis & Recommendations:** `docs/WO_Scope_Validation_Analysis_And_Recommendations.md`
- **Original Proposal:** `docs/Discussion - Decomposition Improvement(1).txt`
- **Handover Master:** `docs/session_updates/SESSION_HANDOVER_MASTER.md`

---

## Session Breakdown & Token Budget

| Session | Phase | Duration | Tasks | Token Budget | Exit Criteria |
|---------|-------|----------|-------|--------------|---------------|
| **V112** | Single-Batch Test + Setup | 4h | Test execution, schema validation | 50k | Test results validated |
| **V113** | Phase 1 Complete | 6h | Shadow mode implementation | 60k | Shadow mode deployed |
| **V114** | Phase 2a: Validator Core | 8h | Tier 3 validator logic | 65k | Validator tests pass |
| **V115** | Phase 2b: Integration | 6h | Validator integration + testing | 55k | 10 WO test complete |
| **V116** | Phase 3 (Optional) | 8h | Selective refinement | 60k | Refinement tested |

**Current Session (V112):** 127k/200k used, 73k remaining
**Estimated V112 usage:** 50k → Will end at ~177k (safe handover point)

---

## Implementation Strategy

### Context Management Rules

**For each session:**

1. **Session Start (<5k tokens):**
   - Load SESSION_HANDOVER_MASTER.md
   - Load SESSION_START_QUICK.md
   - Load previous session handover
   - Confirm §5.1 compliance

2. **Implementation Phase (40-60k tokens):**
   - Read required files (budget: 10-15k)
   - Write new code (budget: 20-30k)
   - Test execution (budget: 10-15k)

3. **Session End (<10k tokens):**
   - Create session handover document
   - Update implementation plan status
   - Archive evidence

4. **Emergency Handover Trigger:**
   - If tokens reach 180k during implementation → stop and handover
   - If complex task in progress → revert changes and handover with task incomplete

### Logical Breakpoints

**Safe handover points (low context):**
- ✅ After test execution (results documented)
- ✅ After file creation (no mid-edit)
- ✅ After deployment (no mid-integration)

**Unsafe handover points (avoid):**
- ❌ During multi-file refactoring
- ❌ During test debugging
- ❌ Mid-implementation of complex logic

---

## Session V112: Single-Batch Test + Phase 1a Setup

**Status:** CURRENT SESSION
**Duration:** 4 hours
**Token Budget:** 50k (current: 127k → target: 177k)

### Entry Criteria

- ✅ Analysis document reviewed (`WO_Scope_Validation_Analysis_And_Recommendations.md`)
- ✅ Q1-Q4 answers confirmed
- ✅ Session start protocol completed

### Objectives

1. **Execute single-batch test** (per Q4)
2. **Validate database schema** (per Q2)
3. **Create test infrastructure** (scripts, monitoring)
4. **Collect baseline data** (complexity predictions)

### Task List

#### Task 1: Schema Validation (30 min, ~5k tokens)

**Files to read:**
- `src/types/supabase.ts` (already read this session)
- `src/types/architect.ts` (already read this session)

**Create validation script:**
```bash
scripts/validate-schema-for-scope-validator.ts
```

**Script checks:**
1. ✅ `files_in_scope` is Json type (not array)
2. ✅ `acceptance_criteria` is Json type
3. ✅ `metadata` structure (where dependencies stored)
4. ✅ `risk_level` enum values ('low', 'medium', 'high')
5. ✅ Query 5 sample WOs to verify structure

**Exit criteria:**
- Script outputs: "Schema validation passed ✅"
- Document any mismatches in handover

#### Task 2: Find Test Decomposition (30 min, ~5k tokens)

**Create script:**
```bash
scripts/find-test-decomposition-candidate.ts
```

**Criteria:**
- 10-20 WOs total
- Mix: 30% healthy, 40% review, 30% oversized (approximate)
- Status: pending (not yet executed)
- Created in last 30 days

**Output:**
```json
{
  "project_id": "uuid",
  "project_name": "Multi-LLM Discussion v1",
  "wo_count": 15,
  "complexity_distribution": {
    "healthy": 4,
    "review": 6,
    "oversized": 5
  },
  "selected": true
}
```

**Exit criteria:**
- Found 1 suitable test batch
- Documented in `evidence/v112/test-batch-selection.json`

#### Task 3: Implement Complexity Calculator (1 hour, ~15k tokens)

**Create file:**
```bash
src/lib/wo-complexity-calculator.ts
```

**Implementation:**
```typescript
export interface WOComplexitySignal {
  score: number; // 0.0-1.0
  signal: 'healthy' | 'review_recommended' | 'likely_oversized';
  guidance: string;
  factors: {
    fileCount: number;
    criteriaCount: number;
    dependencyCount: number;
    estimatedTokens: number;
    riskLevel: number;
  };
}

export function assessWOScope(wo: WorkOrder): WOComplexitySignal {
  // Extract counts (handle Json type)
  const files = Array.isArray(wo.files_in_scope)
    ? wo.files_in_scope.length
    : ((wo.files_in_scope as any)?.length || 0);

  const criteria = Array.isArray(wo.acceptance_criteria)
    ? wo.acceptance_criteria.length
    : ((wo.acceptance_criteria as any)?.length || 0);

  const metadata = wo.metadata as any;
  const deps = metadata?.dependencies?.length || 0;

  const tokens = wo.context_budget_estimate || 1000;

  const riskMultiplier =
    wo.risk_level === 'high' ? 1.0 :
    wo.risk_level === 'medium' ? 0.6 : 0.3;

  // Formula (adjusted weights from analysis)
  const score = (
    (files / 6) * 0.35 +        // Increased from 0.30
    (criteria / 8) * 0.25 +
    (deps / 4) * 0.15 +
    (tokens / 4000) * 0.15 +    // Decreased from 0.20
    riskMultiplier * 0.10
  );

  // Categorize
  const signal =
    score < 0.55 ? 'healthy' :
    score < 0.70 ? 'review_recommended' : 'likely_oversized';

  const guidance =
    signal === 'healthy' ? 'WO scope is appropriate' :
    signal === 'review_recommended' ? 'Consider simplifying this WO' :
    'WO is likely too large - strong split candidate';

  return {
    score,
    signal,
    guidance,
    factors: {
      fileCount: files,
      criteriaCount: criteria,
      dependencyCount: deps,
      estimatedTokens: tokens,
      riskLevel: riskMultiplier
    }
  };
}
```

**Tests:**
```bash
src/lib/__tests__/wo-complexity-calculator.test.ts
```

**Test cases:**
1. ✅ Known WO from v110 (Validation Suite - 0.41)
2. ✅ Known WO from v110 (Redux Store - 0.55)
3. ✅ Known WO from v110 (Clipboard Coord - 0.98)
4. ✅ Edge case: 0 files
5. ✅ Edge case: null metadata

**Exit criteria:**
- All 5 tests pass
- Formula matches known WOs within 0.02 tolerance

#### Task 4: Shadow Mode Scanner (1 hour, ~15k tokens)

**Create file:**
```bash
src/lib/wo-scope-validator.ts
```

**Implementation (logging only):**
```typescript
export interface ScanResult {
  total: number;
  healthy: number;
  review_recommended: number;
  likely_oversized: number;
  problematicPercent: number;
  problematicWOs: Array<{
    index: number;
    wo: WorkOrder;
    signal: WOComplexitySignal;
  }>;
}

export function scanComplexity(workOrders: WorkOrder[]): ScanResult {
  const signals = workOrders.map((wo, idx) => ({
    index: idx,
    wo,
    signal: assessWOScope(wo)
  }));

  const categorized = {
    healthy: signals.filter(s => s.signal.signal === 'healthy'),
    review_recommended: signals.filter(s => s.signal.signal === 'review_recommended'),
    likely_oversized: signals.filter(s => s.signal.signal === 'likely_oversized')
  };

  const problematic = [
    ...categorized.review_recommended,
    ...categorized.likely_oversized
  ];

  return {
    total: workOrders.length,
    healthy: categorized.healthy.length,
    review_recommended: categorized.review_recommended.length,
    likely_oversized: categorized.likely_oversized.length,
    problematicPercent: problematic.length / workOrders.length,
    problematicWOs: problematic
  };
}

// Logging function (no action taken)
export async function logComplexityScan(
  specId: string,
  scanResult: ScanResult
): Promise<void> {
  console.log(`\n📊 Complexity Scan Results:`);
  console.log(`   Total WOs: ${scanResult.total}`);
  console.log(`   Healthy: ${scanResult.healthy} (${(scanResult.healthy/scanResult.total*100).toFixed(1)}%)`);
  console.log(`   Review: ${scanResult.review_recommended} (${(scanResult.review_recommended/scanResult.total*100).toFixed(1)}%)`);
  console.log(`   Oversized: ${scanResult.likely_oversized} (${(scanResult.likely_oversized/scanResult.total*100).toFixed(1)}%)`);
  console.log(`   Problematic: ${(scanResult.problematicPercent*100).toFixed(1)}%\n`);

  // TODO V113: Log to database
}
```

**Exit criteria:**
- Function compiles without errors
- No database integration yet (V113 task)

#### Task 5: Execute Single-Batch Test (1 hour, ~10k tokens)

**Run on test decomposition:**
```bash
# Manually run complexity scan on test batch
powershell.exe -File scripts/run-with-env.ps1 scripts/test-single-batch-scan.ts
```

**Script:**
```typescript
// scripts/test-single-batch-scan.ts
import { scanComplexity } from '../src/lib/wo-scope-validator';

async function main() {
  // Load test decomposition (from Task 2)
  const { data: wos } = await supabase
    .from('work_orders')
    .select('*')
    .eq('project_id', TEST_PROJECT_ID);

  // Run complexity scan
  const scanResult = scanComplexity(wos);

  // Log results
  console.log(JSON.stringify(scanResult, null, 2));

  // Select 5 WOs for execution
  const selectedWOs = [
    scanResult.problematicWOs.filter(w => w.signal.signal === 'healthy')[0],
    scanResult.problematicWOs.filter(w => w.signal.signal === 'review_recommended')[0],
    scanResult.problematicWOs.filter(w => w.signal.signal === 'review_recommended')[1],
    scanResult.problematicWOs.filter(w => w.signal.signal === 'likely_oversized')[0],
    scanResult.problematicWOs.filter(w => w.signal.signal === 'likely_oversized')[1]
  ].filter(Boolean);

  console.log(`\nSelected ${selectedWOs.length} WOs for execution test`);

  // Output WO IDs for approval
  selectedWOs.forEach(({ index, wo, signal }) => {
    console.log(`  WO-${index}: ${wo.title.substring(0, 50)}... (${signal.score.toFixed(2)} - ${signal.signal})`);
  });

  // Save results
  await fs.writeFile(
    'docs/session_updates/evidence/v112/single-batch-scan-results.json',
    JSON.stringify({ scanResult, selectedWOs }, null, 2)
  );
}
```

**Exit criteria:**
- 5 WOs selected for execution (1 healthy, 2 review, 2 oversized)
- Results saved to evidence folder
- No execution yet (next session if time allows)

### Session V112 Exit Criteria

**Must complete before handover:**
- ✅ Schema validation passed
- ✅ Test decomposition identified
- ✅ Complexity calculator implemented and tested
- ✅ Shadow mode scanner implemented
- ✅ Single-batch scan executed and results saved

**Token checkpoint:** ~177k/200k used (safe handover zone)

**Handover document:** `docs/session_updates/session-v112-YYYYMMDD-HHMM-handover.md`

**Handover includes:**
- ✅ Test batch selection rationale
- ✅ Schema validation results
- ✅ Complexity scan results (5 WOs selected)
- ✅ Next session entry point: Execute 5 WOs or proceed to Phase 1b

---

## Session V113: Phase 1 Complete + Phase 2a Start

**Status:** Planned
**Duration:** 6 hours
**Token Budget:** 60k (start: ~20k → target: 80k)

### Entry Criteria

**Read at session start:**
- `docs/session_updates/session-v112-*-handover.md` (last session)
- `docs/WO_Scope_Validation_Implementation_Plan.md` (this document, V113 section)
- `docs/session_updates/evidence/v112/single-batch-scan-results.json` (test data)

**Prerequisites:**
- ✅ V112 exit criteria met
- ✅ 5 WOs selected for execution test
- ✅ Complexity calculator tested

### Objectives

1. **Execute 5 test WOs with gpt-4o-mini** (validate hypothesis)
2. **Implement database logging** (complexity_scan_logs table)
3. **Integrate scanner into architect-service** (shadow mode)
4. **Deploy shadow mode to production** (1-week data collection)
5. **START Phase 2a: Tier 3 Validator core logic** (if time permits)

### Task List

#### Task 1: Execute 5 Test WOs (1.5 hours, ~15k tokens)

**Approve WOs for execution:**
```bash
powershell.exe -File scripts/run-with-env.ps1 scripts/approve-single-batch-test-wos.ts
```

**Monitor execution:**
```bash
# Start orchestrator daemon
npm run orchestrator:daemon

# Monitor in separate terminal
powershell.exe -File scripts/run-with-env.ps1 scripts/monitor-single-batch-execution.ts
```

**Collect results:**
- Acceptance scores (if acceptance validation runs)
- Refinement cycles
- TS errors
- Actual cost

**Exit criteria:**
- 5 WOs executed (or failed with documented reason)
- Results saved to `evidence/v113/single-batch-execution-results.json`

#### Task 2: Analyze Correlation (30 min, ~8k tokens)

**Create analysis script:**
```bash
scripts/analyze-single-batch-correlation.ts
```

**Output:**
```
Single-Batch Test Results:

Predicted vs Actual:
  WO-03 (Healthy, 0.42):        Actual: 75/100 ✅ (predicted healthy)
  WO-08 (Review, 0.58):         Actual: 60/100 ✅ (predicted review)
  WO-11 (Review, 0.63):         Actual: 55/100 ✅ (predicted review)
  WO-19 (Oversized, 0.82):      Actual: 42/100 ✅ (predicted oversized)
  WO-23 (Oversized, 0.91):      Actual: 38/100 ✅ (predicted oversized)

Correlation: r = -0.93 ✅ (strong inverse)
Accuracy: 5/5 (100%) ✅
Average gpt-4o-mini score: 54/100

DECISION: ✅ Formula validated - proceed to Phase 1b
```

**Decision gate:**
- **GO** if r < -0.80 AND accuracy >75%
- **ADJUST** if r > -0.80 OR accuracy <75%
- **STOP** if r > -0.50 AND accuracy <60%

#### Task 3: Database Integration (1 hour, ~10k tokens)

**Create migration:**
```sql
-- migrations/20251022_complexity_scan_logs.sql
CREATE TABLE complexity_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id UUID,
  project_id UUID REFERENCES projects(id),
  scan_result JSONB NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Quick access fields
  total_wos INT NOT NULL,
  healthy_count INT NOT NULL,
  review_count INT NOT NULL,
  oversized_count INT NOT NULL,
  problematic_percent FLOAT NOT NULL
);

CREATE INDEX idx_complexity_scans_timestamp
  ON complexity_scan_logs(timestamp DESC);

CREATE INDEX idx_complexity_scans_project
  ON complexity_scan_logs(project_id);
```

**Update logComplexityScan():**
```typescript
export async function logComplexityScan(
  specId: string,
  projectId: string,
  scanResult: ScanResult
): Promise<void> {
  // Console logging (keep existing)
  console.log(`\n📊 Complexity Scan Results:...`);

  // Database logging (new)
  const { error } = await supabase
    .from('complexity_scan_logs')
    .insert({
      spec_id: specId,
      project_id: projectId,
      scan_result: scanResult as any,
      total_wos: scanResult.total,
      healthy_count: scanResult.healthy,
      review_count: scanResult.review_recommended,
      oversized_count: scanResult.likely_oversized,
      problematic_percent: scanResult.problematicPercent
    });

  if (error) {
    console.error('Failed to log complexity scan:', error.message);
    // Don't throw - logging failure shouldn't break decomposition
  }
}
```

**Exit criteria:**
- Migration applied to database
- logComplexityScan() saves to database successfully
- Test with single decomposition

#### Task 4: Integrate into Architect Service (1 hour, ~10k tokens)

**Read file:**
```bash
src/lib/architect-service.ts
```

**Integration point:** After line 115 (after existing validations)

**Changes:**
```typescript
// Line 115 (after existing validations)

// NEW: Complexity scan (shadow mode - logging only)
if (process.env.WO_SCOPE_SHADOW_MODE === 'true') {
  const { scanComplexity, logComplexityScan } = await import('./wo-scope-validator');

  try {
    const scanResult = scanComplexity(decomposition.work_orders);
    await logComplexityScan(
      crypto.randomUUID(), // spec_id (TODO: get from spec)
      options?.projectId || null,
      scanResult
    );
  } catch (error: any) {
    console.warn('Complexity scan failed:', error.message);
    // Continue decomposition even if scan fails
  }
}

return decomposition; // Line 128 (unchanged)
```

**Exit criteria:**
- Integration compiles without errors
- Shadow mode tested locally with 1 decomposition
- No impact on decomposition output

#### Task 5: Deploy Shadow Mode (30 min, ~5k tokens)

**Enable in production:**
```bash
# Set environment variable
export WO_SCOPE_SHADOW_MODE=true

# Restart orchestrator daemon
npm run orchestrator:daemon
```

**Monitor for 1 week:**
- Create monitoring script: `scripts/monitor-shadow-mode.ts`
- Check daily for errors
- Collect at least 10-20 decompositions

**Exit criteria:**
- Shadow mode deployed
- Monitoring script created
- Documentation updated with deployment date

#### Task 6: START Phase 2a - Tier 3 Validator Core (1 hour if time, ~12k tokens)

**If token budget allows (V113 <70k), start Tier 3 Validator:**

**Create file:**
```bash
src/lib/completeness-validator.ts
```

**Initial implementation (basic structure):**
```typescript
export interface ValidationIssue {
  type: 'missing_tests' | 'placeholder_code' | 'broken_import' |
        'missing_error_handling' | 'type_any';
  severity: 'error' | 'warning';
  file: string;
  line?: number;
  description: string;
  suggestion: string;
}

export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
  score: number; // 0-100
}

export async function validateCompleteness(
  workOrder: WorkOrder,
  generatedFiles: Map<string, string>
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  // Check 1: Test files must have assertions
  issues.push(...await checkTestAssertions(generatedFiles));

  // Check 2: Detect placeholder code
  issues.push(...await checkPlaceholders(generatedFiles));

  // Check 3: Validate imports
  issues.push(...await checkImports(generatedFiles));

  // Check 4: Error handling coverage
  issues.push(...await checkErrorHandling(generatedFiles));

  // Check 5: Type safety scan
  issues.push(...await checkTypeSafety(generatedFiles));

  const passed = issues.filter(i => i.severity === 'error').length === 0;
  const score = calculateScore(issues);

  return { passed, issues, score };
}
```

**Exit criteria (if started):**
- Basic structure created
- Type definitions complete
- No implementation of check functions yet (V114 task)

### Session V113 Exit Criteria

**Must complete before handover:**
- ✅ 5 test WOs executed and analyzed
- ✅ Correlation validated (r < -0.80)
- ✅ Database logging implemented
- ✅ Shadow mode integrated into architect-service
- ✅ Shadow mode deployed to production

**Optional (if time):**
- ⬜ Tier 3 Validator structure started

**Token checkpoint:** ~80k/200k used (safe handover zone)

**Handover document:** `docs/session_updates/session-v113-YYYYMMDD-HHMM-handover.md`

**Handover includes:**
- ✅ Single-batch test results (correlation, accuracy)
- ✅ Decision gate outcome (proceed to Phase 1b?)
- ✅ Shadow mode deployment status
- ✅ Next session entry point: Phase 2a (Tier 3 Validator implementation)

---

## Session V114: Phase 2a - Tier 3 Validator Implementation

**Status:** Planned
**Duration:** 8 hours
**Token Budget:** 65k (start: ~20k → target: 85k)

### Entry Criteria

**Read at session start:**
- `docs/session_updates/session-v113-*-handover.md`
- `docs/WO_Scope_Validation_Implementation_Plan.md` (this document, V114 section)
- `src/lib/completeness-validator.ts` (if started in V113)

**Prerequisites:**
- ✅ V113 exit criteria met
- ✅ Shadow mode deployed and collecting data
- ✅ Single-batch test validated formula

### Objectives

1. **Implement 5 validator checks** (test assertions, placeholders, imports, error handling, type safety)
2. **Create comprehensive tests** (unit tests for each check)
3. **Test on historical failed WOs** (v110/v111 failures)
4. **Document expected improvements** (projected score gains)

### Task List

#### Task 1: Test Assertion Checker (1.5 hours, ~15k tokens)

**Implementation:**
```typescript
async function checkTestAssertions(
  generatedFiles: Map<string, string>
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  for (const [filePath, content] of generatedFiles) {
    // Only check test files
    if (!filePath.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/)) continue;

    // Count assertions
    const assertionPatterns = [
      /expect\(/g,
      /assert\./g,
      /should\./g,
      /toBe\(/g,
      /toEqual\(/g,
      /toMatch\(/g
    ];

    let assertionCount = 0;
    for (const pattern of assertionPatterns) {
      const matches = content.match(pattern);
      assertionCount += matches ? matches.length : 0;
    }

    // Check test block count
    const testBlocks = content.match(/\b(it|test)\(/g);
    const testCount = testBlocks ? testBlocks.length : 0;

    // Validation rules
    if (testCount === 0) {
      issues.push({
        type: 'missing_tests',
        severity: 'error',
        file: filePath,
        description: 'Test file has no test cases',
        suggestion: 'Add at least one it() or test() block with assertions'
      });
    } else if (assertionCount === 0) {
      issues.push({
        type: 'missing_tests',
        severity: 'error',
        file: filePath,
        description: 'Test file has no assertions',
        suggestion: 'Add expect() assertions to verify behavior'
      });
    } else if (assertionCount < testCount * 2) {
      issues.push({
        type: 'missing_tests',
        severity: 'warning',
        file: filePath,
        description: `Only ${assertionCount} assertions for ${testCount} tests (recommended: ${testCount * 3})`,
        suggestion: 'Add more comprehensive assertions per test'
      });
    }
  }

  return issues;
}
```

**Tests:**
```typescript
// __tests__/completeness-validator.test.ts
describe('checkTestAssertions', () => {
  it('should detect missing test blocks', async () => {
    const files = new Map([['test.test.ts', 'import { describe } from "vitest";']]);
    const issues = await checkTestAssertions(files);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('missing_tests');
  });

  it('should detect missing assertions', async () => {
    const files = new Map([['test.test.ts', 'it("test", () => {});']]);
    const issues = await checkTestAssertions(files);
    expect(issues[0].description).toContain('no assertions');
  });

  it('should pass valid test file', async () => {
    const files = new Map([
      ['test.test.ts', 'it("test", () => { expect(true).toBe(true); });']
    ]);
    const issues = await checkTestAssertions(files);
    expect(issues).toHaveLength(0);
  });
});
```

**Exit criteria:**
- Implementation complete
- 3+ unit tests passing

#### Task 2: Placeholder Code Detector (1.5 hours, ~15k tokens)

**Implementation:**
```typescript
async function checkPlaceholders(
  generatedFiles: Map<string, string>
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  const placeholderPatterns = [
    // Comment-only functions
    {
      pattern: /function\s+\w+\s*\([^)]*\)\s*{\s*\/\/[^\n]*\s*}/g,
      description: 'Function body is only a comment'
    },
    // TODO/FIXME markers
    {
      pattern: /\/\/\s*(TODO|FIXME|HACK|XXX):/gi,
      description: 'Contains TODO/FIXME marker'
    },
    // Empty try-catch
    {
      pattern: /catch\s*\([^)]*\)\s*{\s*}/g,
      description: 'Empty catch block (swallows errors)'
    },
    // Placeholder strings
    {
      pattern: /(placeholder|not implemented|coming soon|stub)/gi,
      description: 'Contains placeholder text'
    },
    // Empty methods
    {
      pattern: /\w+\s*\([^)]*\)\s*{\s*return\s*;\s*}/g,
      description: 'Method returns nothing (empty implementation)'
    }
  ];

  for (const [filePath, content] of generatedFiles) {
    // Skip test files and type definitions
    if (filePath.match(/\.(test|spec|d\.ts)$/)) continue;

    for (const { pattern, description } of placeholderPatterns) {
      const matches = content.matchAll(pattern);

      for (const match of matches) {
        const lineNumber = content.substring(0, match.index).split('\n').length;

        issues.push({
          type: 'placeholder_code',
          severity: 'error',
          file: filePath,
          line: lineNumber,
          description: `${description}: ${match[0].substring(0, 50)}...`,
          suggestion: 'Implement full logic instead of placeholder'
        });
      }
    }
  }

  return issues;
}
```

**Exit criteria:**
- Detects all 5 placeholder patterns
- 5+ unit tests passing

#### Task 3: Import Validator (1 hour, ~10k tokens)

**Implementation:**
```typescript
async function checkImports(
  generatedFiles: Map<string, string>
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Build set of generated file paths
  const generatedPaths = new Set(Array.from(generatedFiles.keys()));

  for (const [filePath, content] of generatedFiles) {
    // Extract import statements
    const importPattern = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
    const matches = content.matchAll(importPattern);

    for (const match of matches) {
      const importPath = match[1];

      // Skip external packages (node_modules)
      if (!importPath.startsWith('.')) continue;

      // Resolve relative path
      const resolvedPath = resolveImportPath(filePath, importPath);

      // Check if imported file exists (in generated files or on disk)
      const exists =
        generatedPaths.has(resolvedPath) ||
        generatedPaths.has(resolvedPath + '.ts') ||
        generatedPaths.has(resolvedPath + '.tsx') ||
        await fs.access(resolvedPath).then(() => true).catch(() => false);

      if (!exists) {
        const lineNumber = content.substring(0, match.index).split('\n').length;

        issues.push({
          type: 'broken_import',
          severity: 'error',
          file: filePath,
          line: lineNumber,
          description: `Import references non-existent file: ${importPath}`,
          suggestion: `Create ${resolvedPath} or remove import`
        });
      }
    }
  }

  return issues;
}

function resolveImportPath(fromFile: string, importPath: string): string {
  const fromDir = path.dirname(fromFile);
  return path.resolve(fromDir, importPath);
}
```

**Exit criteria:**
- Detects broken relative imports
- 3+ unit tests passing

#### Task 4: Error Handling Checker (1.5 hours, ~12k tokens)

**Implementation:**
```typescript
async function checkErrorHandling(
  generatedFiles: Map<string, string>
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Risky operations that should have error handling
  const riskyPatterns = [
    { pattern: /fs\.(read|write|unlink|mkdir)/g, operation: 'File system operation' },
    { pattern: /fetch\(/g, operation: 'Network request' },
    { pattern: /JSON\.parse\(/g, operation: 'JSON parsing' },
    { pattern: /\.send\(/g, operation: 'IPC send' },
    { pattern: /await\s+\w+\(/g, operation: 'Async operation' }
  ];

  for (const [filePath, content] of generatedFiles) {
    // Skip test files
    if (filePath.match(/\.(test|spec)\.ts$/)) continue;

    for (const { pattern, operation } of riskyPatterns) {
      const matches = content.matchAll(pattern);

      for (const match of matches) {
        const lineNumber = content.substring(0, match.index!).split('\n').length;

        // Check if this line is within a try-catch
        const beforeMatch = content.substring(0, match.index);
        const tryCount = (beforeMatch.match(/\btry\s*{/g) || []).length;
        const catchCount = (beforeMatch.match(/\bcatch\s*\(/g) || []).length;

        const insideTryCatch = tryCount > catchCount;

        if (!insideTryCatch) {
          issues.push({
            type: 'missing_error_handling',
            severity: 'warning',
            file: filePath,
            line: lineNumber,
            description: `${operation} without error handling: ${match[0]}`,
            suggestion: 'Wrap in try-catch or add .catch() handler'
          });
        }
      }
    }
  }

  return issues;
}
```

**Exit criteria:**
- Detects unhandled risky operations
- 4+ unit tests passing

#### Task 5: Type Safety Scanner (1 hour, ~10k tokens)

**Implementation:**
```typescript
async function checkTypeSafety(
  generatedFiles: Map<string, string>
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  const typeIssuePatterns = [
    // Explicit 'any' type
    {
      pattern: /:\s*any\b/g,
      severity: 'warning' as const,
      description: 'Uses explicit any type'
    },
    // Unsafe type assertions
    {
      pattern: /as\s+any\b/g,
      severity: 'warning' as const,
      description: 'Uses unsafe type assertion (as any)'
    },
    // @ts-ignore comments
    {
      pattern: /@ts-ignore/g,
      severity: 'error' as const,
      description: 'Suppresses TypeScript errors with @ts-ignore'
    },
    // Non-null assertion on potentially null
    {
      pattern: /\w+!\./g,
      severity: 'warning' as const,
      description: 'Non-null assertion (!) - may be unsafe'
    }
  ];

  for (const [filePath, content] of generatedFiles) {
    for (const { pattern, severity, description } of typeIssuePatterns) {
      const matches = content.matchAll(pattern);

      for (const match of matches) {
        const lineNumber = content.substring(0, match.index).split('\n').length;

        issues.push({
          type: 'type_any',
          severity,
          file: filePath,
          line: lineNumber,
          description: `${description}: ${match[0]}`,
          suggestion: 'Use specific types instead of any'
        });
      }
    }
  }

  return issues;
}
```

**Exit criteria:**
- Detects 4 type safety issues
- 4+ unit tests passing

#### Task 6: Integration & Scoring (1.5 hours, ~10k tokens)

**Complete validateCompleteness():**
```typescript
function calculateScore(issues: ValidationIssue[]): number {
  // Start at 100
  let score = 100;

  // Deduct points by severity
  for (const issue of issues) {
    if (issue.severity === 'error') {
      score -= 5; // -5 per error
    } else if (issue.severity === 'warning') {
      score -= 2; // -2 per warning
    }
  }

  return Math.max(0, score);
}

export async function validateCompleteness(
  workOrder: WorkOrder,
  generatedFiles: Map<string, string>
): Promise<ValidationResult> {
  console.log(`\n🔍 Validating completeness for: ${workOrder.title}`);

  const issues: ValidationIssue[] = [];

  // Run all checks
  issues.push(...await checkTestAssertions(generatedFiles));
  issues.push(...await checkPlaceholders(generatedFiles));
  issues.push(...await checkImports(generatedFiles));
  issues.push(...await checkErrorHandling(generatedFiles));
  issues.push(...await checkTypeSafety(generatedFiles));

  // Calculate score
  const score = calculateScore(issues);
  const passed = issues.filter(i => i.severity === 'error').length === 0;

  // Log summary
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  console.log(`   Issues: ${errorCount} errors, ${warningCount} warnings`);
  console.log(`   Score: ${score}/100 ${passed ? '✅' : '❌'}`);

  return { passed, issues, score };
}
```

**Exit criteria:**
- All 5 checks integrated
- Scoring function implemented
- Comprehensive unit tests (15+ tests total)

### Session V114 Exit Criteria

**Must complete before handover:**
- ✅ All 5 validator checks implemented
- ✅ Comprehensive test suite (15+ tests, >90% coverage)
- ✅ Tested on 3 historical failed WOs from v110/v111
- ✅ Documented expected improvements

**Token checkpoint:** ~85k/200k used (safe handover zone)

**Handover document:** `docs/session_updates/session-v114-YYYYMMDD-HHMM-handover.md`

**Handover includes:**
- ✅ Validator implementation status (all checks complete)
- ✅ Test coverage report
- ✅ Historical WO validation results
- ✅ Next session entry point: Phase 2b (integration into orchestrator)

---

## Session V115: Phase 2b - Tier 3 Validator Integration

**Status:** Planned
**Duration:** 6 hours
**Token Budget:** 55k (start: ~20k → target: 75k)

### Entry Criteria

**Read at session start:**
- `docs/session_updates/session-v114-*-handover.md`
- `docs/WO_Scope_Validation_Implementation_Plan.md` (this document, V115 section)
- `src/lib/completeness-validator.ts` (from V114)
- `src/lib/orchestrator/aider-executor.ts` (integration target)

**Prerequisites:**
- ✅ V114 exit criteria met
- ✅ Tier 3 Validator fully implemented and tested
- ✅ Shadow mode still running (1-week data collection)

### Objectives

1. **Integrate validator into refinement loop** (aider-executor.ts)
2. **Implement feedback generation** (convert issues to proposer feedback)
3. **Test on 10 WOs** (3 low, 4 mid, 3 high complexity)
4. **Measure effectiveness** (test generation rate, score improvement, cost)
5. **Analyze shadow mode data** (1 week of complexity scans)

### Task List

#### Task 1: Read Integration Target (30 min, ~8k tokens)

**Read file:**
```bash
src/lib/orchestrator/aider-executor.ts
```

**Identify integration points:**
- Where code is generated
- Where refinement loop occurs
- Where TS errors are checked
- How to inject validator before TS check

#### Task 2: Integrate Validator (2 hours, ~20k tokens)

**Add validator to refinement loop:**
```typescript
// In aider-executor.ts (after code generation, before TS check)

import { validateCompleteness } from '../completeness-validator';

// After Aider generates code...
const generatedFiles = await this.extractGeneratedFiles(aiderResult);

// NEW: Run completeness validation
console.log('\n🔍 Running completeness validation...');
const validationResult = await validateCompleteness(workOrder, generatedFiles);

if (!validationResult.passed) {
  console.log(`❌ Validation failed (score: ${validationResult.score}/100)`);

  // Build feedback for proposer
  const feedback = this.buildValidationFeedback(validationResult.issues);

  console.log('\n📝 Validation feedback:');
  console.log(feedback);

  // Increment refinement cycle
  currentCycle++;

  if (currentCycle < MAX_REFINEMENT_CYCLES) {
    console.log(`\n🔄 Refinement cycle ${currentCycle}/${MAX_REFINEMENT_CYCLES}`);

    // Pass validation feedback back to proposer
    return await this.refineWithFeedback(workOrder, feedback, currentCycle);
  } else {
    console.log('\n⚠️  Max refinement cycles reached - proceeding with warnings');
    // Continue to TS check despite validation failures
  }
}

console.log('✅ Completeness validation passed\n');

// Continue to TypeScript check...
```

**Implement feedback builder:**
```typescript
private buildValidationFeedback(issues: ValidationIssue[]): string {
  const groupedByType = issues.reduce((acc, issue) => {
    if (!acc[issue.type]) acc[issue.type] = [];
    acc[issue.type].push(issue);
    return acc;
  }, {} as Record<string, ValidationIssue[]>);

  let feedback = 'Code validation found issues that must be fixed:\n\n';

  for (const [type, issueList] of Object.entries(groupedByType)) {
    const errorCount = issueList.filter(i => i.severity === 'error').length;
    const warningCount = issueList.filter(i => i.severity === 'warning').length;

    feedback += `**${type.toUpperCase()}** (${errorCount} errors, ${warningCount} warnings):\n`;

    for (const issue of issueList.slice(0, 5)) { // Top 5 per type
      feedback += `- ${issue.file}:${issue.line || '?'}: ${issue.description}\n`;
      feedback += `  Suggestion: ${issue.suggestion}\n`;
    }

    if (issueList.length > 5) {
      feedback += `  ... and ${issueList.length - 5} more\n`;
    }

    feedback += '\n';
  }

  return feedback;
}
```

**Exit criteria:**
- Integration compiles without errors
- Validator runs before TS check
- Feedback is passed back to proposer on failure

#### Task 3: Test on 10 WOs (2 hours, ~15k tokens)

**Select test WOs:**
```bash
powershell.exe -File scripts/run-with-env.ps1 scripts/select-tier3-test-wos.ts
```

**Criteria:**
- 3 low complexity (<0.50)
- 4 mid complexity (0.50-0.70)
- 3 high complexity (>0.70)
- Mix of types (UI, state, testing, utilities)

**Execute and monitor:**
```bash
# Approve 10 WOs
powershell.exe -File scripts/run-with-env.ps1 scripts/approve-tier3-test-wos.ts

# Monitor execution
npm run orchestrator:daemon

# Track results
powershell.exe -File scripts/run-with-env.ps1 scripts/monitor-tier3-test-execution.ts
```

**Collect metrics:**
- Test generation success rate (target: >80%)
- Overall acceptance scores (target: 75-85/100 on mid)
- Refinement cycles triggered by validator
- Cost per WO (measure overhead)

**Exit criteria:**
- 10 WOs executed (or failed with documentation)
- Results saved to `evidence/v115/tier3-test-results.json`

#### Task 4: Analyze Results (1 hour, ~8k tokens)

**Create analysis script:**
```bash
scripts/analyze-tier3-effectiveness.ts
```

**Output:**
```
Tier 3 Validator Effectiveness Analysis:

Test Generation Success Rate:
  Before (v110 baseline): 0/10 (0%)
  After (with validator):  9/10 (90%) ✅ +90%

Acceptance Scores by Complexity:
                          Baseline    With Validator   Improvement
  Low (<0.50):           78/100      82/100           +4
  Mid (0.50-0.70):       58/100      79/100           +21 ✅
  High (>0.70):          44/100      68/100           +24 ✅

Cost Impact:
  Refinement cycles triggered: 7/10 WOs
  Additional cost per WO: $0.08 (avg)
  Total cost increase: +40%

Issue Detection:
  Missing tests detected: 8/10 WOs
  Placeholders detected: 4/10 WOs
  Broken imports detected: 2/10 WOs
  Missing error handling: 6/10 WOs

DECISION: ✅ Validator effective - meets 75/100 target on mid complexity
RECOMMENDATION: Deploy to production, monitor for 1 week
```

**Decision gate:**
- **SUCCESS** if mid-complexity scores 75+/100
- **PARTIAL SUCCESS** if 70-75/100 (needs tuning)
- **FAILURE** if <70/100 (re-evaluate approach)

#### Task 5: Analyze Shadow Mode Data (30 min, ~4k tokens)

**Query shadow mode logs (1 week of data):**
```typescript
const { data } = await supabase
  .from('complexity_scan_logs')
  .select('*')
  .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  .order('timestamp', { ascending: false });

// Analyze trends
const avgProblematicPercent = mean(data.map(d => d.problematic_percent));
const totalDecompositions = data.length;
const totalWOs = sum(data.map(d => d.total_wos));

console.log(`Shadow Mode Results (7 days):`);
console.log(`  Decompositions: ${totalDecompositions}`);
console.log(`  Total WOs: ${totalWOs}`);
console.log(`  Avg problematic: ${(avgProblematicPercent * 100).toFixed(1)}%`);
```

**Exit criteria:**
- Shadow mode data analyzed
- Trends documented in handover
- Decision on Phase 3 (refinement) based on data

### Session V115 Exit Criteria

**Must complete before handover:**
- ✅ Validator integrated into orchestrator
- ✅ 10 WO test complete
- ✅ Effectiveness analysis complete
- ✅ Shadow mode data analyzed (1 week)

**Success criteria met?**
- ✅ Test generation >80% success rate
- ✅ Mid-complexity scores 75+/100
- ✅ Cost increase <50% per WO

**Token checkpoint:** ~75k/200k used (safe handover zone)

**Handover document:** `docs/session_updates/session-v115-YYYYMMDD-HHMM-handover.md`

**Handover includes:**
- ✅ Tier 3 Validator effectiveness results
- ✅ Decision gate outcome (Phase 3 needed?)
- ✅ Shadow mode 1-week analysis
- ✅ Next session entry point: Phase 3 (if scores <80) or production deployment

---

## Session V116: Phase 3 - Selective Refinement (OPTIONAL)

**Status:** Conditional (only if V115 scores <80/100)
**Duration:** 8 hours
**Token Budget:** 60k (start: ~20k → target: 80k)

### Entry Criteria

**Prerequisites:**
- ✅ V115 exit criteria met
- ✅ Decision to proceed with Phase 3 (scores 70-80/100, not reaching 85/100 target)
- ✅ Shadow mode shows >50% oversized WOs

**Skip Phase 3 if:**
- ❌ V115 scores already 80+/100 (validator sufficient)
- ❌ Shadow mode shows <30% oversized WOs (not worth complexity)

### Objectives

1. **Implement PR body truncation** (prevent Claude >65K issue)
2. **Implement selective refinement** (WO splitting logic)
3. **Implement quality gates** (validate refinement didn't worsen)
4. **Implement circuit breaker** (prevent cascading failures)
5. **Test on 5 oversized WOs**

### Task List

*(Detailed task breakdown similar to V113-V115, ~60k tokens total)*

**Summary tasks:**
1. PR body truncation (1h)
2. Refinement prompt builder (2h)
3. Quality gates implementation (2h)
4. Circuit breaker implementation (1h)
5. Testing on 5 oversized WOs (2h)

### Session V116 Exit Criteria

**Must complete before handover:**
- ✅ All Phase 3 components implemented
- ✅ 5 oversized WOs tested with refinement
- ✅ Quality gates validated (no worse outcomes)
- ✅ Circuit breaker tested

**Success criteria:**
- ✅ Refinement improves scores by +5-10 pts
- ✅ No regressions (quality gates work)
- ✅ Cost increase justified by quality gains

---

## Emergency Procedures

### Context Overflow (>180k tokens)

**If tokens reach 180k during implementation:**

1. **STOP immediately** - Save current work
2. **Commit partial changes** to feature branch
3. **Document stopping point** in emergency handover
4. **Create minimal handover** (<5k tokens):
   - What was completed
   - What was in progress (incomplete)
   - Exact line/function where stopped
   - How to resume (next steps)

**Emergency handover template:**
```markdown
# Emergency Handover - Session VXX

**Status:** INCOMPLETE (context overflow at 180k)

## Completed
- Task 1: [Description] ✅
- Task 2: [Description] ✅

## In Progress (INCOMPLETE)
- Task 3: [Description] - Stopped at line 245 in file X
  - Next: Complete Y, then test Z

## Files Modified (uncommitted)
- src/lib/file1.ts (lines 100-250)
- src/lib/file2.ts (lines 50-75)

## Resume Instructions
1. Read file X (starting context: ~20k)
2. Complete function Y (lines 245-280)
3. Add tests for Y
4. Commit and proceed to Task 4

**Branch:** feature/wo-scope-validation-phaseX
**Commit hash:** abc123 (last safe commit)
```

### Task Blocking Issues

**If blocked by external dependency:**

1. **Document blocker** clearly
2. **Skip to next independent task** (if possible)
3. **Create ticket** for blocker resolution
4. **Handover** with blocker flagged

**Example:**
```markdown
## Blockers
- Task 3 blocked: Database migration requires DBA approval
  - Workaround: Mock database layer for testing
  - Resolution: Court to approve migration
  - ETA: 1-2 days
```

### Test Failures

**If tests fail unexpectedly:**

1. **Document failure** (error messages, stack traces)
2. **Isolate failure** (which test, which scenario)
3. **Attempt quick fix** (if <15 min)
4. **Otherwise:** Revert changes, handover with investigation needed

---

## Success Tracking

### Overall Project Success Criteria

**Phase 1 (Shadow Mode):**
- ✅ Formula accuracy >85%
- ✅ False positive rate <15%
- ✅ False negative rate <10%

**Phase 2 (Tier 3 Validator):**
- ✅ Test generation success rate >80%
- ✅ Mid-complexity scores 75-85/100
- ✅ Cost increase <50% per WO

**Phase 3 (Refinement - if implemented):**
- ✅ Refinement success rate >70%
- ✅ Additional +5-10 points score improvement
- ✅ No quality regressions

**Overall System (all phases combined):**
- ✅ Mid-complexity: 75-85/100 (vs 58/100 baseline)
- ✅ High-complexity: 70-80/100 (vs 44/100 baseline)
- ✅ Test generation: >80% (vs 0% baseline)
- ✅ Total cost: flat or decreased (despite overhead)

### Progress Dashboard

**Update after each session:**

| Phase | Status | Completion | Success Criteria | Notes |
|-------|--------|------------|------------------|-------|
| **Single-Batch Test** | ⬜ Not Started | 0% | Correlation r < -0.80 | Session V112 |
| **Phase 1: Shadow Mode** | ⬜ Not Started | 0% | Deployed, 1 week data | Session V113 |
| **Phase 2a: Validator Core** | ⬜ Not Started | 0% | All checks implemented | Session V114 |
| **Phase 2b: Integration** | ⬜ Not Started | 0% | 10 WO test, scores 75+ | Session V115 |
| **Phase 3: Refinement** | ⬜ Not Started | 0% | Optional - TBD | Session V116 |

**Status Legend:**
- ⬜ Not Started
- 🔄 In Progress
- ✅ Complete
- ⚠️ Blocked
- ❌ Failed (needs rework)

---

## References

**Planning Documents:**
- This document: `docs/WO_Scope_Validation_Implementation_Plan.md`
- Analysis: `docs/WO_Scope_Validation_Analysis_And_Recommendations.md`
- Original proposal: `docs/Discussion - Decomposition Improvement(1).txt`

**Session Handovers:**
- Master: `docs/session_updates/SESSION_HANDOVER_MASTER.md`
- Quick Start: `docs/session_updates/SESSION_START_QUICK.md`
- Session V112: `docs/session_updates/session-v112-*-handover.md` (to be created)

**Evidence Folders:**
- V112: `docs/session_updates/evidence/v112/`
- V113: `docs/session_updates/evidence/v113/`
- V114: `docs/session_updates/evidence/v114/`
- V115: `docs/session_updates/evidence/v115/`
- V116: `docs/session_updates/evidence/v116/`

**Key Code Files:**
- `src/lib/wo-complexity-calculator.ts` (V112)
- `src/lib/wo-scope-validator.ts` (V112-V113)
- `src/lib/completeness-validator.ts` (V114)
- `src/lib/architect-service.ts` (integration point)
- `src/lib/orchestrator/aider-executor.ts` (integration point)

---

## Document Maintenance

**Update this document when:**
- Starting a new session (mark status, update progress dashboard)
- Completing a session (mark complete, document actual vs planned)
- Discovering new blockers or risks
- Changing approach or strategy

**Version History:**
- v1.0 (2025-10-22): Initial plan created (Session V112)

---

**END OF IMPLEMENTATION PLAN**

**Current Session:** V112
**Next Task:** Task 1 - Schema Validation (30 min, ~5k tokens)
**Estimated V112 Completion:** 177k/200k tokens
**Ready to begin:** ✅ YES
