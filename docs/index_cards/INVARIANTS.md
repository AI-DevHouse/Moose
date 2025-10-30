# Invariants — Moose Mission Control

**Version:** v138
**Purpose:** Non-changing rules and architectural decisions
**Load when:** Uncertain about system constraints or making architectural changes

---

## Execution Order

1. **Bootstrap precedes all WOs**
   - Bootstrap creates foundation (package.json, tsconfig.json, src/) on main branch
   - No WO can execute until bootstrap succeeds and commits to main
   - Violation: Worktree creation fails (no commits on main)

2. **Dependency ordering is enforced**
   - WOs with `work_order_dependencies` entries must wait for blocking WOs to complete
   - Topological sort determines execution order
   - Circular dependencies are rejected at decomposition time

3. **Work Order WO-0 is bootstrap**
   - By convention, the first WO (WO-0) in any decomposition is the bootstrap work order
   - It has no dependencies and must complete first
   - Title pattern: "Bootstrap: Initialize [project] foundation"

---

## Git & Branching

4. **Never force-push to main**
   - Bootstrap commits normally via `git commit && git push`
   - No `--force`, `--force-with-lease`, or history rewriting
   - Rationale: Preserves audit trail and prevents data loss

5. **Bootstrap pushes directly to main**
   - Bootstrap commits to main and pushes without PR
   - All other WOs create feature branches and go through PR review
   - Rationale: Bootstrap is infrastructure (aggregated from all WO requirements), not arbitrary code; must be merged before any WO can execute
   - Implementation: `src/lib/bootstrap/bootstrap-executor.ts` (lines 175-202)

6. **Branch naming convention**
   - Pattern: `wo-[id]-[slugified-title]`
   - Example: `wo-5-add-user-authentication`
   - Enforced in: `src/lib/orchestrator/github-integration.ts`

7. **Main branch is the source of truth**
   - All worktrees branch from main
   - PRs merge to main
   - No long-lived feature branches

---

## Worktree Pool

8. **Worktree isolation is mandatory for concurrency**
   - Shared directory mode = sequential execution only
   - Concurrent execution requires worktree pool enabled
   - Rationale: Prevents file-level race conditions in Aider

9. **Worktrees are stateless across leases**
   - Each lease starts with: reset to main, delete stale branches, clean stash
   - No state persists between WO executions
   - Enforced in: `WorktreePoolManager.releaseWorktree()`

10. **npm install runs once, copies to others**
   - First worktree runs full `npm install --legacy-peer-deps`
   - Subsequent worktrees copy from first `node_modules/`
   - Uses `--legacy-peer-deps` to handle unavoidable peer dependency conflicts
   - Rationale: 10x speedup for bootstrap (2.5min → 15sec per worktree)

---

## Package Validation

11. **npm CLI validation, never HTTP fetch**
    - Use: `npm view <package>@<version> --json`
    - Never: `https://registry.npmjs.org/<package>`
    - Rationale: 2-10x faster, uses local cache, handles scoped packages correctly

12. **Scoped packages require @ prefix**
    - Correct: `@anthropic-ai/sdk@0.9.1`
    - Incorrect: `anthropic-ai/sdk@0.9.1` or `anthropic-ai/sdk:0.9.1`
    - Parser enforces format in: `scripts/fix-wo-package-versions.ts`

13. **Invalid packages are corrected before bootstrap**
    - Run: `scripts/fix-wo-package-versions.ts` after decomposition
    - Updates `technical_requirements` JSONB in work_orders table
    - Bootstrap aggregation re-queries corrected data

---

## Database

14. **Work Order status transitions are one-way (mostly)**
    - Forward: `pending → approved → in_progress → completed`
    - Rollback allowed: `in_progress → pending` (for retry)
    - Never: `completed → pending` (creates confusion)

15. **JSONB fields use camelCase keys**
    - `technical_requirements`, `acceptance_criteria`, `metadata`
    - Example: `{ "packageName": "react", "version": "^18.0.0" }`
    - Enforced by TS types in `src/types/supabase.ts`

16. **UUIDs are primary keys, not incrementing integers**
    - Exception: WO titles may reference sequential IDs (e.g., "WO-5")
    - Rationale: Distributed system compatibility, prevents enumeration attacks

---

## Acceptance Validation

17. **Acceptance threshold is 70%**
    - Overall score = weighted average of 5 dimensions
    - Score ≥ 70% → auto-accept
    - Score < 70% → escalate for human review

18. **5 dimensions are fixed**
    - Unit tests, integration tests, type safety, linting, edge cases
    - Weights may change, but dimensions do not
    - Rationale: Comprehensive quality coverage, prevents gaming the system

---

## Cost & Budgeting

19. **Each WO tracks estimated vs. actual cost**
    - Estimated: Set by Architect during decomposition
    - Actual: Tracked in `cost_tracking` table and rolled up to `work_orders.actual_cost`
    - Used for: Budget alerts, cost optimization analysis

20. **Context budget is a soft limit**
    - Proposer has ~100k token window
    - If WO context exceeds budget, split into sub-WOs (manual intervention)
    - Never truncate requirements to fit budget

---

## Session Management

21. **Only current handover + QUICK belong in context**
    - Archive handovers > 2 sessions old
    - Evidence logs stay in `/evidence/vNN/`, never paste raw logs
    - Rationale: Preserves context window for actual work

22. **Index cards are stable, handovers are deltas**
    - Index cards change rarely (architecture, schema, invariants)
    - Handovers change every session (progress, next actions)
    - Models load both, but index cards provide durable grounding

---

## Error Handling

23. **Transient errors get 3 retries, deterministic errors escalate**
    - Transient: Network timeouts, rate limits, temporary API failures
    - Deterministic: Type errors, missing dependencies, invalid syntax
    - Enforced in: `src/lib/error-escalation.ts`

24. **All escalations log to `escalations` table**
    - No silent failures
    - Human review queue powered by this table
    - Status: `pending → in_review → resolved | dismissed`

---

## Security & Secrets

25. **Never commit .env files**
    - Use `.env.local` for local dev (gitignored)
    - Supabase credentials live in environment variables
    - Scripts use `dotenv` to load, never hardcode

26. **Service role key is server-side only**
    - `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS
    - Used in: API routes, scripts, orchestrator
    - Never expose to client-side code

---

**Rule count:** 26 invariants
**Token count:** ~850 tokens
