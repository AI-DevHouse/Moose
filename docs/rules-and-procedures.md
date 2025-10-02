# Rules and Procedures

**Revised for Claude Code CLI with direct file access tools.**

---

## Core Rules (R1-R8)

**R1: One step only**
Execute one action, verify, then proceed. No batching.

**R2: No assumptions**
Always Read files before editing. Unknown = ask or probe.

**R3: Three-strike re-diagnose**
After 3 failed attempts with same method, STOP and change approach.

**R4: Evidence over recall**
Use tsc, tests, diagnostics. Never rely on memory for technical details.

**R5: Stop on first failure**
Don't chain operations. Diagnose before proceeding.

**R6: Security first**
Never expose API keys. Redact secrets. Use environment variables.

**R7: 100% component validation**
Complete current phase 100% before starting next.

**R8: Deep context check**
Review handover docs before technical work. Answer verification questions.

**R9: Never dismiss errors without investigation**
When user challenges error handling or test results, investigate properly. Don't dismiss errors as "false positives" without full context verification.

**R10: Verify before assuming**
- Before writing tests: curl the endpoint, document actual response
- Before writing DB queries: check src/types/supabase.ts for column names
- Before using metadata fields: read the actual metadata structure from DB
- Never assume field names - always verify against live system

---

## Rules Removed (Obsolete with Claude Code CLI)

**Former R4 (PowerShell syntax):** No longer needed - use Read/Edit/Write tools, not PowerShell string manipulation

**Former R11 (File persistence verification):** No longer needed - tools guarantee success or error, no silent failures

**Former R12 (Content-based edits with evaluation):** No longer needed - Edit tool handles exact string matching natively without PowerShell regex issues

**Why removed:** Claude Code CLI provides direct file access via Read/Edit/Write tools. These tools handle exact content matching, guarantee success/failure feedback, and eliminate the need for PowerShell workarounds that were error-prone.

---

## Terminal Setup

**T1:** `npm run dev` (keep running - development server)
**T2:** `lt --port 3000 --subdomain moose-dev-webhook` (optional - GitHub webhooks only)
**T3:** Free for commands and tests

---

## Common Pitfalls

### Architect (Phase 2.1)
❌ Don't accept unstructured input → Require objectives/constraints/criteria format
❌ Don't generate <3 or >8 WOs → Too few = not decomposed, too many = overwhelming
❌ Don't trust Claude without markdown stripping → Always strip ```json wrappers
❌ Don't block on complex dependency patterns → Diamond convergence is valid
❌ Don't skip database migration before UI work → Foreign key constraints will fail
❌ Don't underestimate cost impact → 1-2 calls/day = 75-150% of LLM budget

### Claude Prompt Engineering
❌ Don't rely on prompts alone for formatting → Claude wraps JSON despite "ONLY JSON" instructions
✅ **Always strip markdown in code:**
```typescript
const cleaned = response.replace(/^```json\n?|\n?```$/g, '');
const parsed = JSON.parse(cleaned);
```
✅ Include concrete examples (positive + negative)
✅ Use try-catch for complex validations

### Schema Mismatches
❌ Don't assume field names (e.g., `is_running`) - check actual API response
❌ Don't write DB queries without checking supabase.ts types first
❌ Don't write tests before curling the endpoint
✅ **Always regenerate types at session start:**
```powershell
npx supabase gen types typescript --project-id qclxdnbvoruvqnhsshjr > src/types/supabase.ts
```
✅ **Before writing tests, document actual response:**
```powershell
curl http://localhost:3000/api/your-endpoint | python -m json.tool
```

### General
❌ Don't build infrastructure before validating concepts → **FOUND.PRINCIPLE**
❌ Don't assume file contents → Always Read first (R2)
❌ Don't confuse Aider (tool) with Orchestrator (infrastructure layer)
❌ Don't proceed to next phase at <100% validation → R7
❌ Don't commit package.json with feature code → Separate commits for dependencies
❌ **Don't dismiss errors without investigation** → Always verify with full project context (R9)

