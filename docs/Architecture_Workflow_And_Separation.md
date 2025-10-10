# Moose Mission Control - Architecture, Workflow & Project Separation

**Document Version:** 2.0
**Last Updated:** 2025-10-09
**Status:** Priority 1 E2E Testing in Progress

---

## ⚠️ CRITICAL: Full Vision vs Current Implementation

**This document describes TWO architectures:**

1. **Full Moose Vision** - 7-agent autonomous development system (partially implemented)
2. **Current Implementation** - Simplified pipeline being tested (Priority 1)

The Priority 1 E2E test validates a **subset** of the full vision: Manager → Proposers → Orchestrator/Aider → GitHub PR.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Full Moose Vision: 7-Agent System](#full-moose-vision-7-agent-system)
3. [Current Implementation Status](#current-implementation-status)
4. [The Core Workflow](#the-core-workflow)
5. [Project Separation Architecture](#project-separation-architecture)
6. [Component Deep Dive](#component-deep-dive)
7. [Testing Strategy](#testing-strategy)
8. [Current Test Scenario](#current-test-scenario)

---

## Executive Summary

**Moose Mission Control** is a multi-LLM orchestration system that manages software development work across multiple target applications. It's a **meta-development system** - a tool that develops other applications.

### Key Concepts

- **Moose Mission Control**: The orchestrator system itself (this codebase)
- **Target Applications**: Separate applications that Moose develops (stored as Projects)
- **Work Orders**: Development tasks for target applications
- **Hybrid Architecture**: Cloud metadata (Supabase) + Local execution + Cloud dashboard (Vercel)

### Implementation Reality

**Current State (v58):** Testing simplified pipeline (Manager → Proposers → Aider → GitHub PR)

**Full Vision:** 7-agent autonomous system with decomposition, governance, validation, and learning

---

## Full Moose Vision: 7-Agent System

### The Complete Autonomous Development Pipeline

The full Moose architecture envisions **7 specialized AI agents** working together to autonomously execute 85-95% of software development tasks:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 🏗️ ARCHITECT                                             │
│    Strategic Decomposition Agent                            │
│    • Analyzes technical specifications                      │
│    • Decomposes into 3-8 executable work orders            │
│    • Maps dependencies and estimates budgets               │
│    Status: ❌ NOT IMPLEMENTED (humans create work orders)   │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. ⚖️ DIRECTOR                                               │
│    Senior Governance Agent                                   │
│    • Validates against contracts                            │
│    • Assesses risk (low/medium/high)                        │
│    • Auto-approves trusted patterns (confidence >0.95)      │
│    • Routes high-risk to human approval                     │
│    Status: ✅ PARTIAL (implemented as "Manager LLM")        │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. 🎯 MANAGER                                                │
│    Tactical Coordination Agent                               │
│    • Routes work orders to appropriate LLM                  │
│    • Enforces budget constraints (3-tier system)            │
│    • Manages retry strategies                               │
│    • Tracks performance metrics                             │
│    Status: ✅ IMPLEMENTED (manager-routing-rules.ts)        │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. 💻 PROPOSERS (Model Registry)                            │
│    Code Generation Agents                                    │
│    • Claude Sonnet 4.5 (high complexity)                    │
│    • GPT-4o-mini (low complexity)                           │
│    • Generates complete, deployable code                    │
│    • Self-refinement on errors (planned)                    │
│    Status: ✅ IMPLEMENTED (enhanced-proposer-service.ts)    │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. 🔧 ORCHESTRATOR (Infrastructure)                         │
│    Aider-based Execution Infrastructure                      │
│    • Spins up ephemeral Aider containers                    │
│    • Applies code via git-aware editing                     │
│    • Creates branches and PRs                               │
│    • Triggers GitHub Actions                                │
│    Status: 🚧 IN TESTING (Priority 1 E2E test)             │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. 🛡️ SENTINEL                                              │
│    Adaptive Quality Gates Agent                             │
│    • Parses GitHub Actions results                          │
│    • Learns false-positive patterns                         │
│    • Adjusts thresholds adaptively                          │
│    • Escalates hard failures                                │
│    Status: ❌ NOT IMPLEMENTED (manual test review)          │
└────────────────────────┬────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. 🤝 CLIENT MANAGER                                         │
│    Human Interface Agent                                     │
│    • Monitors all agent execution states                    │
│    • Detects unresolvable issues                            │
│    • Formulates 2-4 resolution options                      │
│    • Generates recommendations                              │
│    • Executes human decisions                               │
│    Status: ❌ NOT IMPLEMENTED (manual escalation handling)  │
└─────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Specialist Job Descriptions** - Each agent has clear, non-overlapping responsibilities
2. **Progressive Autonomy** - Director auto-approves trusted patterns, escalates edge cases
3. **Learning Loops** - All agents feed patterns to shared memory
4. **Budget Enforcement** - 3-tier system ($20 soft / $50 hard / $100 emergency)
5. **Hard Stop Override** - Security/architecture keywords force best model regardless of budget
6. **Human-in-the-Loop** - Client Manager provides options, never makes final decisions
7. **Live Feedback** - Aider queries actual environment state
8. **Adaptive Quality** - Sentinel learns false positives over time

---

## Current Implementation Status

### What's Working (v58)

| Component | Status | File/Service |
|-----------|--------|--------------|
| **Manager (Routing)** | ✅ Full | `src/lib/manager-coordinator.ts` |
| **Proposers** | ✅ Full | `src/lib/enhanced-proposer-service.ts` |
| **Budget Tracking** | ✅ Full | `src/lib/cost-tracker.ts` |
| **Project Validator** | ✅ Full | `src/lib/project-validator.ts` |
| **GitHub Integration** | ✅ Full | `src/lib/orchestrator/github-integration.ts` |
| **Error Escalation** | ✅ Full | `src/lib/error-escalation.ts` |
| **Orchestrator Daemon** | 🚧 Testing | `scripts/orchestrator-daemon.ts` |
| **Aider Executor** | 🚧 Testing | `src/lib/orchestrator/aider-executor.ts` |

### What's Not Implemented

| Component | Status | Impact |
|-----------|--------|--------|
| **Architect Agent** | ❌ Not Started | Humans manually create work orders |
| **Director Agent** | ⚠️ Partial | Approval logic exists but needs enhancement |
| **Sentinel Agent** | ❌ Not Started | Manual review of GitHub Actions results |
| **Client Manager** | ❌ Not Started | Manual escalation handling via dashboard |
| **Aider Containers** | ❌ Not Started | Running Aider directly on dev machine |
| **Self-Refinement** | ❌ Not Started | Proposers don't retry on errors automatically |
| **Parallel Mode** | ❌ Not Started | Can't run multiple LLMs competitively |

### Priority 1 Test Scope

**What we're testing NOW:**

1. ✅ Work order polling from Supabase
2. ✅ Manager routing decision (complexity-based)
3. ✅ Proposer code generation
4. 🚧 Aider execution (git branch creation, code application)
5. 🚧 GitHub PR creation
6. ⏳ Status tracking in Supabase

**What we're NOT testing (yet):**

- Architect decomposition (human creates work order)
- Director approval (work order has `auto_approved: true`)
- Sentinel validation (no automated test analysis)
- Client Manager escalation (errors logged, but no options generated)

---

## The Core Workflow

### Current Implementation Pipeline (What's Being Tested)

**Note:** This describes the CURRENT implementation being tested in Priority 1. See "Full Moose Vision" section above for the complete 7-agent architecture.

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. WORK ORDER CREATION (Manual - Architect not implemented)    │
│    - User manually creates work order in Supabase              │
│    - Specifies target project, description, acceptance criteria │
│    - Sets auto_approved flag (Director auto-approval)           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. ORCHESTRATOR DAEMON (Local Machine)                         │
│    Command: npm run orchestrator                                │
│    - Polls Supabase every 10 seconds                            │
│    - Finds work orders with status="pending" + auto_approved    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. PROJECT VALIDATION                                           │
│    - Loads project from Supabase (by project_id)                │
│    - Validates local directory exists                           │
│    - Checks git is initialized                                  │
│    - Verifies GitHub remote configuration                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. ROUTING DECISION (Manager Agent)                            │
│    - Analyzes work order complexity                             │
│    - Selects appropriate LLM (GPT-4o-mini, Claude Sonnet 4.5)  │
│    - Determines if hard stop required                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. CODE GENERATION (Proposer Agent)                            │
│    - Executes selected LLM                                      │
│    - Generates code implementation                              │
│    - Tracks cost and token usage                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. AIDER EXECUTION (Local Git Operations)                      │
│    - Creates feature branch: feature/wo-<id>-<slug>            │
│    - Applies code changes to target project files              │
│    - Commits changes to git                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. GITHUB PR CREATION                                           │
│    - Pushes feature branch to GitHub                            │
│    - Creates Pull Request via gh CLI                            │
│    - Includes work order metadata in PR body                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. RESULT TRACKING (Supabase)                                  │
│    - Updates work order status to "completed"                   │
│    - Records cost in cost_tracking table                        │
│    - Stores execution time and metadata                         │
└─────────────────────────────────────────────────────────────────┘
```

### Error Handling

If any step fails:
1. **Error Escalation System** triggers
2. Creates escalation record in Supabase
3. Provides resolution options (retry, manual intervention, skip)
4. Rolls back git changes (deletes feature branch)
5. Updates work order status to "failed"

---

## Project Separation Architecture

### The Three Layers

Moose Mission Control operates across three distinct layers:

#### Layer 1: Moose Mission Control (The Orchestrator)

**What it is:** The orchestration system itself - this codebase.

**Local Development:**
- **Directory:** `C:\dev\moose-mission-control`
- **Git Repository:** AI-DevHouse/Moose (development repo)
- **Purpose:** Development of the orchestrator system

**Cloud Infrastructure:**
- **Vercel Project:** moose-indol (Dashboard UI)
  - **URL:** https://moose-indol.vercel.app
  - **Purpose:** Monitor work orders, view costs, manage projects
  - **Deployment:** Serverless Next.js app

- **Supabase Project:** veofqiywppjsjqfqztft
  - **URL:** https://veofqiywppjsjqfqztft.supabase.co
  - **Purpose:** Centralized metadata storage
  - **Tables:**
    - `projects` - Target applications being developed
    - `work_orders` - Development tasks
    - `cost_tracking` - LLM API costs
    - `escalations` - Error tracking
    - `decision_logs` - Audit trail

**Key Files:**
```
src/
├── lib/
│   ├── orchestrator/
│   │   ├── orchestrator-service.ts    # Main execution pipeline
│   │   ├── work-order-poller.ts       # Supabase polling
│   │   ├── aider-executor.ts          # Git operations
│   │   └── github-integration.ts      # PR creation
│   ├── manager-coordinator.ts         # LLM routing
│   └── enhanced-proposer-service.ts   # Code generation
└── app/
    └── api/                            # Next.js API routes
```

#### Layer 2: Target Applications (Being Developed)

**What they are:** Separate software projects that Moose develops.

**Storage in Supabase:**
```sql
-- projects table
{
  id: "06b35034-c877-49c7-b374-787d9415ea73",
  name: "my-saas-app",
  local_path: "C:\\dev\\my-saas-app",
  github_org: "MyCompany",
  github_repo_name: "my-saas-app",
  github_repo_url: "https://github.com/MyCompany/my-saas-app.git",
  status: "active"
}
```

**Local File System:**
- Each target app has its **own separate directory**
- Example: `C:\dev\my-saas-app` (NOT inside moose-mission-control)
- Moose orchestrator reads `local_path` from Supabase
- Changes directory to target app during execution

**GitHub Separation:**
- Each target app has its **own GitHub repository**
- Example: `MyCompany/my-saas-app`
- Moose creates PRs in the target app's repo
- Format: `gh pr create --repo MyCompany/my-saas-app`

**Vercel Separation:**
- Each target app can have its **own Vercel project**
- Tracked in `projects.vercel_team_id` (optional)
- Target app deploys independently from Moose dashboard

**Supabase Separation:**
- Each target app can have its **own Supabase project** (optional)
- Tracked in `projects.supabase_project_url` (optional)
- Separate from Moose's Supabase (veofqiywppjsjqfqztft)

### Separation Summary Table

| Aspect | Moose Mission Control | Target Application |
|--------|----------------------|-------------------|
| **Local Path** | `C:\dev\moose-mission-control` | `C:\dev\<app-name>` |
| **GitHub Repo** | `AI-DevHouse/Moose` | `<org>/<repo-name>` |
| **Vercel Project** | `moose-indol` (dashboard) | `<app-vercel-project>` (optional) |
| **Supabase Project** | `veofqiywppjsjqfqztft` (metadata) | `<app-supabase>` (optional) |
| **Purpose** | Orchestrate development | Be developed |
| **PRs Created** | Manual development | Automated by Moose |

---

## Component Deep Dive

### 1. Orchestrator Daemon

**Entry Point:** `scripts/orchestrator-daemon.ts`

**Responsibilities:**
- Poll Supabase for approved work orders
- Execute work orders through pipeline
- Track execution state (singleton pattern)
- Emit progress events (for SSE monitoring)

**Running:**
```bash
npm run orchestrator
```

**Key Features:**
- **Polling Interval:** 10 seconds
- **Max Concurrent:** 3 work orders
- **Capacity Management:** Per-model rate limiting
  - Claude Sonnet 4.5: max 2 concurrent
  - GPT-4o-mini: max 4 concurrent

### 2. Work Order Poller

**File:** `src/lib/orchestrator/work-order-poller.ts`

**SQL Query:**
```sql
SELECT * FROM work_orders
WHERE status = 'pending'
  AND metadata->>'auto_approved' = 'true'
  -- Dependency check (if dependencies exist, all must be completed)
ORDER BY created_at ASC
```

**Approval Mechanisms:**
1. **Auto-Approved:** `metadata.auto_approved = true`
2. **Manager Decision:** Stored in `decision_logs` table
3. **Manual Approval:** Set by user in dashboard

### 3. Project Validator

**File:** `src/lib/project-validator.ts`

**Validation Checks:**
1. ✅ Project exists in Supabase
2. ✅ Local directory exists at `project.local_path`
3. ✅ Git is initialized (`.git` directory exists)
4. ✅ GitHub remote configured (if `github_repo_name` set)
5. ✅ Remote URL matches database config
6. ✅ Project status is "active" (not failed/archived)
7. ⚠️ Clean working directory (optional)

### 4. Manager Coordinator (Routing)

**File:** `src/lib/manager-coordinator.ts`

**Complexity Scoring:**
```typescript
complexity = (
  (files_count * 0.4) +
  (risk_level_score * 0.3) +
  (has_acceptance_criteria * 0.3)
) / 3

// risk_level_score:
// low = 0.2, medium = 0.5, high = 0.8
```

**Routing Rules:**
- **Complexity < 0.3:** GPT-4o-mini ($0.15/1M input tokens)
- **Complexity ≥ 0.3:** Claude Sonnet 4.5 ($3/1M input tokens)
- **Hard Stop Required:** Escalate before execution

### 5. Aider Executor

**File:** `src/lib/orchestrator/aider-executor.ts`

**Branch Naming:**
```
feature/wo-<id-prefix>-<title-slug>

Example:
feature/wo-8f8335d7-add-test-comment-to-readme
```

**Git Operations:**
1. `git checkout -b <branch>` - Create feature branch
2. Execute Aider with proposed code
3. Aider commits changes automatically
4. `git push -u origin <branch>` - Push to remote

**Windows Compatibility Fix (v58):**
```typescript
execSync('git command', {
  cwd: projectPath,
  encoding: 'utf-8',
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: true,        // Required for Windows PATH resolution
  windowsHide: true   // Prevent command window flashes
})
```

### 6. GitHub Integration

**File:** `src/lib/orchestrator/github-integration.ts`

**PR Creation via gh CLI:**
```bash
gh pr create \
  --title "WO-<id>: <title>" \
  --body-file /tmp/pr-body.txt \
  --head feature/wo-<id>-<slug> \
  --repo <org>/<repo-name>
```

**PR Body Includes:**
- Work order ID and description
- Risk level and complexity score
- LLM used (proposer)
- Cost and token usage
- Acceptance criteria checklist
- Files modified
- Routing decision rationale
- Full metadata JSON

**Critical Fix (v58):**
Construct full repo path from separate fields:
```typescript
// Before (broken):
repoName = project.github_repo_name  // "Moose"

// After (working):
repoName = `${project.github_org}/${project.github_repo_name}`  // "AI-DevHouse/Moose"
```

### 7. Error Escalation System

**File:** `src/lib/error-escalation.ts`

**Escalation Triggers:**
- Git command failures
- LLM API errors
- Validation failures
- Aider execution errors
- PR creation failures

**Escalation Record:**
```typescript
{
  id: uuid,
  work_order_id: string,
  error_type: "validation" | "execution" | "api",
  severity: "low" | "medium" | "high" | "critical",
  error_message: string,
  resolution_options: [
    "retry_with_same_llm",
    "retry_with_different_llm",
    "manual_intervention",
    "skip_work_order"
  ],
  status: "open" | "resolved" | "ignored"
}
```

### 8. Cost Tracking

**File:** `src/lib/cost-tracker.ts`

**Tracks:**
- LLM API costs (input + output tokens)
- Execution time
- Proposer model used
- Work order ID
- Timestamp

**Monthly Budget Monitoring:**
- Query: `SUM(cost) WHERE timestamp > start_of_month`
- Alert threshold: $50/month (configurable)

---

## Testing Strategy

### Test Pyramid

```
                    ┌────────────────┐
                    │  E2E Testing   │ ← Current focus
                    │  (Full Pipe)   │
                    └────────────────┘
                  ┌──────────────────────┐
                  │  Integration Testing │
                  │  (Component pairs)   │
                  └──────────────────────┘
              ┌──────────────────────────────┐
              │     Unit Testing              │
              │  (Isolated components)        │
              └──────────────────────────────┘
```

### Priority 1: E2E Test (In Progress)

**Goal:** Validate complete work order execution from Supabase poll to GitHub PR.

**Test Components:**
1. ✅ Orchestrator daemon polls Supabase
2. ✅ Work order discovery (auto_approved flag)
3. ✅ Project validation (Windows git fix)
4. ✅ Manager routing decision
5. ✅ Proposer code generation
6. ✅ Feature branch creation (Windows git fix)
7. ⏳ Aider execution (encountering errors)
8. ⏳ GitHub PR creation (repo format fix applied, pending test)

**Status:** ~85% complete (PR creation fix pending verification)

### Test Scripts

**Location:** `scripts/`

```bash
# Setup
scripts/setup-test-workorder.ts        # Create test project + work order

# Monitoring
scripts/check-test-workorder.ts        # Check work order status
scripts/check-test-project.ts          # Check project configuration
scripts/list-work-orders.ts            # List all work orders
scripts/check-latest-escalation.ts     # Check latest error

# Management
scripts/reset-test-workorder.ts        # Reset to pending for retry
scripts/fix-test-workorder.ts          # Fix work order data

# Testing
scripts/test-branch-creation.ts        # Test git operations in isolation
scripts/test-git-command.ts            # Test git commands
scripts/orchestrator-daemon.ts         # Main orchestrator entry point
```

---

## Current Test Scenario

### Test Project Configuration

**Supabase Record:**
```json
{
  "id": "06b35034-c877-49c7-b374-787d9415ea73",
  "name": "moose-mission-control-test",
  "local_path": "C:\\dev\\moose-mission-control",
  "github_org": "AI-DevHouse",
  "github_repo_name": "Moose",
  "github_repo_url": "https://github.com/AI-DevHouse/Moose.git",
  "status": "active"
}
```

**Important Note:** This test uses Moose's own repository as the target. In production, target apps would be separate repositories in separate directories.

### Test Work Order

```json
{
  "id": "8f8335d7-ce95-479f-baba-cb1f000ca533",
  "title": "Add test comment to README",
  "description": "Add a comment to README.md to test the E2E pipeline",
  "project_id": "06b35034-c877-49c7-b374-787d9415ea73",
  "status": "pending",
  "risk_level": "low",
  "files_in_scope": ["README.md"],
  "acceptance_criteria": ["Comment added to README.md"],
  "metadata": {
    "auto_approved": true,
    "test_work_order": true,
    "retry_attempt": 2
  }
}
```

### Test Execution Flow

```
1. Reset work order to "pending"
   → npm run orchestrator

2. Orchestrator polls Supabase
   → Finds test work order

3. Validates project
   → C:\dev\moose-mission-control
   → Git remote: AI-DevHouse/Moose

4. Manager routes to GPT-4o-mini
   → Complexity: 0.225 (low)

5. Proposer generates code
   → Simple README comment

6. Aider creates branch
   → feature/wo-8f8335d7-add-test-comment-to-readme

7. Applies changes + commits
   → git commit -m "WO-8f8335d7: Add test comment"

8. Pushes branch to GitHub
   → git push -u origin feature/wo-...

9. Creates PR via gh CLI
   → gh pr create --repo AI-DevHouse/Moose

10. Updates Supabase
    → status = "completed"
    → cost tracked
```

### Known Issues (v58)

#### ✅ Resolved: Windows Git Commands
**Problem:** `execSync` git commands failed on Windows.
**Solution:** Added `shell: true` and proper stdio configuration.
**Status:** Fixed in commit `789423b`

#### ✅ Resolved: GitHub Repo Format
**Problem:** gh CLI expected "owner/repo" format, got "Moose".
**Solution:** Combine `github_org` + `github_repo_name` fields.
**Status:** Fixed in commit `c8a145e`

#### ⏳ Pending: Aider Execution
**Problem:** Aider exits with code 3221225794 (Windows error).
**Status:** Under investigation, likely environment or Aider configuration issue.

---

## Appendix: Key Environment Variables

```bash
# Supabase (Metadata Storage)
NEXT_PUBLIC_SUPABASE_URL=https://veofqiywppjsjqfqztft.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

# LLM API Keys
ANTHROPIC_API_KEY=<claude_key>
OPENAI_API_KEY=<gpt_key>

# Optional: GitHub (if not using gh auth)
GITHUB_TOKEN=<token>
```

---

## Appendix: Hybrid Architecture Benefits

### Why Not Serverless Orchestrator?

❌ **Serverless limitations:**
- 10-minute timeout (work orders take longer)
- No persistent filesystem (Aider needs git operations)
- No SSH keys (for private repos)
- Cold starts (adds latency)

✅ **Local orchestrator advantages:**
- Unlimited execution time
- Full filesystem access
- Git/SSH keys available
- Direct Aider integration
- No cold starts

### Why Not Local-Only?

❌ **Local-only limitations:**
- No remote monitoring (must be at dev machine)
- No web dashboard
- Database file locking issues (SQLite)
- Not accessible from other machines

✅ **Hybrid advantages:**
- Remote monitoring via Vercel dashboard
- Centralized metadata in Supabase
- Multiple orchestrators can run (different machines)
- Cloud-accessible while using local resources

---

## Appendix: Future Enhancements

### Priority 2: SSE Progress Monitoring
- Real-time progress updates during execution
- WebSocket-like updates via Server-Sent Events
- UI shows: "Creating branch...", "Running Aider...", "Creating PR..."

### Priority 3: Chat UI Testing
- Natural language work order creation
- Intent parsing: "Create a login page" → structured work order
- Located at `/chat`

### Priority 4: Multi-Machine Orchestrators
- Run orchestrators on multiple machines
- Automatic work distribution via Supabase locking
- Horizontal scaling for concurrent work orders

### Priority 5: Learning System
- Track which LLMs perform best on which task types
- Adjust routing rules based on success rates
- Cost optimization through performance analysis

---

**END OF DOCUMENT**

**Version:** 1.0
**Last Updated:** 2025-10-09
**Status:** Living document - update as architecture evolves
