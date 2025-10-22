# Test Redirection Assessment - moose-mission-control vs multi-llm-discussion-v1

**Date:** 2025-10-22
**Question:** What needs to change to test WOs on moose-mission-control instead of multi-llm-discussion-v1?

---

## Current Configuration

### Projects in Database

**multi-llm-discussion-v1:**
- Project ID: `f73e8c9f-1d78-4251-8fb6-a070fd857951`
- Local Path: `C:\dev\multi-llm-discussion-v1`
- Git Remote: `https://github.com/AI-DevHouse/multi-llm-discussion-v1.git`
- Status: Empty greenfield project (no src/)
- All 49 existing WOs target this project

**moose-mission-control:**
- Project ID: `06b35034-c877-49c7-b374-787d9415ea73`
- Local Path: `C:\dev\moose-mission-control`
- Git Remote: `https://github.com/AI-DevHouse/Moose.git`
- Status: Established project (50+ files in src/)
- GitHub org/repo in DB: undefined (not configured)

---

## What Would Need to Change

### Option A: Create New WOs for moose-mission-control (Recommended)

**Required Steps:**

1. **Update moose-mission-control project record in DB:**
   ```sql
   UPDATE projects
   SET
     github_org = 'AI-DevHouse',
     github_repo_name = 'Moose',
     github_repo_url = 'https://github.com/AI-DevHouse/Moose.git'
   WHERE id = '06b35034-c877-49c7-b374-787d9415ea73';
   ```

2. **Create 3 new work orders:**
   ```typescript
   // Each WO needs:
   {
     project_id: '06b35034-c877-49c7-b374-787d9415ea73', // moose project
     title: "Add project maturity detector",
     description: "Create src/lib/orchestrator/project-inspector.ts...",
     acceptance_criteria: [...],
     files_in_scope: ["src/lib/orchestrator/project-inspector.ts"],
     status: "pending",
     ...
   }
   ```

3. **Approve new WOs for execution**

4. **Orchestrator will:**
   - Read project_id → fetch moose-mission-control project
   - Use local_path: `C:\dev\moose-mission-control`
   - Create feature branch in moose-mission-control repo
   - Generate code via proposer
   - Push to GitHub → create PR in `AI-DevHouse/Moose`

**Advantages:**
- No changes to existing WOs or configuration
- Clean separation of test vs production WOs
- Can run in parallel with existing multi-llm WOs
- PRs created in correct repo (AI-DevHouse/Moose)

**Disadvantages:**
- Need to manually create 3 WOs
- Need to update project GitHub config in DB

---

### Option B: Reassign Existing WOs (NOT Recommended)

**Required Steps:**

1. Update GitHub config (same as Option A)

2. **Reassign 3 existing pending WOs:**
   ```sql
   UPDATE work_orders
   SET project_id = '06b35034-c877-49c7-b374-787d9415ea73'
   WHERE id IN (
     '92a9c7c1-...', -- Validation and Testing Suite
     'a7bb6c49-...', -- Parser Recognition Logic
     '0170420d-...'  -- Configure Redux Toolkit Store
   );
   ```

**Advantages:**
- Reuses existing WOs
- No need to write new WO descriptions

