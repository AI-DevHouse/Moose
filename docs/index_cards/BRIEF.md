# Moose Mission Control — Project Brief

**Version:** v138
**Purpose:** Stable semantic context for all sessions
**Load when:** Starting any session or when architecture questions arise

---

## Product

**Moose Mission Control** is an AI-powered orchestration system that decomposes user feature requests into atomic Work Orders (WOs), executes them via AI agents (Proposer + Aider), and validates results through multi-dimensional acceptance scoring.

**Goal:** Fully autonomous software development from natural language requirements to merged PRs.

---

## Architecture (Core Components)

### 1. Architect Service
- **Role:** Decomposes high-level features into atomic Work Orders
- **Input:** User requirements (natural language)
- **Output:** Dependency-ordered WO graph with technical requirements
- **Key logic:** `src/lib/architect-service.ts`, `src/lib/architect-decomposition-rules.ts`

### 2. Bootstrap System
- **Role:** Aggregates technical requirements across all WOs to create project foundation
- **What it creates:** `package.json`, `tsconfig.json`, `src/` directory structure, committed to main branch
- **Constraint:** Bootstrap must execute before any other WOs
- **Key logic:** `src/lib/bootstrap/requirements-aggregator.ts`, `scripts/manual-bootstrap-mld.ts`

### 3. Orchestrator Service
- **Role:** Polls for pending approved WOs and executes them through the pipeline
- **Pipeline:** Poll → Manager (routing) → Proposer (code gen) → Aider (apply) → GitHub (PR) → Acceptance Validation → Track results
- **Concurrency:** Worktree pool provides isolated execution environments
- **Key logic:** `src/lib/orchestrator/orchestrator-service.ts`

### 4. Worktree Pool Manager
- **Role:** Manages N isolated git worktrees (default 15) for concurrent WO execution
- **Why:** Prevents file-level race conditions when multiple Aider instances run simultaneously
- **Lifecycle:** Lease → Execute → Cleanup (reset to main, delete branches)
- **Key logic:** `src/lib/orchestrator/worktree-pool.ts`

### 5. Proposer (Claude-based code generation)
- **Role:** Generates code diffs based on WO technical requirements
- **Output:** Unified diffs or full file contents
- **Key logic:** `src/lib/orchestrator/proposer-executor.ts`

### 6. Aider (Code application)
- **Role:** Applies Proposer-generated code to working directory
- **Execution:** Runs in isolated worktree
- **Key logic:** `src/lib/orchestrator/aider-executor.ts`

### 7. Acceptance Validator (5-Dimension Quality Scoring)
- **Role:** Scores completed WOs across: unit tests, integration tests, type safety, linting, edge cases
- **Decision:** Accept (≥70% score) or escalate for human review
- **Key logic:** `src/lib/acceptance-validator.ts`

---

## Data Flow

```
User Request
  → Architect (decompose)
  → Work Orders (pending)
  → Bootstrap (if needed, creates foundation)
  → Orchestrator (polls approved WOs)
    → Manager (routing decision)
    → Proposer (code generation)
    → Aider (apply in worktree)
    → GitHub (create PR)
    → Acceptance Validator (5-dim scoring)
    → Track Results (DB updates)
```

---

## Technology Stack

- **Runtime:** Next.js 14 (App Router), TypeScript
- **Database:** Supabase (PostgreSQL)
- **AI:** Anthropic Claude (Architect, Proposer), GPT (fallback)
- **Git:** Native git CLI for worktree management
- **Code Application:** Aider (CLI tool)

---

## Key Constraints

1. **Bootstrap precedes all WOs** — Foundation must exist before execution
2. **Dependency ordering** — WOs respect declared dependencies via topological sort
3. **Worktree isolation** — No shared working directory during concurrent execution
4. **Package validation** — npm CLI validation (not HTTP) ensures valid dependencies
5. **No force-push to main** — Bootstrap commits normally, never destructively

---

**Token count:** ~380 words (~500 tokens)
