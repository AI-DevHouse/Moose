# Session v61 Start Prompt

**Quick Context:** Moose Mission Control is 92% operational. Phase 2 (Learning System Foundation) is complete with 100% test coverage. We're ready to test the system with a **real application build** (Multi-LLM Discussion app) to validate everything works and collect production data.

---

## Your Mission

Build the Multi-LLM Discussion app from scratch using Moose Mission Control. This is the first real test of the complete system.

### What You Need to Do:

1. **Create a setup script** (`scripts/setup-real-project.ts`) that:
   - Creates project in Supabase
   - Creates local directory
   - Initializes git repo
   - Creates GitHub repo
   - Submits technical specification to Architect
   - Returns work order IDs

2. **Gather user input:**
   - Local directory path (where code should go)
   - GitHub org/username
   - GitHub repo name

3. **Run the setup script** to kick everything off

4. **Start the orchestrator daemon** to process work orders

5. **Monitor execution** and analyze results

---

## Key Files to Read First

**MUST READ (in order):**
1. `docs/session-v61-handover.md` - Complete context for this session
2. `docs/SOURCE_OF_TRUTH_Moose_Workflow.md` (v1.3) - System architecture
3. `src/lib/orchestrator/orchestrator-service.ts` - How execution works

**Reference as needed:**
4. `docs/DELIVERY_PLAN_To_Production.md` (v1.1) - Current progress
5. `docs/TECHNICAL_PLAN_Learning_System.md` - Phase 2 details
6. `scripts/orchestrator-daemon.ts` - Entry point

---

## Technical Specification for Multi-LLM Discussion App

```typescript
{
  feature_name: "Multi-LLM Discussion System",
  objectives: [
    "Enable multiple LLMs to participate in collaborative discussions",
    "Support Claude Sonnet, GPT-4, and other models",
    "Provide web interface for viewing discussions",
    "Store discussion history in database",
    "Allow users to create discussion topics",
    "Route messages to appropriate LLMs based on context"
  ],
  constraints: [
    "Must use Next.js 14 with App Router",
    "Must use TypeScript",
    "Must use Supabase for database",
    "Must use Tailwind CSS for styling",
    "Budget limit: $20",
    "Should follow modern React patterns"
  ],
  acceptance_criteria: [
    "Users can create a new discussion topic",
    "System routes messages to appropriate LLMs",
    "Multiple LLMs can respond to the same prompt",
    "Discussion history is persisted in Supabase",
    "Web UI displays discussions in real-time",
    "Users can view past discussions",
    "API endpoints for creating/reading discussions",
    "TypeScript types for all data structures",
    "Build succeeds with zero errors",
    "Basic error handling implemented"
  ],
  budget_estimate: 15,
  time_estimate: "2-3 hours"
}
```

---

## Step-by-Step Execution

### Step 1: Ask User for Project Details

Ask the user:
1. **Where should the code go?** (e.g., `C:\dev\multi-llm-discussion`)
2. **What's your GitHub org/username?** (e.g., "AI-DevHouse")
3. **What should the repo be called?** (e.g., "multi-llm-discussion")
4. **Confirm the tech spec above is acceptable**

### Step 2: Create Setup Script

**File:** `scripts/setup-real-project.ts`

**Purpose:** One script to rule them all. It should:

```typescript
// High-level pseudocode:
async function setupRealProject() {
  // 1. Get user input (from command line args or prompts)
  const localPath = process.argv[2] || promptUser("Local directory?");
  const githubOrg = process.argv[3] || promptUser("GitHub org?");
  const repoName = process.argv[4] || promptUser("Repo name?");

  // 2. Create local directory
  fs.mkdirSync(localPath, { recursive: true });

  // 3. Initialize git
  execSync('git init', { cwd: localPath });
  execSync('git checkout -b main', { cwd: localPath });

  // 4. Create GitHub repo
  const repoUrl = await createGitHubRepo(githubOrg, repoName);
  execSync(`git remote add origin ${repoUrl}`, { cwd: localPath });

  // 5. Create project in Supabase
  const projectId = await createProject({
    name: "Multi-LLM Discussion",
    local_path: localPath,
    github_org: githubOrg,
    github_repo_name: repoName,
    github_repo_url: repoUrl,
    status: 'active'
  });

  // 6. Submit tech spec to Architect
  const response = await fetch('http://localhost:3000/api/architect/decompose', {
    method: 'POST',
    body: JSON.stringify({
      project_id: projectId,
      technical_spec: TECH_SPEC // from above
    })
  });

  // 7. Display results
  console.log(`✅ Project created: ${projectId}`);
  console.log(`✅ Work orders created: ${response.work_orders_created}`);
  console.log(`✅ Ready for orchestrator!`);
}
```

**Reference existing scripts:**
- `scripts/create-test-workorder.ts` - How to create work orders
- `scripts/check-project.ts` - How to query projects
- Look at how other scripts use Supabase client

**Important:**
- Use `createSupabaseServiceClient()` from `src/lib/supabase.ts`
- Use `execSync` for git commands with `shell: true, windowsHide: true`
- Use `gh repo create` for GitHub repo creation
- Handle errors gracefully

### Step 3: Run Setup Script

```bash
powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/setup-real-project.ts "C:\dev\multi-llm-discussion" "AI-DevHouse" "multi-llm-discussion"
```