**Disadvantages:**
- ❌ WOs designed for multi-llm project won't make sense for moose
  - e.g., "Configure Redux Toolkit Store" irrelevant to moose-mission-control
  - Files in scope wrong (src/renderer/* doesn't exist in moose)
- ❌ Confuses the test dataset
- ❌ May break multi-llm workflow if those WOs were needed

---

### Option C: Use Worktree Pool with Custom Project Path (Most Complex)

**Required Steps:**

1. Update project GitHub config
2. Modify orchestrator to override project path for specific WOs
3. Create new WOs but with metadata flag for "test_project_override"

**Not recommended** - adds complexity without benefit.

---

## Recommendation: Option A

**Create 3 NEW work orders for moose-mission-control with appropriate scope:**

### Proposed Test WOs

**WO-1: Create Project Maturity Detector (0.60 complexity)**
```typescript
{
  project_id: '06b35034-c877-49c7-b374-787d9415ea73',
  title: "Create project maturity detection utility",
  description: `
    Create a utility to detect if a project is greenfield or established.

    Scan the target project directory and analyze:
    - Existence of src/ directory
    - Number of TypeScript files
    - package.json dependencies count
    - tsconfig.json presence and configuration

    Return structured metadata about project maturity.
  `,
  acceptance_criteria: [
    "Function assessProjectMaturity(projectPath) returns ProjectMaturity object",
    "Detects is_greenfield boolean correctly",
    "Counts existing files and dependencies",
    "Includes TypeScript types for return value"
  ],
  files_in_scope: [
    "src/lib/orchestrator/project-inspector.ts"
  ],
  risk_level: "low",
  status: "pending"
}
```

**WO-2: Create Bootstrap WO Generator (0.65 complexity)**
```typescript
{
  project_id: '06b35034-c877-49c7-b374-787d9415ea73',
  title: "Create bootstrap work order generator",
  description: `
    Create a utility to generate infrastructure bootstrap work orders.

    Given a technical spec and project maturity assessment:
    - Infer required dependencies from spec
    - Infer TypeScript config needs (JSX, paths, etc.)
    - Generate a work order that creates package.json, tsconfig.json, src/ structure

    Return a complete WorkOrder object ready for database insertion.
  `,
  acceptance_criteria: [
    "Function generateBootstrapWO(spec, maturity) returns WorkOrder",
    "Infers dependencies from spec content",
    "Generates appropriate tsconfig.json requirements",
    "Includes TypeScript types"
  ],
  files_in_scope: [
    "src/lib/bootstrap-wo-generator.ts"
  ],
  risk_level: "low",
  status: "pending"
}
```

**WO-3: Add Build Validation Utility (0.55 complexity)**
```typescript
{
  project_id: '06b35034-c877-49c7-b374-787d9415ea73',
  title: "Create TypeScript build validation utility",
  description: `
    Create a utility to validate TypeScript compilation succeeds.

    Execute 'npx tsc --noEmit' in the target project and:
    - Capture build output
    - Parse TypeScript errors
    - Classify errors by type (import, type, config)
    - Return structured validation result
  `,
  acceptance_criteria: [
    "Function validateBuild(projectPath) returns BuildValidation object",
    "Executes TypeScript compiler correctly",
    "Parses and categorizes errors",
    "Includes TypeScript types"
  ],
  files_in_scope: [
    "src/lib/build-validator.ts"
  ],
  risk_level: "low",
  status: "pending"
}
```

---

## What Changes Are Needed

### Database Updates Required

**1. Update moose-mission-control project GitHub config:**
```sql
UPDATE projects
SET
  github_org = 'AI-DevHouse',
  github_repo_name = 'Moose',
  github_repo_url = 'https://github.com/AI-DevHouse/Moose.git'
WHERE id = '06b35034-c877-49c7-b374-787d9415ea73';
```

**2. Insert 3 new work orders** (see SQL examples in next section)

### No Code Changes Required

✅ **Orchestrator already supports multiple projects**
- Reads `project_id` from work order
- Fetches project record from database
- Uses `local_path` and `github_repo_name` from project

✅ **GitHub integration already handles different repos**
- Reads `github_org` and `github_repo_name` from project
- Constructs repo path: `${github_org}/${github_repo_name}`
- Creates PR in correct repository

✅ **Proposer already scans project dependencies**
- Reads package.json from `local_path`
- Scans src/ directories from `local_path`
- Context is project-specific

---

## Execution Plan

**Phase 1: Setup (5 minutes)**
1. Create script to update moose project GitHub config
2. Create script to insert 3 test WOs
3. Verify WOs appear in database with correct project_id

**Phase 2: Execute (10-15 minutes)**
1. Approve 3 test WOs: `scripts/set-status-approved.ts <wo-id>`
2. Monitor orchestrator daemon (should already be running)
3. Wait for 3 PRs to be created in AI-DevHouse/Moose

**Phase 3: Analyze (5 minutes)**
1. Check PR #s in AI-DevHouse/Moose
2. For each PR, run: `cd C:/dev/moose-mission-control && npx tsc --noEmit`
3. Count build errors
4. Compare to multi-llm-discussion-v1 error rates

**Phase 4: Cleanup (2 minutes)**
1. Close 3 test PRs (don't merge)
2. Delete feature branches
3. Update WO status to "archived" or "test_completed"

---

## Risk Assessment

### Low Risk
- ✅ No code changes to orchestrator
- ✅ No risk to existing multi-llm WOs
- ✅ PRs created in separate repo (Moose, not multi-llm-discussion-v1)
- ✅ Can easily close PRs and revert if needed

### Potential Issues
- ⚠️ If proposer fails, may create broken code in moose repo
  - Mitigation: Review PRs before merging (standard practice)
- ⚠️ Test WOs create real files in moose-mission-control
  - Mitigation: Choose useful utilities (project-inspector, etc.) that we want anyway
- ⚠️ GitHub rate limits if many PRs created
  - Mitigation: Only 3 PRs, well within limits

---

## Decision Gate

**Proceed with Option A if:**
1. User approves creating test WOs in AI-DevHouse/Moose repo
2. User approves test utilities as actual features (project-inspector, bootstrap-generator, build-validator)
3. User wants to validate greenfield hypothesis before implementing fixes

**Alternative: Skip test, implement Option A fix directly**
- Rationale: Evidence already strong that greenfield is the issue
- Skip validation step, go straight to bootstrap WO implementation

---

**Assessment Complete - Ready to proceed with Option A or recommend skip to fix implementation**
