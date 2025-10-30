# Moose Mission Control - System Architecture

> Comprehensive architectural documentation for the Moose Mission Control autonomous software development system.

**Version**: v134 (October 2024)
**Status**: Production
**Last Updated**: 2025-10-24

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Agent Architecture](#agent-architecture)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Core Services](#core-services)
7. [External Integrations](#external-integrations)
8. [Data Flow & Workflows](#data-flow--workflows)
9. [Type System](#type-system)
10. [Configuration](#configuration)
11. [Deployment & Operations](#deployment--operations)
12. [Security & Safety](#security--safety)
13. [Performance & Cost](#performance--cost)
14. [Testing & Quality](#testing--quality)
15. [File Structure Reference](#file-structure-reference)

---

## Executive Summary

**Moose Mission Control** is an autonomous software development system that uses AI agents to decompose feature specifications into work orders, generate code, and manage the entire development lifecycle with minimal human intervention.

### Key Capabilities

- **Autonomous Development**: End-to-end code generation from specification to pull request
- **Multi-Agent Orchestration**: 7 specialized agents with hierarchical responsibilities
- **Cost Efficiency**: 940x cost reduction vs human development (~$17 vs $16,000 per project)
- **Quality Assurance**: 5-dimension automated validation with human escalation
- **Learning System**: Continuous improvement through outcome tracking and supervised learning
- **Concurrent Execution**: 15 simultaneous work orders with isolated git worktrees

### Technology Stack

```yaml
Framework: Next.js 14 (App Router)
Language: TypeScript
Database: Supabase (PostgreSQL)
LLM Providers:
  - Anthropic Claude Sonnet 4.5 (primary)
  - OpenAI GPT-4o, GPT-4o-mini
Code Application: Aider (git-based code editor)
Version Control: GitHub (via gh CLI + Octokit)
Runtime: Node.js
```

### Success Metrics (Current Production)

- **53 work orders** decomposed in 5 minutes
- **15 concurrent** executions
- **~$0.82** decomposition cost for 53 WOs
- **~$0.10-$2.50** per work order execution
- **5-dimension** quality validation (architecture, readability, completeness, tests, documentation)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                            │
│  (Next.js Dashboard, Chat Interface, REST APIs)                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                     Agent Orchestration Layer                    │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│  ARCHITECT   │   DIRECTOR   │   MANAGER    │ CLIENT MANAGER     │
│ (Decompose)  │  (Approve)   │  (Route)     │ (Escalate)         │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────────┘
       │              │              │                 │
┌──────▼──────────────▼──────────────▼─────────────────▼───────────┐
│                    Execution Layer                                │
├─────────────────────────┬────────────────────┬────────────────────┤
│      PROPOSER           │   ORCHESTRATOR     │    SENTINEL        │
│  (Generate Code)        │  (Execute WO)      │  (Validate)        │
└─────────────────────────┴────────────────────┴────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                   Infrastructure Layer                           │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│   Supabase   │    GitHub    │     Aider    │   LLM APIs         │
│  (Database)  │  (VCS/CI)    │  (Code Gen)  │ (Claude, GPT)      │
└──────────────┴──────────────┴──────────────┴────────────────────┘
```

### Project Structure

```
moose-mission-control/
├── src/                          # Application source code
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # 33 REST API endpoints
│   │   ├── chat/                 # Specification chat interface
│   │   ├── admin/                # Health monitoring dashboard
│   │   └── page.tsx              # Main mission control dashboard
│   ├── components/               # React UI components
│   ├── lib/                      # Business logic & services (60+ files)
│   │   ├── orchestrator/         # Execution orchestration (15 files)
│   │   ├── bootstrap/            # Infrastructure setup (8 files)
│   │   ├── sentinel/             # Quality validation (5 files)
│   │   ├── learning/             # Supervised learning (4 files)
│   │   └── *.ts                  # Agent services, utilities
│   └── types/                    # TypeScript definitions (7 files)
├── scripts/                      # Automation scripts (100+ files)
│   ├── orchestrator-daemon.ts    # Background execution daemon
│   ├── test-*.ts                 # Validation scripts
│   ├── approve-*.ts              # WO approval automation
│   └── check-*.ts                # Health check scripts
├── supabase/                     # Database schema
│   ├── migrations/               # SQL migration files
│   └── config.toml               # Supabase configuration
├── docs/                         # Documentation (100+ files)
│   ├── session_updates/          # Development session handovers
│   └── evidence/                 # Test results and screenshots
└── tests/                        # Test suite
```

---

## Agent Architecture

Moose implements a **hierarchical agent system** inspired by organizational structures. Each agent has specific, limited authority with human escalation for edge cases.

### Agent Hierarchy Flowchart

```
USER SUBMITS SPECIFICATION
         │
         ▼
    ┌─────────────┐
    │  ARCHITECT  │ ◄─── Decomposes spec into work orders
    └──────┬──────┘      Model: Claude Sonnet 4.5
           │             Output: 5-50 work orders + dependencies
           ▼
    ┌─────────────┐
    │  DIRECTOR   │ ◄─── Approves/rejects based on risk
    └──────┬──────┘      Model: Rule-based (no LLM)
           │             Output: Approved WOs → database
           ▼
    ┌─────────────┐
    │   MANAGER   │ ◄─── Routes WO to appropriate proposer
    └──────┬──────┘      Model: Rule-based routing
           │             Output: Proposer selection + budget reservation
           ▼
    ┌─────────────┐
    │  PROPOSER   │ ◄─── Generates code solution
    └──────┬──────┘      Model: Claude/GPT (complexity-based)
           │             Output: Source code + file paths
           ▼
    ┌─────────────┐
    │ORCHESTRATOR │ ◄─── Executes complete pipeline
    └──────┬──────┘      Model: Coordination layer
           │             Output: GitHub PR + metadata
           ▼
    ┌─────────────┐
    │  SENTINEL   │ ◄─── Validates quality (5 dimensions)
    └──────┬──────┘      Model: Rule-based + test parsing
           │             Output: Pass/fail + confidence
           ▼
    ┌─────────────┐
    │CLIENT MGR   │ ◄─── Escalates failures to human
    └─────────────┘      Model: Hybrid (rules + LLM)
                         Output: Resolution options
```

---

### 1. ARCHITECT Agent

**Purpose**: Decomposes feature specifications into actionable work orders

**Location**: `src/lib/architect-service.ts`

**Model**: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)

**Input**:
```typescript
TechnicalSpec {
  feature_name: string;
  objectives: string[];
  constraints: string[];
  acceptance_criteria: string[];
  budget_estimate?: number;
}
```

**Output**:
```typescript
DecompositionOutput {
  work_orders: WorkOrder[];           // 5-50 work orders
  decomposition_doc: string;          // Markdown documentation
  total_estimated_cost: number;       // Budget estimate
  contracts?: IntegrationContracts;   // API/IPC contracts
}
```

**Key Features**:
- **Batched Decomposition**: Handles large projects (53+ WOs) using `batched-architect-service.ts`
- **Bootstrap Injection**: Auto-detects greenfield projects and injects WO-0 for infrastructure
- **Dependency Graph**: Validates work order dependencies, auto-repairs invalid references
- **Contract Generation**: Creates API, IPC, State, File, and Database contracts
- **Wireframe Generation**: Generates UI mockups for frontend components
- **Package Validation**: Validates and corrects npm package versions across work orders

**Implementation Files**:
```
src/lib/
├── architect-service.ts                    # Main orchestration
├── batched-architect-service.ts            # Large project batching
├── architect-decomposition-rules.ts        # Decomposition logic
├── architect-package-validator.ts          # Package version validation
├── complexity-analyzer.ts                  # Complexity scoring
├── dependency-validator.ts                 # Dependency graph validation
└── bootstrap/
    ├── bootstrap-wo-generator.ts           # WO-0 generation
    ├── bootstrap-architecture-inferrer.ts  # Framework detection
    └── requirements-aggregator.ts          # Dependency aggregation
```

**Rate Limiting**: 4 requests/minute (configurable in `src/lib/rate-limiter.ts`)

**Cost**: ~$0.82 for 53 work orders (5 minutes)

---

### 2. DIRECTOR Agent

**Purpose**: Governance and approval authority for work orders

**Location**: `src/lib/director-service.ts`

**Model**: Rule-based (no LLM - deterministic risk assessment)

**Input**:
```typescript
DecompositionOutput {
  work_orders: WorkOrder[];
  total_estimated_cost: number;
}
```

**Output**:
```typescript
ApprovalDecision {
  approved_work_orders: WorkOrder[];
  rejected_work_orders: Array<{
    work_order: WorkOrder;
    rejection_reason: string;
  }>;
  requires_human_approval: WorkOrder[];
}
```

**Key Features**:
- **Risk Assessment**: Calculates risk level (low/medium/high) per work order
- **Auto-Approval**: Approves low-risk work orders automatically
- **Budget Validation**: Ensures total cost within budget limits
- **Human Escalation**: Routes high-risk changes to human approval

**Risk Calculation Factors** (`director-risk-assessment.ts`):
```typescript
Risk Factors:
- File scope: > 5 files = +1 risk
- Core system files (orchestrator/, proposer/) = +2 risk
- Database migrations = +2 risk
- Authentication/security changes = +3 risk
- Context budget > 20K tokens = +1 risk
```

**Approval Thresholds**:
- **Low Risk** (0-2 points): Auto-approve
- **Medium Risk** (3-5 points): Auto-approve with audit log
- **High Risk** (6+ points): Require human approval

**Cost**: $0 (no LLM calls)

---

### 3. MANAGER Agent

**Purpose**: Tactical routing of work orders to appropriate proposers

**Location**: `src/lib/manager-service.ts`

**Model**: Rule-based routing with performance tracking

**Input**:
```typescript
WorkOrder {
  id: string;
  title: string;
  description: string;
  complexity_score: number;  // 0.0-1.0
  files_in_scope: string[];
}
```

**Output**:
```typescript
RoutingDecision {
  proposer_id: string;              // e.g., "claude-sonnet-4-5"
  proposer_name: string;
  confidence: number;               // 0.0-1.0
  route_reason: string;
  fallback_proposer_id?: string;
  estimated_cost: number;
}
```

**Key Features**:
- **Complexity-Based Routing**: Routes based on work order complexity score
- **Budget Reservation**: Atomically reserves budget before execution
- **Hard-Stop Detection**: Identifies critical tasks requiring most capable model
- **Performance Tracking**: Monitors success rates per proposer
- **Fallback Strategy**: Provides backup proposer if primary fails

**Routing Logic** (`manager-routing-rules.ts`):
```typescript
Routing Rules:
- Complexity >= 1.0: claude-sonnet-4-5 (threshold: 1.0)
- Complexity >= 0.7: gpt-4o (threshold: 0.7)
- Complexity >= 0.3: gpt-4o-mini (threshold: 0.3)
- Complexity < 0.3: gpt-4o-mini (minimum)

Hard-Stop Detection (always use Claude Sonnet):
- Keywords: "critical", "security", "authentication", "migration"
- File scope: > 10 files
- Dependencies: > 5 work orders
```

**Implementation Files**:
```
src/lib/
├── manager-service.ts              # Main routing orchestration
├── manager-routing-rules.ts        # Routing logic
├── proposer-registry.ts            # Proposer configuration loader
└── complexity-estimator.ts         # Complexity scoring
```

**Cost**: $0 (no LLM calls)

---

### 4. PROPOSER Agent

**Purpose**: Generates code solutions for work orders

**Location**: `src/lib/enhanced-proposer-service.ts`

**Models**: Multiple (configurable in `proposer_configs` table)

| Proposer ID | Provider | Model | Complexity Threshold | Cost (input/output per 1M tokens) |
|-------------|----------|-------|----------------------|-----------------------------------|
| `claude-sonnet-4-5` | Anthropic | `claude-sonnet-4-5-20250929` | 1.0 | $15 / $75 |
| `gpt-4o` | OpenAI | `gpt-4o` | 0.7 | $5 / $15 |
| `gpt-4o-mini` | OpenAI | `gpt-4o-mini` | 0.3 | $0.15 / $0.60 |

**Input**:
```typescript
ProposerRequest {
  work_order: WorkOrder;
  context_requirements: {
    files_to_read: string[];
    dependencies: WorkOrder[];
  };
  retry_count?: number;
}
```

**Output**:
```typescript
EnhancedProposerResponse {
  code: string;                    // Generated code
  file_path: string;
  cost: number;
  tokens_input: number;
  tokens_output: number;
  refinement_cycles: number;       // 0-3
  initial_errors: number;
  final_errors: number;
  sanitizer_changes: string[];
}
```

**Key Features**:
- **Iterative Refinement**: Up to 3 cycles to fix errors (controlled by `proposer-refinement-rules.ts`)
- **Code Sanitization**: Removes markdown blocks, fixes syntax (`code-sanitizer.ts`)
- **Error Pattern Learning**: Stores failures for future improvement (`proposer-failure-logger.ts`)
- **Prompt Enhancement**: Adds error-specific instructions from `prompt_enhancements` table
- **Cost Tracking**: Records per-token costs in database
- **Context Management**: Smart file selection to fit within token limits

**Refinement Process**:
```
1. Generate initial code
2. Run code sanitizer
3. Count errors (TypeScript, lint, runtime)
4. If errors > 0 and cycles < 3:
   - Inject error feedback into prompt
   - Apply prompt enhancements for error codes
   - Regenerate code
   - Repeat
5. Return final output
```

**Implementation Files**:
```
src/lib/
├── enhanced-proposer-service.ts        # Main execution
├── proposer-refinement-rules.ts        # Refinement logic
├── code-sanitizer.ts                   # Output cleaning
├── proposer-failure-logger.ts          # Learning system
├── extraction-validator.ts             # JSON extraction
└── llm-service.ts                      # LLM abstraction
```

**Cost**: ~$0.10-$2.50 per work order (varies by complexity)

---

### 5. ORCHESTRATOR Agent

**Purpose**: Executes work order pipeline end-to-end

**Location**: `src/lib/orchestrator/orchestrator-service.ts`

**Model**: Coordination layer (no LLM - orchestrates other agents)

**Key Features**:
- **Polling System**: Queries database every 10s for approved work orders
- **Concurrent Execution**: Handles up to 15 simultaneous work orders
- **Worktree Pool**: Manages 15 isolated git worktrees for parallel execution
- **Package Validation**: Pre-execution dependency version validation
- **Aider Integration**: Applies code via Aider (git-based code editor)
- **GitHub Integration**: Creates PRs via `gh` CLI
- **Acceptance Validation**: 5-dimension quality scoring
- **Result Tracking**: Stores outcomes in database for learning

**Execution Pipeline**:
```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Poll Database (every 10s)                                     │
│    - Query: status = 'approved' AND execution_count < max_retries│
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Get Routing Decision (Manager)                                │
│    - Determine proposer model                                    │
│    - Reserve budget atomically                                   │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Validate & Correct Packages (Package Validator)               │
│    - Check npm_dependencies against project package.json         │
│    - Auto-correct version conflicts                              │
│    - Log corrections to database                                 │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Generate Code (Proposer)                                      │
│    - Call LLM with work order context                            │
│    - Apply iterative refinement                                  │
│    - Sanitize output                                             │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Lease Worktree (if pool enabled)                              │
│    - Find available worktree                                     │
│    - Mark as leased                                              │
│    - Create isolated execution environment                       │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Apply Code (Aider)                                            │
│    - Create git branch: feature/wo-{id}                          │
│    - Run aider with generated code                               │
│    - Commit changes with WO metadata                             │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Create GitHub PR (gh CLI)                                     │
│    - Push branch to origin                                       │
│    - Create PR with acceptance criteria                          │
│    - Add labels: auto-generated, work-order-{id}                 │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Run Acceptance Validation                                     │
│    - Score 5 dimensions (0-2 each)                               │
│    - Store result in work_order.acceptance_result                │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. Track Result (Learning System)                                │
│    - Insert into outcome_vectors table                           │
│    - Update cost tracking                                        │
│    - Release worktree                                            │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation Files**:
```
src/lib/orchestrator/
├── orchestrator-service.ts         # Main coordinator
├── work-order-poller.ts            # Database polling
├── manager-coordinator.ts          # Manager integration
├── proposer-executor.ts            # Proposer integration
├── aider-executor.ts               # Aider code application
├── github-integration.ts           # GitHub PR creation
├── result-tracker.ts               # Outcome storage
├── worktree-pool.ts                # Isolated execution environment
├── package-validator.ts            # Package version validation
└── capacity-manager.ts             # Concurrent execution throttling
```

**Background Daemon**: `scripts/orchestrator-daemon.ts`
- Runs continuously in background
- Polls every 10 seconds
- Handles concurrent executions
- Graceful shutdown on SIGINT/SIGTERM

**Cost**: $0 (coordination only - LLM costs tracked in Proposer)

---

### 6. SENTINEL Agent

**Purpose**: Quality gate for work order completion

**Location**: `src/lib/sentinel/sentinel-service.ts`

**Model**: Hybrid (rule-based + test output parsing)

**Input**:
```typescript
SentinelRequest {
  work_order_id: string;
  github_pr_number: number;
  github_repo: string;
}
```

**Output**:
```typescript
SentinelDecision {
  verdict: 'pass' | 'fail';
  confidence: number;               // 0.0-1.0
  reasoning: string;
  test_results: TestOutput | null;
  workflow_results: WorkflowResult[];
  escalation_required: boolean;
  escalation_reason?: string;
}
```

**Key Features**:
- **GitHub Actions Integration**: Fetches workflow results via Octokit API
- **Test Output Parsing**: Extracts test results from Jest/Vitest logs
- **Flaky Test Detection**: Identifies intermittent failures
- **Confidence Scoring**: Rates decision confidence based on signal quality
- **Auto-Escalation**: Flags repeated failures for human review

**Decision Logic** (`decision-maker.ts`):
```typescript
Pass Conditions:
- All GitHub Actions workflows passed
- No test failures in output
- No compile errors (TypeScript)
- No lint errors (ESLint)
- Confidence >= 0.8

Fail Conditions:
- Any workflow failed
- Test failures detected
- Compile errors present
- Confidence >= 0.7

Escalate Conditions:
- Confidence < 0.7 (ambiguous signal)
- Repeated failures (> 3 attempts)
- Flaky tests detected
```

**Implementation Files**:
```
src/lib/sentinel/
├── sentinel-service.ts             # Main analysis
├── decision-maker.ts               # Pass/fail logic
├── test-parser.ts                  # Test output parsing
└── flaky-detector.ts               # Flaky test identification
```

**Cost**: $0 (no LLM calls - rule-based analysis)

---

### 7. CLIENT MANAGER Agent

**Purpose**: Human escalation and resolution management

**Location**: `src/lib/client-manager-service.ts`

**Model**: Hybrid (rule-based classification + LLM-assisted recommendations)

**Input**:
```typescript
EscalationTrigger {
  trigger_type:
    | 'proposer_exhausted'           // Max refinement cycles reached
    | 'sentinel_hard_failure'        // Critical test failure
    | 'budget_overrun'               // Cost exceeded limits
    | 'conflicting_requirements'     // Ambiguous spec
    | 'technical_blocker'            // External dependency missing
    | 'contract_violation'           // API contract broken
    | 'aider_irreconcilable';        // Git merge conflict
  work_order_id: string;
  agent_name: string;
  failure_count: number;
  context: {
    error_messages: string[];
    cost_spent_so_far: number;
    attempts_history: Array<{...}>;
    current_state: string;
    blocking_issue: string;
  };
}
```

**Output**:
```typescript
ClientManagerRecommendation {
  escalation_id: string;
  resolution_options: ResolutionOption[];
  recommended_option_id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  human_decision_required: boolean;
}

ResolutionOption {
  option_id: string;
  strategy:
    | 'retry_different_approach'     // Change proposer model
    | 'pivot_solution'               // Different implementation path
    | 'amend_upstream'               // Fix parent work order
    | 'abort_redesign'               // Redesign feature
    | 'manual_intervention';         // Human fixes code
  description: string;
  estimated_cost: number;
  success_probability: number;      // 0.0-1.0
  time_to_resolution: string;       // e.g., "5 minutes", "2 hours"
  risk_assessment: {...};
  execution_steps: string[];
}
```

**Key Features**:
- **Failure Classification**: Categorizes errors into 8 types
- **Resolution Generation**: Creates 2-4 resolution options per escalation
- **Historical Pattern Matching**: Learns from past escalations
- **Trade-Off Analysis**: Presents cost/time/risk for each option
- **Human Approval Workflow**: Routes critical decisions to humans

**Escalation Triggers**:
```typescript
Auto-Escalate When:
- Proposer refinement fails after 3 cycles
- Sentinel confidence < 0.7
- Budget exceeded by > 50%
- Repeated failures (> 5 attempts)
- Security/authentication errors
- External service unavailable
```

**Implementation Files**:
```
src/lib/
├── client-manager-service.ts           # Main orchestration
├── client-manager-escalation-rules.ts  # Escalation logic
└── failure-classifier.ts               # Error categorization
```

**Cost**: ~$0.05-$0.20 per escalation (LLM for recommendations)

---

## Database Schema

Moose uses **Supabase** (PostgreSQL) with row-level security (RLS) enabled for all tables.

### Entity-Relationship Diagram

```
┌─────────────────┐         ┌──────────────────────┐
│    projects     │1       *│    work_orders       │
│─────────────────│◄────────┤──────────────────────│
│ id (PK)         │         │ id (PK)              │
│ name            │         │ project_id (FK)      │
│ local_path      │         │ title                │
│ github_repo_url │         │ status               │
│ default_branch  │         │ risk_level           │
└─────────────────┘         │ complexity_score     │
                            │ proposer_id (FK)     │
                            │ github_pr_number     │
                            │ acceptance_result    │
                            └──────────┬───────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    │1                 │*                 │*
        ┌───────────▼──────────┐ ┌─────▼────────┐ ┌──────▼──────────┐
        │ proposer_configs     │ │  escalations │ │ outcome_vectors │
        │──────────────────────│ │──────────────│ │─────────────────│
        │ id (PK)              │ │ id (PK)      │ │ id (PK)         │
        │ name                 │ │ wo_id (FK)   │ │ wo_id (FK)      │
        │ provider             │ │ severity     │ │ success         │
        │ model                │ │ status       │ │ cost            │
        │ complexity_threshold │ └──────────────┘ │ model_used      │
        └──────────────────────┘                  │ failure_class   │
                                                   └─────────────────┘
```

---

### Core Tables

#### **projects** - Target repositories

**Purpose**: Stores information about repositories that Moose manages

```typescript
interface Project {
  id: string;                          // UUID (PK)
  name: string;                        // "my-nextjs-app"
  description: string | null;
  local_path: string;                  // "C:\dev\my-nextjs-app"
  github_repo_url: string | null;      // "https://github.com/org/repo"
  github_org: string | null;           // "myorg"
  github_repo_name: string | null;     // "my-nextjs-app"
  default_branch: string | null;       // "main" or "master"
  status: string;                      // "active" | "archived"
  git_initialized: boolean | null;
  infrastructure_status: string | null;
  supabase_project_url: string | null;
  supabase_anon_key: string | null;
  vercel_team_id: string | null;
  setup_notes: Json | null;
  created_at: timestamptz;
  updated_at: timestamptz;
}
```

**Indexes**:
- `projects_pkey` on `id`
- `projects_name_idx` on `name`

---

#### **work_orders** - Individual development tasks

**Purpose**: Central table for all work orders generated by Architect

```typescript
interface WorkOrder {
  id: string;                          // UUID (PK)
  title: string;                       // "Implement user authentication"
  description: string;                 // Detailed task description
  status: string;                      // "pending" | "approved" | "in_progress" | "completed" | "failed"
  risk_level: string;                  // "low" | "medium" | "high"
  estimated_cost: number | null;       // Budget estimate
  actual_cost: number | null;          // Actual LLM cost
  complexity_score: number | null;     // 0.0-1.0
  context_budget_estimate: number | null; // Token count estimate
  pattern_confidence: number | null;   // Solution pattern confidence
  project_id: string | null;           // FK to projects
  proposer_id: string | null;          // FK to proposer_configs
  architect_version: string | null;    // Git commit hash
  decomposition_doc: string | null;    // Decomposition markdown
  acceptance_criteria: Json | null;    // string[] - Requirements
  files_in_scope: string[] | null;     // Files to modify
  technical_requirements: Json | null; // TechnicalRequirements object
  github_pr_url: string | null;        // Full PR URL
  github_pr_number: number | null;     // PR number
  github_branch: string | null;        // "feature/wo-abc123"
  acceptance_result: Json | null;      // AcceptanceValidation object
  metadata: Json | null;               // Extensible metadata
  created_at: timestamptz;
  updated_at: timestamptz;
  completed_at: timestamptz | null;
}
```

**Indexes**:
- `work_orders_pkey` on `id`
- `work_orders_project_id_idx` on `project_id`
- `work_orders_status_idx` on `status`
- `work_orders_proposer_id_idx` on `proposer_id`

**Foreign Keys**:
- `project_id` → `projects.id`
- `proposer_id` → `proposer_configs.id`

---

#### **decomposition_metadata** - Decomposition session tracking

**Purpose**: Tracks groups of work orders from a single decomposition

```typescript
interface DecompositionMetadata {
  id: string;                          // UUID (PK)
  decomposition_id: string;            // Business ID (e.g., "decomp-abc123")
  project_id: string;                  // FK to projects
  work_order_ids: string[];            // Array of WO UUIDs
  has_conflicts: boolean;              // Dependency conflicts detected
  conflict_report: Json | null;        // ConflictReport object
  conflicts_resolved_at: timestamptz | null;
  resolved_by: string | null;          // User ID or "system"
  bootstrap_needed: boolean;           // Requires WO-0 infrastructure setup
  bootstrap_executed: boolean | null;
  bootstrap_commit_hash: string | null;// Git commit after bootstrap
  bootstrap_result: Json | null;       // Bootstrap execution result
  aggregated_requirements: Json | null;// AggregatedRequirements object
  created_at: timestamptz;
  updated_at: timestamptz;
}
```

**Indexes**:
- `decomposition_metadata_pkey` on `id`
- `decomposition_metadata_decomposition_id_idx` on `decomposition_id`
- `decomposition_metadata_project_id_idx` on `project_id`

---

#### **proposer_configs** - Proposer model definitions

**Purpose**: Configuration for all available proposer models

```typescript
interface ProposerConfig {
  id: string;                          // UUID (PK)
  name: string;                        // "claude-sonnet-4-5", "gpt-4o-mini"
  provider: string;                    // "anthropic" | "openai"
  model: string;                       // Actual model ID
  complexity_threshold: number;        // 0.0-1.0 (route if score >= threshold)
  cost_profile: Json;                  // { input_cost_per_token: number, output_cost_per_token: number }
  active: boolean;                     // Enabled for routing
  created_at: timestamptz;
  updated_at: timestamptz;
}
```

**Example Rows**:
```sql
INSERT INTO proposer_configs (name, provider, model, complexity_threshold, cost_profile, active) VALUES
('claude-sonnet-4-5', 'anthropic', 'claude-sonnet-4-5-20250929', 1.0, '{"input_cost_per_token": 0.000015, "output_cost_per_token": 0.000075}', true),
('gpt-4o', 'openai', 'gpt-4o', 0.7, '{"input_cost_per_token": 0.000005, "output_cost_per_token": 0.000015}', true),
('gpt-4o-mini', 'openai', 'gpt-4o-mini', 0.3, '{"input_cost_per_token": 0.00000015, "output_cost_per_token": 0.0000006}', true);
```

**Indexes**:
- `proposer_configs_pkey` on `id`
- `proposer_configs_name_idx` on `name` (unique)

---

### Learning System Tables

#### **outcome_vectors** - Execution results for supervised learning

**Purpose**: Stores execution outcomes for learning and analysis

```typescript
interface OutcomeVector {
  id: string;                          // UUID (PK)
  work_order_id: string;               // FK to work_orders
  success: boolean;                    // Did execution succeed?
  model_used: string;                  // Proposer model name
  cost: number;                        // Actual cost in USD
  execution_time_ms: number;           // Total execution time
  diff_size_lines: number | null;      // Lines of code changed
  test_duration_ms: number | null;     // Test execution time
  failure_class: failure_class_enum | null; // See enums below
  error_context: Json | null;          // Error details
  route_reason: string | null;         // Manager routing reason
  metadata: Json | null;
  created_at: timestamptz;
}
```

**Indexes**:
- `outcome_vectors_pkey` on `id`
- `outcome_vectors_work_order_id_idx` on `work_order_id`
- `outcome_vectors_model_used_idx` on `model_used`

---

#### **proposer_failures** - Failure tracking for refinement

**Purpose**: Tracks proposer failures for prompt enhancement learning

```typescript
interface ProposerFailure {
  id: string;                          // UUID (PK)
  work_order_id: string | null;        // FK to work_orders
  proposer_name: string;               // Model name
  complexity_score: number | null;     // 0.0-1.0
  complexity_band: string | null;      // "low" | "medium" | "high"
  initial_errors: number;              // Errors before refinement
  final_errors: number;                // Errors after refinement
  refinement_count: number;            // Number of cycles
  refinement_success: boolean;         // Did refinement help?
  is_success: boolean;                 // Overall success
  failure_category: string | null;     // "syntax" | "logic" | "type_error"
  error_codes: string[] | null;        // ["TS2304", "TS2345"]
  error_samples: Json | null;          // Sample error messages
  sanitizer_functions_triggered: number | null;
  sanitizer_changes: string[] | null;  // ["removed_markdown_blocks", "fixed_imports"]
  created_at: timestamptz;
}
```

**Indexes**:
- `proposer_failures_pkey` on `id`
- `proposer_failures_proposer_name_idx` on `proposer_name`

---

#### **prompt_enhancements** - Error-based prompt improvements

**Purpose**: Stores prompt enhancements learned from error patterns

```typescript
interface PromptEnhancement {
  id: string;                          // UUID (PK)
  error_code: string;                  // "TS2304", "LINT001"
  error_pattern: string | null;        // Regex or substring match
  enhancement_text: string;            // Additional instruction to append
  enhancement_version: number;         // Version for A/B testing
  parent_enhancement_id: string | null;// FK to self (refinement chain)
  is_active: boolean;
  target_proposer_names: string[] | null; // Apply only to specific models
  target_complexity_min: number | null;
  target_complexity_max: number | null;
  success_count: number;               // Times it reduced errors
  failure_count: number;               // Times it didn't help
  reduction_rate: number | null;       // success / (success + failure)
  applications_count: number;
  improvement_reason: string | null;
  last_effectiveness_check: timestamptz | null;
  created_at: timestamptz;
  updated_at: timestamptz;
}
```

**Example Row**:
```sql
INSERT INTO prompt_enhancements (error_code, enhancement_text, is_active) VALUES
('TS2304', 'Always import all types and interfaces before using them. Check import statements carefully.', true);
```

**Indexes**:
- `prompt_enhancements_pkey` on `id`
- `prompt_enhancements_error_code_idx` on `error_code`

---

#### **test_iterations** - Supervised learning iterations

**Purpose**: Tracks complete test project iterations for quality assessment

```typescript
interface TestIteration {
  id: string;                          // UUID (PK)
  iteration_number: number;            // Sequential iteration
  project_name: string;                // Test project name
  moose_version: string | null;        // Git commit hash of Moose
  status: string;                      // "running" | "completed" | "failed"
  started_at: timestamptz;
  completed_at: timestamptz | null;
  total_work_orders: number | null;
  work_orders_succeeded: number | null;
  work_orders_failed: number | null;
  total_execution_time_seconds: number | null;
  total_cost_usd: number | null;

  // Quality Scores (1-10 scale)
  architecture_score: number | null;
  readability_score: number | null;
  completeness_score: number | null;
  test_coverage_score: number | null;
  user_experience_score: number | null;
  overall_score: number | null;        // Weighted average

  // Build Status
  builds_successfully: boolean | null;
  tests_pass: boolean | null;
  lint_errors: number | null;

  // Safety Checks
  moose_files_modified: boolean | null;// MUST be false
  isolation_verified: boolean | null;

  // Analysis
  scoring_details: Json | null;
  analysis_summary: Json | null;
  failures_by_class: Json | null;

  created_at: timestamptz;
}
```

**Indexes**:
- `test_iterations_pkey` on `id`
- `test_iterations_iteration_number_idx` on `iteration_number` (unique)

---

### Package Validation Tables

#### **package_version_corrections** - Package fix tracking

**Purpose**: Logs all package version corrections during validation

```typescript
interface PackageVersionCorrection {
  id: string;                          // UUID (PK)
  project_id: string;                  // FK to projects
  work_order_id: string;               // FK to work_orders
  package_name: string;                // "react", "next"
  old_version: string;                 // "17.0.0"
  new_version: string;                 // "18.2.0"
  correction_reason: string;           // "Conflict resolution", "Higher version in project"
  source_work_order_id: string | null; // Source of truth WO
  confidence_level: string;            // "high" | "medium" | "low"
  validated_at: timestamptz;
  execution_context: string;           // "pre_proposer" | "post_proposer"
  metadata: Json;                      // Additional context
  created_at: timestamptz;
}
```

**Indexes**:
- `package_version_corrections_pkey` on `id`
- `package_version_corrections_project_id_idx` on `project_id`
- `package_version_corrections_work_order_id_idx` on `work_order_id`

---

### Supporting Tables

**escalations** - Human escalation tracking
**decision_logs** - Agent decision audit trail
**cost_tracking** - Budget monitoring
**github_events** - GitHub webhook events
**contracts** - Integration contract definitions
**bootstrap_events** - Bootstrap execution logs
**pattern_confidence_scores** - Pattern success tracking
**playbook_memory** - Solution pattern storage
**escalation_scripts** - Resolution templates

---

### Database Functions

#### **check_and_reserve_budget**

**Purpose**: Atomically checks and reserves budget for a work order

```sql
CREATE FUNCTION check_and_reserve_budget(
  p_project_id UUID,
  p_work_order_id UUID,
  p_estimated_cost NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_total_spent NUMERIC;
  v_budget_limit NUMERIC;
BEGIN
  -- Get project budget limit
  SELECT budget_limit INTO v_budget_limit
  FROM projects WHERE id = p_project_id;

  -- Calculate total spent
  SELECT COALESCE(SUM(actual_cost), 0) INTO v_total_spent
  FROM work_orders WHERE project_id = p_project_id;

  -- Check if within budget
  IF (v_total_spent + p_estimated_cost) > v_budget_limit THEN
    RETURN FALSE;
  END IF;

  -- Reserve budget
  UPDATE work_orders
  SET estimated_cost = p_estimated_cost,
      status = 'budget_reserved'
  WHERE id = p_work_order_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

---

### Database Enums

```sql
CREATE TYPE failure_class_enum AS ENUM (
  'compile_error',          -- TypeScript/build errors
  'contract_violation',     -- API contract broken
  'test_fail',              -- Test failures
  'lint_error',             -- ESLint/style errors
  'orchestration_error',    -- Internal Moose error
  'budget_exceeded',        -- Cost limit hit
  'dependency_missing',     -- Missing npm package
  'timeout',                -- Execution timeout
  'unknown'                 -- Uncategorized error
);
```

---

## API Endpoints

Moose exposes **33 REST API endpoints** through Next.js API routes.

### API Categories

```
Architect APIs:      2 endpoints
Director APIs:       1 endpoint
Manager APIs:        1 endpoint
Proposer APIs:       3 endpoints
Orchestrator APIs:   3 endpoints
Sentinel APIs:       1 endpoint
Client Manager APIs: 3 endpoints
Project APIs:        3 endpoints
Work Order APIs:     2 endpoints
Monitoring APIs:     7 endpoints
Utility APIs:        7 endpoints
```

---

### Architect APIs

#### `POST /api/architect/decompose`

**Purpose**: Decompose feature specification into work orders

**Input**:
```typescript
{
  technical_spec: TechnicalSpec;
  project_id: string;
  use_batching?: boolean;           // Use for > 20 work orders
}
```

**Output**:
```typescript
{
  success: boolean;
  decomposition_output: DecompositionOutput;
  work_order_ids: string[];
  decomposition_id: string;
  cost: number;
  execution_time_ms: number;
}
```

**Location**: `src/app/api/architect/decompose/route.ts`

---

#### `POST /api/architect/resolve-conflicts`

**Purpose**: Resolve dependency conflicts in decomposition

**Input**:
```typescript
{
  decomposition_id: string;
  conflict_resolutions: Array<{
    work_order_id: string;
    resolved_dependencies: string[];
  }>;
}
```

**Output**:
```typescript
{
  success: boolean;
  updated_work_orders: WorkOrder[];
}
```

**Location**: `src/app/api/architect/resolve-conflicts/route.ts`

---

### Director APIs

#### `POST /api/director/approve`

**Purpose**: Approve/reject work orders based on risk

**Input**:
```typescript
{
  decomposition_output: DecompositionOutput;
  project_id: string;
}
```

**Output**:
```typescript
{
  success: boolean;
  approval_decision: ApprovalDecision;
  approved_count: number;
  rejected_count: number;
  human_approval_required_count: number;
}
```

**Location**: `src/app/api/director/approve/route.ts`

---

### Manager APIs

#### `POST /api/manager`

**Purpose**: Route work order to appropriate proposer

**Input**:
```typescript
{
  work_order_id: string;
}
```

**Output**:
```typescript
{
  success: boolean;
  routing_decision: RoutingDecision;
}
```

**Location**: `src/app/api/manager/route.ts`

---

### Proposer APIs

#### `POST /api/proposers`

**Purpose**: List all active proposers

**Output**:
```typescript
{
  proposers: ProposerConfig[];
}
```

#### `POST /api/proposer-execute`

**Purpose**: Execute code generation with basic proposer

**Input**:
```typescript
{
  work_order_id: string;
  proposer_name: string;
}
```

**Output**:
```typescript
{
  success: boolean;
  code: string;
  cost: number;
  tokens: { input: number; output: number };
}
```

#### `POST /api/proposer-enhanced`

**Purpose**: Execute code generation with enhanced refinement

**Input**:
```typescript
{
  work_order_id: string;
  proposer_name: string;
}
```

**Output**:
```typescript
{
  success: boolean;
  response: EnhancedProposerResponse;
}
```

**Location**: `src/app/api/proposer-enhanced/route.ts`

---

### Orchestrator APIs

#### `GET /api/orchestrator`

**Purpose**: Get orchestrator status and metrics

**Output**:
```typescript
{
  status: 'running' | 'stopped';
  active_executions: number;
  queued_work_orders: number;
  worktrees: {
    total: number;
    available: number;
    leased: number;
  };
}
```

#### `POST /api/orchestrator/execute`

**Purpose**: Manually trigger work order execution

**Input**:
```typescript
{
  work_order_id: string;
}
```

**Output**:
```typescript
{
  success: boolean;
  execution_result: ExecutionResult;
}
```

#### `GET /api/orchestrator/stream/[workOrderId]`

**Purpose**: Server-Sent Events stream for real-time progress

**Output**: SSE stream
```typescript
event: progress
data: { stage: 'routing' | 'proposer' | 'aider' | 'github', message: string }

event: complete
data: { success: boolean, pr_url?: string }

event: error
data: { error: string }
```

**Location**: `src/app/api/orchestrator/stream/[workOrderId]/route.ts`

---

### Sentinel APIs

#### `POST /api/sentinel`

**Purpose**: Analyze GitHub workflow results for quality

**Input**:
```typescript
{
  work_order_id: string;
  github_pr_number: number;
}
```

**Output**:
```typescript
{
  success: boolean;
  decision: SentinelDecision;
}
```

**Location**: `src/app/api/sentinel/route.ts`

---

### Client Manager APIs

#### `POST /api/client-manager/escalate`

**Purpose**: Create escalation for failed work order

**Input**:
```typescript
{
  trigger: EscalationTrigger;
}
```

**Output**:
```typescript
{
  success: boolean;
  escalation_id: string;
  recommendation: ClientManagerRecommendation;
}
```

#### `POST /api/client-manager/execute`

**Purpose**: Execute resolution option

**Input**:
```typescript
{
  escalation_id: string;
  selected_option_id: string;
}
```

**Output**:
```typescript
{
  success: boolean;
  execution_status: string;
}
```

#### `GET /api/client-manager/resolutions/[id]`

**Purpose**: Get resolution status

**Output**:
```typescript
{
  escalation_id: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'failed';
  selected_option: ResolutionOption;
  outcome: string | null;
}
```

**Location**: `src/app/api/client-manager/`

---

### Project APIs

#### `POST /api/projects/initialize`

**Purpose**: Create and initialize new project

**Input**:
```typescript
{
  name: string;
  description: string;
  local_path: string;
  github_repo_url?: string;
}
```

**Output**:
```typescript
{
  success: boolean;
  project_id: string;
  project: Project;
}
```

#### `GET /api/projects/[id]`

**Purpose**: Get project details

**Output**:
```typescript
{
  project: Project;
  stats: {
    total_work_orders: number;
    completed: number;
    in_progress: number;
    failed: number;
    total_cost: number;
  };
}
```

#### `POST /api/analyze-requirements`

**Purpose**: Analyze spec for external service requirements

**Input**:
```typescript
{
  technical_spec: TechnicalSpec;
}
```

**Output**:
```typescript
{
  external_services: Array<{
    name: string;
    env_vars: string[];
    purpose: string;
  }>;
}
```

**Location**: `src/app/api/`

---

### Work Order APIs

#### `GET /api/work-orders`

**Purpose**: List work orders with filters

**Query Params**:
- `project_id` (optional): Filter by project
- `status` (optional): Filter by status
- `limit` (optional): Pagination limit (default 50)
- `offset` (optional): Pagination offset

**Output**:
```typescript
{
  work_orders: WorkOrder[];
  total: number;
  limit: number;
  offset: number;
}
```

#### `GET /api/work-orders/[id]`

**Purpose**: Get work order details

**Output**:
```typescript
{
  work_order: WorkOrder;
  execution_history: Array<{
    attempt_number: number;
    proposer_used: string;
    cost: number;
    outcome: string;
    timestamp: timestamptz;
  }>;
}
```

**Location**: `src/app/api/work-orders/`

---

### Monitoring APIs

#### `GET /api/health`

**Purpose**: Basic system health check

**Output**:
```typescript
{
  status: 'healthy' | 'degraded' | 'down';
  timestamp: timestamptz;
  database: 'connected' | 'disconnected';
}
```

#### `GET /api/admin/health`

**Purpose**: Detailed health metrics (admin only)

**Output**:
```typescript
{
  database: {
    status: 'connected' | 'disconnected';
    latency_ms: number;
    connection_pool: { active: number; idle: number };
  };
  orchestrator: {
    status: 'running' | 'stopped';
    active_executions: number;
    queue_length: number;
  };
  llm_services: {
    anthropic: 'available' | 'unavailable';
    openai: 'available' | 'unavailable';
  };
  worktree_pool: {
    total: number;
    available: number;
    leased: number;
  };
  budget: {
    daily_limit: number;
    spent_today: number;
    remaining: number;
  };
}
```

#### `GET /api/system-heartbeat`

**Purpose**: Lightweight heartbeat endpoint

**Output**:
```typescript
{ alive: true, timestamp: timestamptz }
```

#### `GET /api/dashboard/metrics`

**Purpose**: Dashboard metrics for UI

**Output**:
```typescript
{
  work_orders: {
    total: number;
    by_status: { pending: number; approved: number; ... };
  };
  cost: {
    total: number;
    today: number;
    by_proposer: { [key: string]: number };
  };
  success_rates: {
    overall: number;
    by_proposer: { [key: string]: number };
  };
}
```

#### `GET /api/complexity-analytics`

**Purpose**: Complexity scoring analytics

**Output**:
```typescript
{
  average_complexity: number;
  distribution: {
    low: number;      // < 0.3
    medium: number;   // 0.3-0.7
    high: number;     // > 0.7
  };
  by_proposer: { [key: string]: { avg: number; count: number } };
}
```

#### `GET /api/patterns/metrics`

**Purpose**: Pattern success metrics

**Output**:
```typescript
{
  total_patterns: number;
  success_rate: number;
  top_patterns: Array<{
    pattern_id: string;
    success_count: number;
    confidence: number;
  }>;
}
```

#### `GET /api/admin/complexity-learning-metrics`

**Purpose**: Complexity learning system metrics

**Output**:
```typescript
{
  threshold_adjustments: Array<{
    proposer: string;
    old_threshold: number;
    new_threshold: number;
    reason: string;
  }>;
  outcome_aggregates: {
    total: number;
    by_complexity_band: { low: {...}, medium: {...}, high: {...} };
  };
}
```

**Location**: `src/app/api/`

---

### Utility APIs

#### `GET /api/budget`

**Purpose**: Get budget configuration

**Output**:
```typescript
{
  daily_limit: number;
  monthly_limit: number;
  per_work_order_limit: number;
}
```

#### `GET /api/budget-status`

**Purpose**: Current budget usage

**Output**:
```typescript
{
  daily: { spent: number; limit: number; remaining: number };
  monthly: { spent: number; limit: number; remaining: number };
  by_project: { [project_id: string]: { spent: number } };
}
```

#### `GET /api/config`

**Purpose**: System configuration

**Output**:
```typescript
{
  orchestrator: {
    max_concurrent_executions: number;
    poll_interval_ms: number;
  };
  worktree_pool: {
    enabled: boolean;
    size: number;
  };
  bootstrap: {
    enabled: boolean;
  };
}
```

#### `POST /api/llm`

**Purpose**: Direct LLM invocation (utility)

**Input**:
```typescript
{
  provider: 'anthropic' | 'openai';
  model: string;
  prompt: string;
  max_tokens?: number;
}
```

**Output**:
```typescript
{
  response: string;
  cost: number;
  tokens: { input: number; output: number };
}
```

#### `GET /api/escalations`

**Purpose**: List all escalations

**Output**:
```typescript
{
  escalations: Array<{
    id: string;
    work_order_id: string;
    severity: string;
    status: string;
    created_at: timestamptz;
  }>;
}
```

#### `GET /api/escalations/[id]`

**Purpose**: Get escalation details

**Output**:
```typescript
{
  escalation: Escalation;
  recommendation: ClientManagerRecommendation;
  resolution_history: Array<{...}>;
}
```

#### `POST /api/contracts/validate`

**Purpose**: Validate integration contracts

**Input**:
```typescript
{
  contracts: IntegrationContracts;
  work_order_id: string;
}
```

**Output**:
```typescript
{
  valid: boolean;
  violations: Array<{
    contract_type: string;
    issue: string;
  }>;
}
```

**Location**: `src/app/api/`

---

## Core Services

Moose's business logic is organized into **specialized services** in `src/lib/`.

### Service Categories

```
Agent Services:       7 files (architect, director, manager, proposer, orchestrator, sentinel, client-manager)
Bootstrap Services:   8 files (infrastructure setup for greenfield projects)
Learning Services:    4 files (supervised learning, outcome tracking)
Orchestrator Services: 15 files (execution pipeline coordination)
Validation Services:  6 files (acceptance, extraction, dependency validation)
Utility Services:     20+ files (LLM, GitHub, rate limiting, caching)
```

---

### Architect Services

#### Architecture Inference (`bootstrap-architecture-inferrer.ts`)

**Purpose**: Detects project framework and requirements

**Capabilities**:
- Framework detection (Next.js, React, generic TypeScript)
- Testing framework inference (Jest, Vitest, none)
- State management needs (Redux, Zustand, Context API)
- Build tool detection (Webpack, Vite, Turbopack)

**Example**:
```typescript
const inferredArchitecture = await inferArchitecture(projectPath);
// Output:
{
  framework: 'nextjs',
  testing_framework: 'jest',
  state_management: 'context_api',
  build_tool: 'turbopack'
}
```

---

#### Bootstrap System (`bootstrap/`)

**Purpose**: Creates project infrastructure for greenfield projects

**Files**:
- `bootstrap-executor.ts` - Executes WO-0 infrastructure setup
- `requirements-aggregator.ts` - Collects dependencies from all work orders
- `bootstrap-wo-generator.ts` - Generates WO-0
- `bootstrap-validator.ts` - Validates bootstrap output

**Bootstrap Flow**:
```
1. Detect empty project (no src/, no package.json)
2. Aggregate requirements from all work orders
   - npm_dependencies: ["react@18", "next@14"]
   - environment_variables: ["DATABASE_URL", "API_KEY"]
   - external_services: [{ name: "Supabase", env_vars: [...] }]
3. Generate WO-0 with aggregated requirements
4. Execute via Aider
5. Validate output:
   - package.json exists
   - All dependencies installed (npm install succeeds)
   - tsconfig.json valid
   - src/ directory created
6. Auto-fix missing package-lock.json
7. Update work orders to depend on WO-0
```

**Location**: `src/lib/bootstrap/`

---

#### Complexity Analysis (`complexity-analyzer.ts`, `complexity-estimator.ts`)

**Purpose**: Calculates work order complexity scores (0.0-1.0)

**Factors**:
```typescript
Complexity Factors:
- Description length (longer = more complex)
- Number of files in scope (> 5 files = +0.2)
- Number of dependencies (> 3 deps = +0.1 each)
- Keywords:
  - "authentication", "security" = +0.3
  - "database", "migration" = +0.2
  - "API", "endpoint" = +0.15
  - "refactor" = +0.1
- Context budget estimate (> 50K tokens = +0.2)
```

**Example**:
```typescript
const score = calculateComplexity(workOrder);
// 0.85 (high complexity → route to Claude Sonnet)
```

**Location**: `src/lib/`

---

#### Dependency Management (`dependency-validator.ts`, `dependency-resolver.ts`)

**Purpose**: Validates and resolves work order dependencies

**Capabilities**:
- Dependency graph validation (no cycles)
- Invalid reference detection (WO-10 depends on WO-99 which doesn't exist)
- Self-healing (auto-corrects invalid dependencies)
- Execution order calculation (topological sort)

**Example**:
```typescript
const validationResult = await validateDependencies(workOrders);
if (!validationResult.valid) {
  // Auto-repair invalid references
  const repaired = await repairDependencies(workOrders);
}

const executionOrder = calculateExecutionOrder(workOrders);
// Output: ["WO-0", "WO-1", "WO-3", "WO-2", ...] (dependency-aware)
```

**Location**: `src/lib/`

---

### Code Generation Services

#### Enhanced Proposer Service (`enhanced-proposer-service.ts`)

**Purpose**: LLM-based code generation with iterative refinement

**Pipeline**:
```
1. Load work order context
2. Apply prompt enhancements from database
3. Call LLM (Anthropic/OpenAI)
4. Sanitize output (remove markdown, fix syntax)
5. Count errors (TypeScript, lint, runtime)
6. If errors > 0 and cycles < 3:
   a. Inject error feedback
   b. Apply error-specific enhancements
   c. Call LLM again
   d. Repeat
7. Log failures to proposer_failures table
8. Return final output
```

**Refinement Logic** (`proposer-refinement-rules.ts`):
```typescript
Refinement Rules:
- Cycle 1: Add general error feedback
- Cycle 2: Apply prompt enhancements for specific error codes
- Cycle 3: Add "This is your last chance" urgency message
- Max 3 cycles to prevent cost explosion
```

**Location**: `src/lib/`

---

#### Code Sanitizer (`code-sanitizer.ts`)

**Purpose**: Cleans LLM output for direct code application

**Transformations**:
```typescript
Sanitizer Functions:
1. Remove markdown code blocks (```typescript ... ```)
2. Remove extraneous explanations
3. Fix common syntax errors:
   - Missing semicolons
   - Unclosed braces
   - Invalid imports
4. Normalize whitespace
5. Ensure proper file encoding (UTF-8)
```

**Example**:
```typescript
const dirtyOutput = `
\`\`\`typescript
function hello() {
  console.log("Hello")
}
\`\`\`
`;

const clean = sanitizeCode(dirtyOutput);
// Output: 'function hello() {\n  console.log("Hello");\n}'
```

**Location**: `src/lib/`

---

### Orchestration Services

#### Worktree Pool (`worktree-pool.ts`)

**Purpose**: Manages isolated git worktrees for concurrent execution

**Features**:
- Creates 15 worktrees on startup: `{project}/.moose-worktrees/wt-01` through `wt-15`
- Lease/release mechanism for concurrent execution
- Automatic cleanup on startup (configurable)
- Path isolation (each worktree has independent working directory)

**Usage**:
```typescript
const worktreePool = new WorktreePool(projectId, projectPath);
await worktreePool.initialize();

const worktree = await worktreePool.lease(workOrderId);
// worktree.path = "C:\dev\my-project\.moose-worktrees\wt-03"

// Execute work in worktree...
await executeAider(worktree.path, workOrderId);

await worktreePool.release(worktree.id);
```

**Location**: `src/lib/orchestrator/worktree-pool.ts`

---

#### Capacity Manager (`capacity-manager.ts`)

**Purpose**: Throttles concurrent executions to prevent resource exhaustion

**Limits**:
```typescript
Max Concurrent Executions: 15 (configurable)
Per-Model Rate Limits:
- claude-sonnet-4-5: 4 requests/minute (Anthropic tier 1)
- gpt-4o: 10 requests/minute (OpenAI tier 2)
- gpt-4o-mini: 30 requests/minute
```

**Implementation**:
```typescript
class CapacityManager {
  async acquireSlot(proposerName: string): Promise<boolean> {
    // Check global concurrency limit
    if (activeExecutions >= MAX_CONCURRENT) return false;

    // Check per-model rate limit
    if (rateLimitExceeded(proposerName)) return false;

    activeExecutions++;
    return true;
  }

  releaseSlot(proposerName: string) {
    activeExecutions--;
  }
}
```

**Location**: `src/lib/orchestrator/capacity-manager.ts`

---

#### Package Validator (`package-validator.ts`)

**Purpose**: Validates and corrects npm package versions across work orders

**Validation Rules**:
```typescript
Rules:
1. If same package in multiple WOs with different versions:
   → Use highest compatible version
2. If package conflicts with project's existing package.json:
   → Log warning, use project version
3. If invalid version format (e.g., "react@latest"):
   → Flag for review
4. If conflicting major versions (react@17 vs react@18):
   → Log warning, require human decision
```

**Correction Flow**:
```
1. Load project's package.json
2. For each work order:
   a. Extract npm_dependencies from technical_requirements
   b. Check against project's package.json
   c. Detect conflicts
   d. Auto-correct to highest version
   e. Log to package_version_corrections table
   f. Update work_order.technical_requirements in database
3. Return corrected work orders
```

**Example**:
```typescript
const validationResult = await validatePackages(workOrders, projectId);
// Corrections:
[
  {
    package_name: "next",
    old_version: "13.0.0",
    new_version: "14.0.0",
    correction_reason: "Higher version in WO-5"
  }
]
```

**Location**: `src/lib/orchestrator/package-validator.ts`

---

### Quality & Learning Services

#### Acceptance Validator (`acceptance-validator.ts`)

**Purpose**: 5-dimension quality scoring for work order validation

**Scoring Rubric** (0-2 per dimension):

```typescript
1. Correctness (0-2):
   - 2: Code runs without errors
   - 1: Minor issues, mostly functional
   - 0: Critical errors, doesn't run

2. Completeness (0-2):
   - 2: All acceptance criteria met
   - 1: Most criteria met, minor gaps
   - 0: Significant missing functionality

3. Code Quality (0-2):
   - 2: Passes lint, follows style guide
   - 1: Minor lint errors, acceptable style
   - 0: Major style issues, unreadable

4. Test Coverage (0-2):
   - 2: Tests included, good coverage
   - 1: Some tests, incomplete coverage
   - 0: No tests

5. Documentation (0-2):
   - 2: README updated, comments present
   - 1: Minimal documentation
   - 0: No documentation

Total Score: 0-10
Pass Threshold: 7
```

**Implementation**:
```typescript
const result = await validateAcceptance(workOrder, prNumber);
// Output:
{
  correctness: 2,
  completeness: 2,
  code_quality: 1,
  test_coverage: 2,
  documentation: 1,
  total_score: 8,
  pass: true
}
```

**Location**: `src/lib/acceptance-validator.ts`

---

#### Iteration Scorer (`iteration-scorer.ts`)

**Purpose**: Scores complete test iterations for supervised learning

**Scoring**:
```typescript
Overall Score (1-10) = Weighted Average:
- Architecture (20%): Code organization, separation of concerns
- Readability (15%): Variable names, comments, clarity
- Completeness (25%): All features implemented
- Test Coverage (20%): Tests exist and pass
- User Experience (20%): UI/UX quality
```

**Location**: `src/lib/iteration-scorer.ts`

---

#### Complexity Weight Adjuster (`learning/complexity-weight-adjuster.ts`)

**Purpose**: Auto-adjusts complexity thresholds based on outcomes

**Logic**:
```typescript
If proposer has < 70% success rate in complexity band:
  → Increase threshold (shift easier work to this proposer)
If proposer has > 95% success rate in complexity band:
  → Decrease threshold (shift harder work to this proposer)
```

**Example**:
```typescript
// gpt-4o-mini failing on medium complexity (0.3-0.5)
// Adjust threshold from 0.3 → 0.4 (shift easier work to this model)
const adjustment = await adjustComplexityWeights();
```

**Location**: `src/lib/learning/complexity-weight-adjuster.ts`

---

### Utility Services

#### LLM Service (`llm-service.ts`)

**Purpose**: Unified interface for Anthropic & OpenAI APIs

**Features**:
- Single interface for both providers
- Automatic cost calculation
- Token usage tracking
- Error handling and retries
- Streaming support

**Usage**:
```typescript
const llmService = new LLMService();

const response = await llmService.generate({
  provider: 'anthropic',
  model: 'claude-sonnet-4-5-20250929',
  prompt: 'Write a React component...',
  max_tokens: 4000
});

// response.text: Generated code
// response.cost: 0.045 (USD)
// response.tokens: { input: 1200, output: 2800 }
```

**Location**: `src/lib/llm-service.ts`

---

#### Rate Limiter (`rate-limiter.ts`)

**Purpose**: API rate limiting to prevent quota exhaustion

**Configuration**:
```typescript
Rate Limits:
- architect: 4 requests/minute (Claude Sonnet tier 1)
- proposer-claude: 4 requests/minute
- proposer-gpt-4o: 10 requests/minute
- proposer-gpt-4o-mini: 30 requests/minute
```

**Implementation**:
```typescript
class RateLimiter {
  async waitForSlot(endpoint: string): Promise<void> {
    const limit = RATE_LIMITS[endpoint];
    const requests = requestHistory[endpoint];

    // Filter requests in last minute
    const recentRequests = requests.filter(t => Date.now() - t < 60000);

    if (recentRequests.length >= limit) {
      const oldestRequest = Math.min(...recentRequests);
      const waitTime = 60000 - (Date.now() - oldestRequest);
      await sleep(waitTime);
    }

    requestHistory[endpoint].push(Date.now());
  }
}
```

**Location**: `src/lib/rate-limiter.ts`

---

## External Integrations

Moose integrates with 4 external systems for LLM inference, code application, and version control.

---

### Anthropic Claude

**Purpose**: Primary LLM for high-complexity tasks

**Models**:
- `claude-sonnet-4-5-20250929` (primary)
  - Context: 200K tokens
  - Output: 64K tokens
  - Cost: $15 input / $75 output per 1M tokens

**Usage**:
- Architect decomposition (all projects)
- High-complexity proposer (complexity >= 1.0)
- Client Manager recommendations

**API**: Anthropic Messages API v1

**Location**: `src/lib/llm-service.ts`

---

### OpenAI GPT

**Purpose**: Cost-effective LLM for low/medium-complexity tasks

**Models**:
- `gpt-4o` (medium complexity)
  - Context: 128K tokens
  - Cost: $5 input / $15 output per 1M tokens
- `gpt-4o-mini` (low complexity)
  - Context: 128K tokens
  - Cost: $0.15 input / $0.60 output per 1M tokens

**Usage**:
- Low-complexity proposer (0.3 <= complexity < 0.7)
- Medium-complexity proposer (0.7 <= complexity < 1.0)

**API**: OpenAI Chat Completions API

**Location**: `src/lib/llm-service.ts`

---

### GitHub

**Integrations**:

1. **GitHub CLI (`gh`)**
   - PR creation
   - Branch management
   - Issue tracking

2. **Octokit REST API**
   - Workflow results fetching
   - Test log retrieval
   - Webhook handling

**Usage Flow**:
```
1. Aider commits code to branch
2. Orchestrator runs: gh pr create --title "WO-123: Feature" --body "..."
3. Sentinel runs: octokit.rest.actions.listWorkflowRunsForRepo()
4. Parse workflow results for quality validation
```

**Authentication**:
- Environment variable: `GITHUB_PERSONAL_ACCESS_TOKEN`
- Scopes required: `repo`, `workflow`

**Location**: `src/lib/github-client.ts`, `src/lib/orchestrator/github-integration.ts`

---

### Aider

**Purpose**: Git-based code editor that applies LLM-generated code

**Integration**: Child process execution

**Command**:
```bash
aider \
  --yes \
  --message "Apply code from WO-123" \
  --file src/components/Button.tsx \
  --model gpt-4o
```

**Flow**:
```
1. Orchestrator creates git branch: feature/wo-{id}
2. Orchestrator calls aider with:
   - Generated code from Proposer
   - Files in scope
   - Work order description
3. Aider:
   a. Reads existing code
   b. Applies changes via LLM
   c. Commits to branch
4. Orchestrator pushes branch to origin
```

**Timeout**: 5-15 minutes (configurable)

**Error Handling**:
- Timeout → escalate to Client Manager
- Git conflict → escalate with conflict details
- LLM error → retry with different model

**Location**: `src/lib/orchestrator/aider-executor.ts`

---

### Supabase

**Purpose**: Database (PostgreSQL) and authentication

**Integrations**:
- **Database**: PostgreSQL 15 with RLS
- **Auth**: Row-level security policies
- **Storage**: Wireframe storage (currently broken)

**Client**:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

**Usage**:
- All data storage (projects, work_orders, etc.)
- Authentication (not currently used)
- File storage for wireframes (broken)

**Location**: `src/lib/supabase-client.ts`

---

## Data Flow & Workflows

### Complete Work Order Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. USER SUBMITS SPECIFICATION                                    │
│    - POST /api/architect/decompose                               │
│    - Input: TechnicalSpec { feature_name, objectives, ... }     │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. ARCHITECT DECOMPOSES                                          │
│    - Calls Claude Sonnet 4.5                                     │
│    - Breaks into 5-50 work orders                                │
│    - Generates dependency graph                                  │
│    - Detects bootstrap needs (greenfield project)                │
│    - Output: DecompositionOutput + 53 work orders                │
│    - Cost: ~$0.82, Time: 5 minutes                               │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. BOOTSTRAP INJECTION (if greenfield)                           │
│    - Requirements Aggregator collects dependencies from all WOs  │
│    - Bootstrap WO Generator creates WO-0                         │
│    - Bootstrap Executor runs Aider to create infrastructure      │
│    - Validates output (package.json, tsconfig.json, src/)        │
│    - Auto-fixes missing package-lock.json                        │
│    - Updates work orders to depend on WO-0                       │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. WORK ORDERS STORED IN DATABASE                                │
│    - Status: 'pending'                                           │
│    - Inserted into work_orders table                             │
│    - decomposition_metadata record created                       │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ 5. DIRECTOR APPROVES                                             │
│    - Calculates risk level per work order                        │
│    - Auto-approves low-risk work orders                          │
│    - Routes high-risk to human approval                          │
│    - Updates status: 'approved'                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ 6. ORCHESTRATOR POLLS (every 10 seconds)                         │
│    - Query: SELECT * FROM work_orders WHERE status = 'approved'  │
│    - Picks up approved work orders                               │
│    - Checks capacity (max 15 concurrent)                         │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ 7. MANAGER ROUTES                                                │
│    - Calculates complexity score                                 │
│    - Selects proposer (e.g., claude-sonnet-4-5)                  │
│    - Reserves budget atomically (check_and_reserve_budget())     │
│    - Output: RoutingDecision                                     │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ 8. PACKAGE VALIDATOR CORRECTS                                    │
│    - Loads project's package.json                                │
│    - Checks work order's npm_dependencies                        │
│    - Auto-corrects version conflicts                             │
│    - Logs to package_version_corrections table                   │
│    - Updates work_order.technical_requirements                   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ 9. PROPOSER GENERATES CODE                                       │
│    - Loads work order context (dependencies, files)              │
│    - Applies prompt enhancements from database                   │
│    - Calls LLM (Claude/GPT)                                      │
│    - Iterative refinement (up to 3 cycles)                       │
│    - Code sanitization                                           │
│    - Output: EnhancedProposerResponse { code, cost, ... }        │
│    - Cost: ~$0.10-$2.50                                          │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ 10. WORKTREE POOL LEASES                                         │
│    - Find available worktree (wt-01 to wt-15)                    │
│    - Mark as leased to work order                                │
│    - Path: {project}/.moose-worktrees/wt-03                      │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ 11. AIDER APPLIES CODE                                           │
│    - Create git branch: feature/wo-abc123                        │
│    - Run aider with generated code                               │
│    - Aider commits changes with metadata                         │
│    - Branch pushed to origin                                     │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ 12. GITHUB INTEGRATION CREATES PR                                │
│    - Run: gh pr create --title "WO-123" --body "..."             │
│    - PR body includes:                                           │
│      - Work order description                                    │
│      - Acceptance criteria                                       │
│      - Files modified                                            │
│    - Labels: auto-generated, work-order-123                      │
│    - Output: PR URL, PR number                                   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ 13. ACCEPTANCE VALIDATOR SCORES                                  │
│    - 5-dimension scoring (0-2 each):                             │
│      1. Correctness                                              │
│      2. Completeness                                             │
│      3. Code Quality                                             │
│      4. Test Coverage                                            │
│      5. Documentation                                            │
│    - Total score: 0-10                                           │
│    - Pass threshold: 7                                           │
│    - Stored in work_order.acceptance_result                      │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ 14. SENTINEL MONITORS (optional)                                 │
│    - Fetch GitHub Actions workflow results                       │
│    - Parse test output (Jest/Vitest)                             │
│    - Flaky test detection                                        │
│    - Confidence scoring                                          │
│    - Output: SentinelDecision (pass/fail)                        │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                 ┌───────────┴───────────┐
                 │                       │
                 ▼                       ▼
         ┌─────────────┐       ┌─────────────────┐
         │   SUCCESS   │       │     FAILURE     │
         │  (status:   │       │  (status:       │
         │  completed) │       │  failed)        │
         └──────┬──────┘       └────────┬────────┘
                │                       │
                ▼                       ▼
┌──────────────────────────┐   ┌───────────────────────────────────┐
│ 15a. RESULT TRACKER      │   │ 15b. CLIENT MANAGER ESCALATES     │
│    - Insert into         │   │    - Create escalation record     │
│      outcome_vectors     │   │    - Generate resolution options  │
│    - Update cost         │   │    - Notify human                 │
│    - Release worktree    │   │    - Wait for decision            │
└──────────────────────────┘   └───────────────────────────────────┘
```

---

### Bootstrap Flow (Greenfield Projects)

```
USER SUBMITS SPEC FOR NEW PROJECT (empty directory)
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│ ARCHITECT DETECTS GREENFIELD                                   │
│ - No src/ directory                                            │
│ - No package.json                                              │
│ - bootstrap_needed = true                                      │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ ARCHITECTURE INFERRER ANALYZES SPEC                            │
│ - Framework: Next.js (detected from "web app", "React")        │
│ - Testing: Jest (default for Next.js)                          │
│ - State: Context API (simple app)                              │
│ Output: InferredArchitecture                                   │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ REQUIREMENTS AGGREGATOR COLLECTS FROM ALL WOs                  │
│ - WO-1: ["react@18", "next@14"]                                │
│ - WO-2: ["@supabase/supabase-js@2"]                            │
│ - WO-3: ["typescript@5"]                                       │
│ Aggregated:                                                    │
│ {                                                              │
│   npm_dependencies: ["react@18", "next@14", ...]              │
│   npm_dev_dependencies: ["typescript@5", "@types/react"]      │
│   environment_variables: ["NEXT_PUBLIC_SUPABASE_URL", ...]    │
│   external_services: [{ name: "Supabase", ... }]              │
│ }                                                              │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ BOOTSTRAP WO GENERATOR CREATES WO-0                            │
│ Title: "Bootstrap Next.js project infrastructure"             │
│ Description: "Create package.json, tsconfig.json, src/, ..."   │
│ Files in scope: ["package.json", "tsconfig.json", ...]        │
│ Technical requirements: { ...aggregated requirements }         │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ FEATURE WOs UPDATED                                            │
│ - Add dependency: "WO-0" to all feature work orders            │
│ - Ensures bootstrap runs first                                 │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ ORCHESTRATOR EXECUTES WO-0                                     │
│ - Manager routes to claude-sonnet-4-5 (high priority)          │
│ - Proposer generates package.json, tsconfig.json, etc.         │
│ - Aider applies code                                           │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ BOOTSTRAP VALIDATOR CHECKS                                     │
│ ✓ package.json exists                                          │
│ ✓ All dependencies listed in package.json                      │
│ ✓ tsconfig.json valid JSON                                     │
│ ✓ src/ directory created                                       │
│ ✓ npm install succeeds                                         │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ AUTO-FIX MISSING PACKAGE-LOCK.JSON                             │
│ - Run: npm install (generates package-lock.json)               │
│ - Commit to bootstrap branch                                   │
│ - Push to origin                                               │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ BOOTSTRAP COMPLETE                                             │
│ - Update decomposition_metadata:                               │
│   bootstrap_executed = true                                    │
│   bootstrap_commit_hash = "abc123..."                          │
│ - Feature WOs now unblocked (dependency satisfied)             │
└────────────────────────────────────────────────────────────────┘
```

---

### Package Validation Flow

```
WORK ORDER HAS TECHNICAL REQUIREMENTS
{
  npm_dependencies: ["react@18.2.0", "next@14.0.0"]
}
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│ PACKAGE VALIDATOR RUNS PRE-PROPOSER                            │
│ - Load project's package.json                                  │
│ - Extract existing dependencies:                               │
│   { "next": "13.0.0", "react": "18.1.0" }                      │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ DETECT CONFLICTS                                               │
│ - next@14.0.0 (WO) vs next@13.0.0 (project) → CONFLICT        │
│ - react@18.2.0 (WO) vs react@18.1.0 (project) → PATCH DIFF    │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ APPLY VALIDATION RULES                                         │
│ Rule 1: Same package, different versions → Use highest         │
│   next@14.0.0 (higher) ✓                                       │
│   react@18.2.0 (higher) ✓                                      │
│                                                                │
│ Rule 2: Conflicting major versions → Log warning               │
│   (not applicable here)                                        │
│                                                                │
│ Rule 3: Invalid version format → Flag                          │
│   (not applicable here)                                        │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ AUTO-CORRECTION                                                │
│ - Update WO technical_requirements:                            │
│   npm_dependencies: ["react@18.2.0", "next@14.0.0"]           │
│                     (no change, already highest)               │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ LOG CORRECTIONS                                                │
│ INSERT INTO package_version_corrections:                       │
│ {                                                              │
│   project_id: "...",                                           │
│   work_order_id: "...",                                        │
│   package_name: "next",                                        │
│   old_version: "14.0.0",                                       │
│   new_version: "14.0.0",                                       │
│   correction_reason: "Validated against project",             │
│   confidence_level: "high"                                     │
│ }                                                              │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ UPDATE DATABASE                                                │
│ UPDATE work_orders                                             │
│ SET technical_requirements = {...corrected requirements}       │
│ WHERE id = work_order_id;                                      │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────────────┐
│ PROPOSER RECEIVES CORRECTED REQUIREMENTS                       │
│ - Generates code with consistent dependencies                  │
│ - No version conflicts in final output                         │
└────────────────────────────────────────────────────────────────┘
```

---

## Type System

Moose uses TypeScript with strict type checking. Key type definitions in `src/types/`.

### Type Files

```
src/types/
├── architect.ts           # Architect types (320 lines)
├── supabase.ts            # Database schema (1538 lines - auto-generated)
├── sentinel.ts            # Sentinel types (85 lines)
├── client-manager.ts      # Client Manager types (120 lines)
├── orchestrator.ts        # Orchestrator types (95 lines)
├── learning.ts            # Learning system types (75 lines)
└── common.ts              # Shared types (45 lines)
```

---

### Key Type Definitions

#### Architect Types (`architect.ts`)

```typescript
// Input specification
interface TechnicalSpec {
  feature_name: string;
  objectives: string[];
  constraints: string[];
  acceptance_criteria: string[];
  budget_estimate?: number;
  time_estimate?: string;
}

// Work order structure
interface WorkOrder {
  title: string;
  description: string;
  acceptance_criteria: string[];
  files_in_scope: string[];
  context_budget_estimate: number;
  risk_level: "low" | "medium" | "high";
  dependencies: string[];  // ["WO-0", "WO-1"]
  wireframe?: WireframeMetadata;
  contracts?: IntegrationContracts;
  technical_requirements?: TechnicalRequirements;
}

// Technical requirements
interface TechnicalRequirements {
  npm_dependencies?: string[];        // ["react@18", "next@14"]
  npm_dev_dependencies?: string[];    // ["typescript@5", "@types/react"]
  environment_variables?: string[];   // ["DATABASE_URL", "API_KEY"]
  external_services?: Array<{
    name: string;                     // "Supabase"
    env_vars: string[];               // ["NEXT_PUBLIC_SUPABASE_URL"]
    purpose: string;                  // "Database and auth"
  }>;
  tsconfig_requirements?: object;     // { "compilerOptions": {...} }
}

// Decomposition output
interface DecompositionOutput {
  work_orders: WorkOrder[];
  decomposition_doc: string;
  total_estimated_cost: number;
  wireframe_cost?: number;
  contract_cost?: number;
  contracts?: IntegrationContracts;
}

// Integration contracts
interface IntegrationContracts {
  api_contracts?: APIContract[];
  ipc_contracts?: IPCContract[];
  state_contracts?: StateContract[];
  file_contracts?: FileContract[];
  database_contracts?: DatabaseContract[];
}

interface APIContract {
  endpoint: string;                   // "/api/users"
  method: "GET" | "POST" | "PUT" | "DELETE";
  request_schema: object;             // JSON schema
  response_schema: object;
  work_order_id: string;
}
```

---

#### Supabase Types (`supabase.ts`)

Auto-generated from Supabase schema. Contains full database type definitions.

```typescript
// Example: work_orders table
interface Database {
  public: {
    Tables: {
      work_orders: {
        Row: {
          id: string;
          title: string;
          description: string;
          status: string;
          risk_level: string;
          // ... all columns
        };
        Insert: {
          id?: string;
          title: string;
          // ... required fields
        };
        Update: {
          id?: string;
          title?: string;
          // ... optional fields
        };
      };
      // ... all tables
    };
    Enums: {
      failure_class_enum:
        | "compile_error"
        | "contract_violation"
        | "test_fail"
        // ... all values
    };
  };
}
```

---

#### Sentinel Types (`sentinel.ts`)

```typescript
interface SentinelDecision {
  verdict: 'pass' | 'fail';
  confidence: number;                 // 0.0-1.0
  reasoning: string;
  test_results: TestOutput | null;
  workflow_results: WorkflowResult[];
  escalation_required: boolean;
  escalation_reason?: string;
}

interface TestOutput {
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  failures: Array<{
    test_name: string;
    error_message: string;
    stack_trace: string;
  }>;
}

interface WorkflowResult {
  workflow_name: string;              // "CI"
  status: 'success' | 'failure' | 'cancelled';
  conclusion: string;
  duration_ms: number;
  logs_url: string;
}
```

---

#### Client Manager Types (`client-manager.ts`)

```typescript
interface EscalationTrigger {
  trigger_type:
    | 'proposer_exhausted'
    | 'sentinel_hard_failure'
    | 'budget_overrun'
    | 'conflicting_requirements'
    | 'technical_blocker'
    | 'contract_violation'
    | 'aider_irreconcilable';
  work_order_id: string;
  agent_name: string;
  failure_count: number;
  context: {
    error_messages: string[];
    cost_spent_so_far: number;
    attempts_history: Array<{
      attempt_number: number;
      proposer_used: string;
      cost: number;
      outcome: string;
    }>;
    current_state: string;
    blocking_issue: string;
  };
}

interface ResolutionOption {
  option_id: string;
  strategy:
    | 'retry_different_approach'
    | 'pivot_solution'
    | 'amend_upstream'
    | 'abort_redesign'
    | 'manual_intervention';
  description: string;
  estimated_cost: number;
  success_probability: number;        // 0.0-1.0
  time_to_resolution: string;         // "5 minutes", "2 hours"
  risk_assessment: {
    technical_risk: 'low' | 'medium' | 'high';
    cost_risk: 'low' | 'medium' | 'high';
    time_risk: 'low' | 'medium' | 'high';
  };
  execution_steps: string[];
}

interface ClientManagerRecommendation {
  escalation_id: string;
  resolution_options: ResolutionOption[];
  recommended_option_id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  human_decision_required: boolean;
}
```

---

## Configuration

### Environment Variables

**Required**:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# LLM APIs
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# GitHub
GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...
```

**Optional**:
```bash
# Orchestrator
ORCHESTRATOR_MAX_CONCURRENT_EXECUTIONS=15
ORCHESTRATOR_POLL_INTERVAL_MS=10000

# Worktree Pool
WORKTREE_POOL_ENABLED=true
WORKTREE_POOL_SIZE=15
WORKTREE_CLEANUP_ON_STARTUP=false

# Bootstrap
DISABLE_BOOTSTRAP_INJECTION=false

# Aider
AIDER_TIMEOUT_MS=300000              # 5 minutes
AIDER_MODEL=gpt-4o

# Rate Limiting
ARCHITECT_RATE_LIMIT_RPM=4
PROPOSER_CLAUDE_RATE_LIMIT_RPM=4
PROPOSER_GPT_RATE_LIMIT_RPM=10

# Budget
DAILY_BUDGET_LIMIT_USD=100
PER_WORK_ORDER_BUDGET_LIMIT_USD=5
```

---

### Configuration Files

#### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

---

#### `package.json` (Key Scripts)

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "orchestrator": "tsx scripts/orchestrator-daemon.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "type-check": "tsc --noEmit"
  }
}
```

---

## Deployment & Operations

### Development

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# 3. Start Next.js dev server
npm run dev
# → http://localhost:3000

# 4. Start orchestrator daemon (separate terminal)
npm run orchestrator
# → Polls database every 10s
```

---

### Production

**Next.js App** (Vercel/similar):
```bash
# Build
npm run build

# Start production server
npm start
# → http://localhost:3000
```

**Orchestrator Daemon** (systemd service):

```ini
# /etc/systemd/system/moose-orchestrator.service
[Unit]
Description=Moose Mission Control Orchestrator
After=network.target

[Service]
Type=simple
User=moose
WorkingDirectory=/opt/moose-mission-control
ExecStart=/usr/bin/node /opt/moose-mission-control/dist/scripts/orchestrator-daemon.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="NODE_ENV=production"
EnvironmentFile=/opt/moose-mission-control/.env

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable moose-orchestrator
sudo systemctl start moose-orchestrator

# Check status
sudo systemctl status moose-orchestrator

# View logs
sudo journalctl -u moose-orchestrator -f
```

---

### Monitoring

**Health Endpoints**:
- `GET /api/health` - Basic health check
- `GET /api/admin/health` - Detailed metrics
- `GET /api/orchestrator` - Orchestrator status

**Dashboard**:
- Navigate to `/admin` for real-time system status
- View active executions, queue length, budget usage

**Logs**:
- Next.js logs: `stdout/stderr` or Vercel logs
- Orchestrator logs: `journalctl -u moose-orchestrator`
- Database logs: Supabase dashboard

---

### Maintenance

**Database Cleanup**:
```sql
-- Archive completed work orders older than 30 days
UPDATE work_orders
SET status = 'archived'
WHERE status = 'completed'
  AND completed_at < NOW() - INTERVAL '30 days';

-- Prune old decision logs
DELETE FROM decision_logs
WHERE created_at < NOW() - INTERVAL '90 days';
```

**Worktree Cleanup**:
```bash
# Manual cleanup
npm run orchestrator -- --cleanup

# Or set in .env:
WORKTREE_CLEANUP_ON_STARTUP=true
```

**Budget Reset** (daily cron job):
```bash
# /etc/cron.daily/moose-budget-reset
#!/bin/bash
psql $DATABASE_URL -c "UPDATE cost_tracking SET daily_spent = 0 WHERE date < CURRENT_DATE;"
```

---

## Security & Safety

### Safety Mechanisms

**Isolation Verification**:
- Moose must NEVER modify its own files
- Tracked in `test_iterations.moose_files_modified` (must be `false`)
- Pre-execution check: Is file in `src/lib/orchestrator/` or `src/lib/architect/`? → Reject

**Budget Controls**:
- Pre-execution budget reservation (`check_and_reserve_budget()`)
- Daily budget limits ($100 default)
- Per-work-order limits ($5 default)
- Emergency kill switch (set `DAILY_BUDGET_LIMIT_USD=0`)

**Input Sanitization**:
- SQL injection prevention (parameterized queries)
- Path traversal checks (reject `../` in file paths)
- Security threat detection (reject prompts with "ignore previous instructions")

---

### Row-Level Security (RLS)

All Supabase tables have RLS enabled:

```sql
-- Example: work_orders table
CREATE POLICY "Authenticated users can read work orders"
ON work_orders FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can write work orders"
ON work_orders FOR INSERT
USING (auth.role() = 'service_role');
```

**Access Levels**:
- **Authenticated users**: Read-only access
- **Service role**: Full access (used by Moose backend)
- **Anon users**: No access

---

### API Security

**Authentication**:
- Supabase JWT tokens for user authentication (not currently used)
- Service role key for backend operations

**Rate Limiting**:
- See `src/lib/rate-limiter.ts`
- Per-endpoint limits to prevent abuse

**Input Validation**:
- Zod schemas for all API inputs
- Type checking with TypeScript

---

## Performance & Cost

### Performance Metrics

**Decomposition**:
- 5 minutes for 53 work orders
- $0.82 total cost
- Claude Sonnet 4.5 (200K context)

**Execution**:
- 5-15 minutes per work order
- Depends on complexity and proposer model

**Concurrency**:
- 15 simultaneous work orders (worktree pool)
- ~3-4 work orders/minute throughput

---

### Cost Breakdown

**Per Work Order**:
- **Low complexity** (gpt-4o-mini): ~$0.10
- **Medium complexity** (gpt-4o): ~$0.50
- **High complexity** (claude-sonnet-4-5): ~$2.50

**Complete Project** (53 work orders):
- Decomposition: $0.82
- Execution: ~$15 (avg $0.28/WO)
- **Total: ~$17**

**Human Equivalent**:
- Estimated human cost: $16,000 (100 hours @ $160/hr)
- **Cost savings: 940x**

---

### Optimization Strategies

**Cost Optimization**:
1. Use complexity-based routing (low complexity → cheap models)
2. Limit refinement cycles (max 3)
3. Batch decomposition for large projects
4. Cache LLM responses (not implemented)

**Performance Optimization**:
1. Concurrent execution (15 worktrees)
2. Dependency-aware execution order
3. Worktree pool (no git clone overhead)
4. Rate limiting to prevent throttling

---

## Testing & Quality

### Test Structure

**Unit Tests** (`src/lib/__tests__/`):
- Extraction validator tests
- Failure mode tests
- Wireframe service tests

**Integration Tests** (`src/lib/orchestrator/__tests__/`):
- Aider executor tests
- GitHub integration tests
- Manager coordinator tests
- Proposer executor tests
- Result tracker tests
- Worktree pool tests

**Scripts** (`scripts/`):
- 100+ test and validation scripts
- Bootstrap validation
- Work order approval automation
- Acceptance validation

---

### Quality Metrics

**5-Dimension Acceptance Scoring**:

| Dimension | Weight | Max Score | Description |
|-----------|--------|-----------|-------------|
| Correctness | 25% | 2 | Code runs without errors |
| Completeness | 25% | 2 | All acceptance criteria met |
| Code Quality | 20% | 2 | Passes lint, follows style |
| Test Coverage | 15% | 2 | Tests included and pass |
| Documentation | 15% | 2 | README/comments present |

**Total Score**: 0-10 (threshold: 7 for auto-pass)

---

### Supervised Learning

**Test Iterations**:
- Complete project builds tracked in `test_iterations` table
- Quality scoring (1-10 scale)
- Failure analysis
- Improvement tracking

**Metrics Tracked**:
- Architecture score
- Readability score
- Completeness score
- Test coverage score
- User experience score
- Build success
- Moose isolation (files modified)

---

## File Structure Reference

### Critical Files (Top 50)

**Orchestrator** (15 files):
1. `src/lib/orchestrator/orchestrator-service.ts` - Main coordinator
2. `src/lib/orchestrator/work-order-poller.ts` - Database polling
3. `src/lib/orchestrator/manager-coordinator.ts` - Manager integration
4. `src/lib/orchestrator/proposer-executor.ts` - Proposer integration
5. `src/lib/orchestrator/aider-executor.ts` - Code application
6. `src/lib/orchestrator/github-integration.ts` - PR creation
7. `src/lib/orchestrator/result-tracker.ts` - Outcome storage
8. `src/lib/orchestrator/worktree-pool.ts` - Isolation system
9. `src/lib/orchestrator/package-validator.ts` - Dependency validation
10. `src/lib/orchestrator/capacity-manager.ts` - Concurrency control

**Agent Services** (7 files):
11. `src/lib/architect-service.ts` - Spec decomposition
12. `src/lib/director-service.ts` - Approval authority
13. `src/lib/manager-service.ts` - Routing logic
14. `src/lib/enhanced-proposer-service.ts` - Code generation
15. `src/lib/sentinel/sentinel-service.ts` - Quality gate
16. `src/lib/client-manager-service.ts` - Escalation handling
17. `src/lib/batched-architect-service.ts` - Large project batching

**Bootstrap** (8 files):
18. `src/lib/bootstrap/bootstrap-executor.ts` - Infrastructure setup
19. `src/lib/bootstrap/bootstrap-wo-generator.ts` - WO-0 generation
20. `src/lib/bootstrap/requirements-aggregator.ts` - Dependency collection
21. `src/lib/bootstrap/bootstrap-architecture-inferrer.ts` - Framework detection

**Validation** (6 files):
22. `src/lib/acceptance-validator.ts` - Quality validation
23. `src/lib/dependency-validator.ts` - Dependency graph validation
24. `src/lib/extraction-validator.ts` - JSON extraction
25. `src/lib/code-sanitizer.ts` - Output cleaning

**Utilities** (14 files):
26. `src/lib/llm-service.ts` - LLM abstraction
27. `src/lib/github-client.ts` - GitHub API wrapper
28. `src/lib/rate-limiter.ts` - API rate limiting
29. `src/lib/config-services.ts` - Configuration management
30. `src/lib/cache.ts` - Response caching
31. `src/lib/complexity-analyzer.ts` - Complexity scoring
32. `src/lib/proposer-registry.ts` - Model configuration

**Types** (7 files):
33. `src/types/supabase.ts` - Database schema (1538 lines)
34. `src/types/architect.ts` - Architect types (320 lines)
35. `src/types/sentinel.ts` - Sentinel types
36. `src/types/client-manager.ts` - Client Manager types

**API Routes** (33 endpoints):
37. `src/app/api/architect/decompose/route.ts`
38. `src/app/api/director/approve/route.ts`
39. `src/app/api/manager/route.ts`
40. `src/app/api/proposer-enhanced/route.ts`
41. `src/app/api/orchestrator/route.ts`
42. `src/app/api/sentinel/route.ts`
43. `src/app/api/client-manager/escalate/route.ts`

**Scripts**:
44. `scripts/orchestrator-daemon.ts` - Background daemon

**UI Components**:
45. `src/components/MissionControlDashboard.tsx` - Main dashboard
46. `src/components/MonitoringDashboard.tsx` - Health dashboard

**Database**:
47. `supabase/migrations/20251017_phase2_supervised_learning.sql`
48. `supabase/migrations/20251024_package_validation_tracking.sql`

---

## Conclusion

Moose Mission Control represents a comprehensive autonomous software development system that successfully demonstrates:

- **Cost Efficiency**: 940x cost reduction vs human development
- **Scalability**: 15 concurrent executions with isolated environments
- **Quality**: 5-dimension automated validation with human escalation
- **Safety**: Isolation verification, budget controls, RLS
- **Learning**: Continuous improvement through outcome tracking
- **Reliability**: Multi-level approval, rollback mechanisms, failure recovery

**Key Success Metrics**:
- ✅ 53 work orders decomposed in 5 minutes
- ✅ ~$17 total project cost (vs $16,000 human)
- ✅ 15 concurrent executions
- ✅ 5-dimension quality validation
- ✅ Bootstrap system for greenfield projects
- ✅ Package validation and auto-correction
- ✅ Supervised learning with human feedback

**Architecture Highlights**:
- Hierarchical agent system with clear separation of concerns
- Rule-based routing for determinism
- LLM-based code generation with iterative refinement
- Git-based isolation with worktree pools
- Learning system for continuous improvement

---

**Version**: v134
**Last Updated**: 2025-10-24
**Maintained By**: Moose Mission Control Team
**License**: Proprietary