**Expected Output:**
```
✅ Local directory created: C:\dev\multi-llm-discussion
✅ Git initialized
✅ GitHub repo created: https://github.com/AI-DevHouse/multi-llm-discussion
✅ Project created in database: abc-123-def-456
✅ Technical spec submitted to Architect
✅ Work orders created: 8 total
   - WO-1: Setup Next.js project structure
   - WO-2: Create database schema
   ... (etc)
✅ Ready for orchestrator!

Run this to start:
powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/orchestrator-daemon.ts
```

### Step 4: Start Orchestrator

```bash
powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/orchestrator-daemon.ts
```

**What to watch for:**
- Work orders detected: `[WorkOrderPoller] Found X approved Work Orders`
- Execution starts: `[Orchestrator] Starting execution for WO abc-123`
- Manager routing: `[ManagerCoordinator] Routing decision: gpt-4o-mini`
- Code generation: `[ProposerExecutor] Code generated, cost: $X`
- Aider execution: `[AiderExecutor] Branch created: feature/wo-...`
- PR creation: `[GitHubIntegration] PR created: https://github.com/...`
- Completion: `[ResultTracker] Work order completed successfully`

**Expected timeline:**
- 3-5 minutes per work order
- 8 work orders total
- ~15-20 minutes wall time (3 concurrent)

### Step 5: Monitor & Troubleshoot

**Watch for failures:**
- Aider exit code errors → Check API keys, Python installation
- PR creation failures → Check `gh` authentication
- TypeScript errors → Should self-refine up to 3 cycles
- Contract violations → Tracked as failure_class='contract_violation'

**Query progress:**
```bash
# List all work orders
powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/list-work-orders.ts

# Check specific work order
powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/check-wo-status.ts <WO_ID>

# Check escalations
powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/check-latest-escalation.ts
```

### Step 6: Analyze Results

**After all work orders complete (or fail):**

1. **Query the Phase 2 data:**
```sql
-- Failure breakdown
SELECT failure_class, COUNT(*) as count, AVG(cost) as avg_cost
FROM outcome_vectors
WHERE created_at > NOW() - INTERVAL '1 day'
  AND failure_class IS NOT NULL
GROUP BY failure_class
ORDER BY count DESC;

-- Decision patterns
SELECT decision_type, decision_result, COUNT(*)
FROM decision_logs
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY decision_type, decision_result;

-- Success rate
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate
FROM work_orders
WHERE created_at > NOW() - INTERVAL '1 day';
```

2. **Check GitHub PRs:**
- Go to `https://github.com/{org}/{repo}/pulls`
- Review PR quality, descriptions, code changes
- Merge PRs if acceptable

3. **Test the app:**
```bash
cd C:\dev\multi-llm-discussion
npm install
npm run build  # Should succeed
npm run dev    # Test functionality
```

4. **Document findings:**
Create `docs/iteration-1-results.md` with:
- Success rate (%)
- Failure breakdown (by failure_class)
- Total cost
- Quality assessment
- Issues discovered
- Recommendations

---

## Success Criteria

**Minimum (60%):** 5+ work orders complete, app builds, basic functionality works
**Good (80%):** 7+ work orders complete, all features work, reviewable quality
**Excellent (90%):** All work orders complete, production-ready code, no issues

---

## Important Notes

### Phase 2 Infrastructure (Already Complete ✅)
- **Failure Classifier** - Automatically classifies 9 failure types
- **Decision Logger** - Logs all routing/refinement/escalation decisions
- **Enhanced Result Tracking** - 100% failure coverage with error_context
- All tested with 27/27 tests passing

### What This Test Validates
1. Full E2E pipeline with real complexity
2. Failure classification accuracy
3. Decision logging completeness
4. Self-refinement effectiveness
5. Cost efficiency
6. Code quality

### What Happens After
- If ≥60% success → Deploy or start Phase 3
- If <60% success → Fix issues, re-test
- Either way: Use collected data to inform Phase 3

---

## Environment Details

**Working Directory:** `C:\dev\moose-mission-control`

**Supabase:** `https://veofqiywppjsjqfqztft.supabase.co`

**Required Tools:**
- Node.js + npm ✅
- Python 3.11 ✅
- Aider (`py -3.11 -m aider`) ✅
- GitHub CLI (`gh`) ✅
- Git ✅

**Budget Caps:**
- Soft cap: $20/day (warning)
- Hard cap: $50/day (force cheapest model)
- Emergency kill: $100/day (stop all operations)

**Model Capacity:**
- Claude Sonnet 4.5: max 2 concurrent
- GPT-4o-mini: max 4 concurrent

---

## Quick Reference

**Start orchestrator:**
```bash
powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/orchestrator-daemon.ts
```

**Monitor work orders:**
```bash
powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/list-work-orders.ts
```

**Check status:**
```bash
powershell.exe -ExecutionPolicy Bypass -File scripts/run-with-env.ps1 scripts/check-wo-status.ts <WO_ID>
```

**Analyze results:**
Run queries in Supabase SQL Editor or create analysis script.

---

**TL;DR for next session:**
1. Read `docs/session-v61-handover.md` for full context
2. Ask user for: local path, GitHub org, repo name
3. Create `scripts/setup-real-project.ts` to automate setup
4. Run setup script
5. Start orchestrator daemon
6. Monitor execution (~20 minutes)
7. Analyze results and document findings

**Status:** Ready to build real app ✅
