# Glossary — Moose Mission Control

**Version:** v138
**Purpose:** Canonical domain terminology
**Load when:** Encountering unfamiliar terms or ambiguous references

---

## Core Entities

**WO** — Work Order. Atomic unit of work representing a single feature/fix/refactor.

**MLD** — Multi-LLM Discussion (project codename: `multi-llm-discussion-v1`). The target project being developed.

**Decomposition** — Process of breaking a high-level feature request into dependency-ordered WOs.

**Bootstrap** — Special initialization phase that creates project foundation (package.json, tsconfig.json, src/) on main branch.

**Worktree** — Isolated git working directory created via `git worktree add`. Enables concurrent execution.

**Proposer** — AI agent (Claude) that generates code based on WO technical requirements.

**Aider** — CLI tool that applies code changes to a working directory.

**Manager** — Routing component that decides which Proposer should handle a given WO.

---

## Database Tables

**work_orders** — Primary WO storage: title, description, status, technical_requirements, github_pr_url, acceptance_result.

**work_order_dependencies** — Directed edges representing WO dependencies (blocking_work_order_id → dependent_work_order_id).

**projects** — Top-level projects with metadata (name, repo_path, status).

**project_maturity_level** — Tracks project lifecycle stage (bootstrap, mvp, stable).

**decomposition_metadata** — Links decompositions to WOs and tracks bootstrap execution.

**bootstrap_events** — Audit log of bootstrap attempts with status, commit_hash, validation_errors.

**technical_requirements** — Aggregated package/config requirements extracted from WOs.

**decision_logs** — Records Manager routing decisions with confidence scores.

**escalations** — Human-review queue for failed WOs or validation issues.

**acceptance_results** — Detailed 5-dimension quality scores for completed WOs.

---

## Status Values

### Work Order Status
- **pending** — Created, awaiting approval
- **approved** — Ready for execution
- **in_progress** — Currently executing
- **completed** — Successfully merged
- **failed** — Execution failed, may need escalation
- **blocked** — Waiting on dependencies or bootstrap

### Bootstrap Status
- **pending** — Not yet executed
- **in_progress** — Aggregating requirements or committing
- **completed** — Successfully committed to main
- **failed** — Validation errors or commit failure

### Project Status
- **active** — Currently being developed
- **archived** — No longer active
- **on_hold** — Paused development

---

## Workflow Terms

**Polling** — Orchestrator's periodic check for approved pending WOs (default: 10s interval).

**Leasing** — Process of reserving a worktree from the pool for WO execution.

**Release** — Returning a worktree to the pool after cleanup (reset, branch delete, stash).

**Acceptance Validation** — 5-dimension quality scoring: unit tests, integration tests, type safety, linting, edge cases.

**Escalation** — Flagging a WO for human review when acceptance score < 70% or execution fails.

**Topological Sort** — Ordering WOs by dependencies to ensure blocking WOs execute first.

**Package Validation** — Checking package names/versions against npm registry via CLI (`npm view`).

**Scoped Package** — npm packages with org namespace (e.g., `@anthropic-ai/sdk`).

---

## Configuration

**WORKTREE_POOL_ENABLED** — Enable/disable worktree pool (default: true).

**WORKTREE_POOL_SIZE** — Number of worktrees to create (default: 15).

**BOOTSTRAP_VALIDATION_STRICT** — Require package-lock.json for bootstrap success (default: false).

**ANTHROPIC_API_KEY** — Claude API key for Proposer/Architect.

**SUPABASE_URL** / **SUPABASE_SERVICE_ROLE_KEY** — Database credentials.

---

## File Paths

**Session docs** — `docs/session_updates/` (MASTER, QUICK, handovers, archive, evidence)

**Scripts** — `scripts/` (manual operations, testing, validation)

**Orchestrator** — `src/lib/orchestrator/` (core execution pipeline)

**Architect** — `src/lib/architect-service.ts`, `src/lib/architect-decomposition-rules.ts`

**Bootstrap** — `src/lib/bootstrap/requirements-aggregator.ts`

**Types** — `src/types/supabase.ts` (DB schema), `src/lib/orchestrator/types.ts` (execution types)

---

**Entry count:** ~60 terms
**Token count:** ~450 tokens
