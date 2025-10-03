# GitHub Branch Cleanup Plan
**Date:** 2025-10-03
**Session:** v40
**Token Usage:** 77,195 / 200,000 (38.6%)

---

## Current State Analysis

### Remote (GitHub)
- **Default Branch:** `main` (at commit `ce85a17`)
- **Remote Branches:** 2
  - `origin/main` (1 commit behind local main)
  - `origin/test/contract-validation-integration` (1 open PR #1, stale for 7 days)

### Local Repository
- **Local Branches:** 5
  - `main` - 1 commit ahead of origin/main
  - `feature/wo-c16ccf0c-e2e-test-simple-typescript-fun` - **Current branch**, 44 commits ahead of main
  - `test/contract-validation-integration` - Has open PR
  - `backup-pre-claude-code` - Safety backup (3 days old)
  - `backup-pre-gc` - Safety backup (1 day old)

### Unpushed Work
- **44 commits** of valuable work on current branch:
  - Phase 2.3 Orchestrator (complete)
  - Phase 3 Error Handling & Resilience (complete)
  - v40 Bug fixes (3 critical E2E bugs)
  - Repository cleanup (gitignore improvements)

### Critical Issue: Secrets in Git History
- **Commit `9fd1400`** contains:
  - `.env.local` with API keys (Anthropic, OpenAI, GitHub PAT)
  - `Moose-Mission-Control API Keys.txt` file
  - This commit is in the ancestry of current branch
  - **Blocks GitHub push** due to push protection

---

## Best Practice Violations

### 🔴 Critical
1. **Secrets in git history** - Commit `9fd1400` has API keys
2. **Main branch out of sync** - Local main 1 commit ahead of remote
3. **Stale PR** - PR #1 open for 7 days, no activity
4. **No PR for completed work** - 44 commits of validated work not on main

### 🟡 Moderate
5. **Long-lived feature branch** - Current branch spans 44 commits
6. **No branch protection rules** - Unknown if main is protected
7. **Backup branches lingering** - Old safety branches not cleaned up

---

## Recommended Branch Strategy (Best Practice)

### GitHub Flow (Recommended for this project)
**Why:** Simple, suitable for continuous deployment, good for small teams

**Rules:**
1. `main` branch is always deployable
2. Feature branches branch from `main`, PR back to `main`
3. Delete feature branches after merge
4. Short-lived feature branches (1-3 days ideal, max 1 week)
5. Commit often, push daily, PR when feature complete
6. Backup branches only for major refactors, delete after merge

### Alternative: Git Flow
**Not recommended** - Too complex for current team size and workflow

---

## Cleanup Plan (Step-by-Step)

### Phase 1: Sync Main Branch (5 minutes)
**Goal:** Get local and remote main in sync

**Steps:**
1. Switch to main: `git checkout main`
2. Check status: `git log origin/main..main --oneline`
3. Decision:
   - If commit is safe: `git push origin main`
   - If commit has issues: `git reset --hard origin/main`

**Expected Outcome:** `main` and `origin/main` at same commit

---

### Phase 2: Handle Stale PR (10 minutes)
**Goal:** Close or merge PR #1

**Investigation needed:**
1. View PR: `gh pr view 1`
2. Check diff: `gh pr diff 1`
3. Decision matrix:
   - If valuable work: Merge PR, delete branch
   - If obsolete: Close PR, delete branch
   - If needs work: Ask user for decision

**Expected Outcome:** 0 stale PRs

---

### Phase 3: Create Clean Feature Branch (30 minutes) ⚠️ CRITICAL
**Goal:** Get validated work onto main WITHOUT secrets in history

**Problem:** Current branch has commit `9fd1400` with secrets in history

**Solution Option A - Clean Cherry-Pick (Recommended):**
1. Create new branch from main: `git checkout -b feature/orchestrator-complete-clean`
2. Identify essential commits (exclude Aider test commits):
   - `6a57673` Fix Critical E2E Bugs
   - `51f01e7` Repository Cleanup
   - Plus orchestrator implementation commits (need to identify)
3. Cherry-pick essential commits: `git cherry-pick <commits>`
4. Squash into logical commits
5. Push and create PR

**Solution Option B - Squash Merge (Alternative):**
1. Create comprehensive commit with all changes
2. Manually apply file changes to clean branch
3. Single commit with full changeset
4. Push and create PR

**Expected Outcome:**
- Clean branch ready for PR
- No secrets in git history
- All validated work preserved

---

### Phase 4: Clean Up Old Branches (5 minutes)
**Goal:** Remove obsolete local branches

**Steps:**
1. After Phase 2 merged/closed: `git branch -d test/contract-validation-integration`
2. After work stabilizes (1 week):
   - `git branch -D backup-pre-claude-code`
   - `git branch -D backup-pre-gc`
3. After Phase 3 PR merged: `git branch -d feature/orchestrator-complete-clean`
4. Delete current branch: `git branch -D feature/wo-c16ccf0c-e2e-test-simple-typescript-fun`

**Expected Outcome:** Only `main` branch remains locally

---

### Phase 5: Validate Clean State (5 minutes)
**Goal:** Confirm repository is clean and organized

**Checks:**
1. ✅ `git branch -a` shows only main + active feature (if any)
2. ✅ `gh pr list` shows 0 stale PRs
3. ✅ `git log main --oneline` shows no secrets
4. ✅ Local main == remote main
5. ✅ All validated work on main branch

---

## Essential Commits to Preserve

### Core Infrastructure (Must Keep)
From current branch ancestry, these represent major completed phases:

1. **Orchestrator Implementation** (Phase 2.3)
   - Core files: orchestrator-service.ts, work-order-poller.ts, etc.
   - Estimate: ~10 commits condensed

2. **Error Handling & Resilience** (Phase 3)
   - Commits: `8c865eb`, `fa67473`, `93012f1`, `6b89ee6`
   - error-escalation.ts, failure mode tests, monitoring

3. **Priority 1 & 2 Fixes** (from v39, partial)
   - Note: `9fd1400` has secrets BUT also has validated work
   - **Action:** Cherry-pick file changes only, not commit

4. **v40 Bug Fixes** (This session)
   - `6a57673` Fix Critical E2E Bugs (work-orders/[id]/route.ts, api-client.ts, work-order-poller.ts)
   - `51f01e7` Repository Cleanup (gitignore improvements)

### Test Commits (Can Discard)
- `afc6d9c`, `067156a`, `a8e5ed8` - Aider E2E test artifacts
- Documentation handover commits (preserve content, but can squash)

---

## Execution Order (This Session)

### Immediate (v40 - Now):
1. ✅ **Complete:** Repository cleanup (gitignore) - DONE
2. 🔄 **In Progress:** Document cleanup plan - THIS FILE
3. ⏭️ **Next:** Phase 1 (Sync main)
4. ⏭️ **Next:** Phase 2 (Handle stale PR)
5. ⏭️ **Next:** Phase 3 (Create clean branch)

### After Clean Branch Created:
6. Run E2E test on clean branch (validate GitHub push works)
7. Create PR for orchestrator work
8. Merge to main
9. Clean up old branches

### Future Session (Option 1 - History Cleaning):
10. Use BFG Repo Cleaner to remove secrets from ALL history
11. Force-push cleaned main
12. Document secret rotation (API keys in `9fd1400` should be rotated)

---

## Success Criteria

### Post-Cleanup State:
- ✅ No secrets in any branch history that will be pushed
- ✅ Main branch is clean and up-to-date with remote
- ✅ All validated work (44 commits worth) merged to main
- ✅ 0 stale PRs
- ✅ 0 orphaned branches
- ✅ E2E test passes with successful GitHub push

### Quality Metrics:
- Branch count: ≤ 2 (main + 1 active feature max)
- PR age: < 3 days
- Main sync lag: 0 commits
- Secrets in history: 0

---

## Risk Assessment

### Low Risk:
- ✅ Phase 1 (Sync main) - Reversible
- ✅ Phase 2 (Close stale PR) - Reversible
- ✅ Phase 4 (Delete merged branches) - Only after confirmed merged

### Medium Risk:
- ⚠️ Phase 3 Option A (Cherry-pick) - Could miss commits, but reversible
- ⚠️ Phase 5 (Delete current branch) - Loss of test artifacts, but not essential

### High Risk (Future):
- 🔴 Option 1 (BFG history cleaning) - Rewrites all history, requires force-push

---

## Next Session Handover

**If this session ends before completion:**

1. Read this file first: `docs/github-branch-cleanup-plan.md`
2. Check progress: Look for "✅ COMPLETE" markers below
3. Resume at next incomplete phase

**Progress Tracking:**
- [ ] Phase 1: Sync Main Branch
- [ ] Phase 2: Handle Stale PR
- [ ] Phase 3: Create Clean Feature Branch
- [ ] Phase 4: Clean Up Old Branches
- [ ] Phase 5: Validate Clean State
- [ ] Phase 6: Run E2E Test on Clean Branch

---

**Last Updated:** 2025-10-03 (v40)
**Next Review:** After Phase 3 completion