### TypeScript Errors
❌ Don't run `tsc` on individual files for module resolution errors → Use full project compilation
❌ Don't dismiss TS2307 "Cannot find module" without checking Next.js build
✅ **Always verify with full context:**
```powershell
# Wrong: Individual file check (lacks path alias context)
npx tsc --noEmit src/app/api/manager/route.ts

# Right: Full project compilation
npx tsc --noEmit

# Or: Check Next.js build output
# Look for "✓ Compiled /api/manager" in dev server logs
```
✅ If user challenges an error, investigate properly before dismissing

---

## Verification Procedures

### Session Start (Mandatory)

```powershell
# 1. Regenerate Supabase types (verify schema matches code)
npx supabase gen types typescript --project-id qclxdnbvoruvqnhsshjr > src/types/supabase.ts

# 2. Verify TypeScript compilation
npx tsc --noEmit 2>&1 | Select-String "Found.*errors"

# 3. Integration tests (expect 20/20 passing as of v34)
.\phase1-2-integration-test.ps1

# 4. Check server running
# Look for "compiled successfully" in T1

# 5. Git status
git status
git log --oneline -5
```

**Known issue:** Security Hard Stop test fails on cold start. Run tests twice if needed. See [known-issues.md](known-issues.md#5-cold-start-race-condition).

---

### After Code Changes

```powershell
# 1. Full type check (ALWAYS run this first)
npx tsc --noEmit 2>&1 | Select-String "Found.*errors"

# 2. Filter for specific files (if needed)
npx tsc --noEmit 2>&1 | Select-String "manager"

# 3. Integration tests (if touching core logic)
.\phase1-2-integration-test.ps1

# Note: Individual file checks (npx tsc --noEmit path/to/file.ts)
# can produce false positives for path aliases (@/*) - always verify
# with full project compilation
```

---

### After Architect Changes

```powershell
# Test decomposition endpoint
$testSpec = @{
  feature_name = "Test Feature"
  objectives = @("Objective 1")
  constraints = @("Constraint 1")
  acceptance_criteria = @("AC 1")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/architect/decompose" `
  -Method POST `
  -ContentType "application/json" `
  -Body $testSpec

# Expected: 3-8 WOs, total_estimated_cost, decomposition_doc
```

---

### After Database Changes

```sql
-- Run in Supabase SQL editor

-- Check table structure
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'work_orders';

-- Check recent records
SELECT id, status, created_at, updated_at
FROM work_orders
ORDER BY created_at DESC
LIMIT 5;
```

---

## Diagnostic Commands

### Server Health

```powershell
# Check Node processes
Get-Process | Where-Object {$_.ProcessName -like "*node*"}

# Test API responsiveness
Invoke-RestMethod http://localhost:3000/api/health

# Check proposer registry
Invoke-RestMethod http://localhost:3000/api/proposers | ConvertFrom-Json |
  Select-Object -ExpandProperty proposers |
  Format-Table name, complexity_threshold, model

# Budget status
Invoke-RestMethod http://localhost:3000/api/budget-status
```

---

### Build Issues

```powershell
# Full rebuild
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```

---

### Git Operations

```powershell
# Check unreferenced objects (warning after force-push/rebase)
git prune

# Restore file (only works for committed files)
git status  # Check if file is tracked first
git checkout HEAD -- path/to/file.ts

# View uncommitted changes
git diff
git diff --staged

# Undo last commit (keep changes)
git reset --soft HEAD~1
```

---

### Tunnel Issues (Optional - GitHub webhooks only)

```powershell
# Test tunnel
Invoke-RestMethod -Uri "https://moose-dev-webhook.loca.lt/api/github/webhook"

# Restart tunnel (Terminal 2)
# Kill existing:
Get-Process | Where-Object {$_.ProcessName -like "*lt*"} | Stop-Process -Force

# Start new:
lt --port 3000 --subdomain moose-dev-webhook
```

---

## Error Response Patterns

### Claude Wraps JSON

**Problem:** Despite "Return ONLY valid JSON", Claude outputs:
```json
```json
{"key": "value"}
```
```

**Solution:** Always strip markdown in parsing code:
```typescript
const cleaned = response.replace(/^```json\n?|\n?```$/g, '');
const parsed = JSON.parse(cleaned);
```

**Location implemented:** `src/lib/architect-service.ts` line ~87

**Note:** This is a model behavior issue, not solvable via prompt engineering. Always strip markdown in code.

---

### Dependency Validation Fails

**Problem:** Simple cycle detection flags valid diamond patterns (A,B→C) as circular

**Current behavior:** Warns but doesn't block (temporary until prompt refined)

**Example:**
```
WO-0: Database schema
WO-1: API endpoint
WO-2: Integration (depends on WO-0 AND WO-1)  ← Flagged as circular
```

**Future fix (Week 4 Day 2):** Refine Architect prompt to explicitly support multi-parent dependencies, implement proper topological sort

**Files to modify:** `src/lib/architect-service.ts` (validation logic), Architect system prompt

---

### Cold-Start Test Failure

**Problem:** Security Hard Stop test fails immediately after server restart

**Root cause:** Config loading race condition - API accepts requests before system_config loaded

**Symptoms:**
```
14/15 tests pass (first run)
15/15 tests pass (second run)
```

**Workaround:** Run `.\phase1-2-integration-test.ps1` twice after restart

**Planned fix (Week 4 Day 5):**
1. Add initialization barrier (async config load before server ready)
2. Create readiness check endpoint: `/api/health/ready`
3. Test suite waits for 200 from readiness endpoint before running

**Files to modify:** Server startup logic, `src/lib/config-services.ts`, new `src/app/api/health/ready/route.ts`, test script

---

## Commit Guidelines

### Commit Message Format

```
Phase X.Y.Z: Brief description of change

- Bullet point details if needed
- Keep under 72 chars per line
```

### When to Commit

✅ After completing a feature increment (MVP or phase milestone)
✅ After fixing a bug
✅ After adding new dependencies (separate commit)
✅ Before switching tasks
❌ Never commit broken code (unless explicitly testing)
❌ Never commit secrets or API keys

### Separate Package Changes

```powershell
# Good: Separate commits
git add package.json package-lock.json
git commit -m "Add @anthropic-ai/sdk dependency"

git add src/lib/architect-service.ts src/types/architect.ts
git commit -m "Phase 2.1: Add Architect service"

# Bad: Mixed commit
git add .
git commit -m "Add Architect and dependencies"
```

**Why:** Cleaner history, easier rollback, clearer blame tracking

---

## Git Commit Procedure

**Only create commits when requested by the user.** If unclear, ask first.

When the user asks to create a git commit:

1. **Parallel git commands:**
```powershell
# Run these in parallel
git status
git diff
git log --oneline -5
```

2. **Analyze changes and draft commit message:**
- Summarize nature (new feature/enhancement/bug fix/refactoring/test/docs)
- Ensure accurate reflection of changes and purpose
- Do not commit files with secrets (.env, credentials.json, etc.) - warn if requested
- Draft concise 1-2 sentence message focusing on "why" not "what"

3. **Parallel commit operations:**
```powershell
# Add relevant files
git add [files]

# Create commit with message
git commit -m "Phase X.Y: Description

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Check status
git status
```

4. **If commit fails due to pre-commit hook changes:**
- Retry ONCE if hook modified files
- Check authorship: `git log -1 --format='%an %ae'`
- Check not pushed: `git status` (should show "Your branch is ahead")
- If both true: amend commit. Otherwise: create NEW commit

**Important:**
- NEVER update git config
- NEVER run destructive commands (push --force, hard reset) unless explicitly requested
- NEVER skip hooks (--no-verify, --no-gpg-sign) unless explicitly requested
- DO NOT push to remote unless user explicitly asks
- NEVER use git commands with -i flag (requires interactive input)

---

**See [session-state.md](session-state.md) for current work and [architecture-decisions.md](architecture-decisions.md) for system design.**