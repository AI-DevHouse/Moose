# Script Quick Reference

**Version:** v138
**Full registry:** `scripts/SCRIPTS.md`
**Purpose:** Session-loadable script index for N7 compliance

---

## 🚀 Common Tasks

### Query WO Status
```bash
npx tsx scripts/check-wo-execution-status.ts    # Detailed status + dependencies
npx tsx scripts/check-all-wos.ts                 # All WOs for project
npx tsx scripts/check-pending-wos.ts             # Pending WOs only
```

### Approve WOs
```bash
npx tsx scripts/approve-wos.ts --ids X,Y,Z              # By ID list ⭐ NEW
npx tsx scripts/approve-wos.ts --project-id P --status pending  # By filter ⭐ NEW
```

### Reset WOs
```bash
npx tsx scripts/reset-wos-to-pending.ts          # Reset all to pending
npx tsx scripts/reset-failed-wos.ts              # Reset failed only
```

### Bootstrap
```bash
npx tsx scripts/manual-bootstrap-mld.ts          # Execute bootstrap
npx tsx scripts/check-bootstrap-status.ts        # Verify bootstrap
```

### Validation
```bash
npx tsx scripts/fix-wo-package-versions.ts       # Fix invalid packages
npx tsx scripts/validate-packages.ts --wo-id X   # Validate one WO
```

### Analysis
```bash
npx tsx scripts/fetch-all-wos.ts --project-id X  # Export to JSON
npx tsx scripts/analyze-failures.ts              # Failure analysis
```

---

## 📚 Library Modules (`scripts/lib/`)

**Available since v138:**

### wo-queries.ts
- `queryWOs(supabase, { projectId, status, ids, ... })`
- `getWOsByStatus(supabase, projectId, status)`
- `getProjectWOs(supabase, projectId)`
- `findProjectByName(supabase, namePattern)`
- `countWOsByStatus(supabase, projectId)`

### wo-operations.ts
- `approveWOs(supabase, woIds)` → OperationResult
- `resetWOs(supabase, woIds)` → OperationResult
- `updateWOStatus(supabase, woId, status, metadata?)`
- `deleteWOs(supabase, woIds)` → OperationResult
- `completeWO(supabase, woId, prUrl?)`

### wo-formatters.ts
- `formatTable(wos, columns)`
- `formatStatusDistribution(distribution)`
- `formatOperationResult(name, result)`
- `exportToJSON(wos, outputPath)`
- `formatSummary(wos)`

---

## ⚠️ Superseded Scripts

**Use `approve-wos.ts` instead of:**
- `approve-five-wos.ts`, `approve-six-wos.ts`, `approve-49-mld-wos.ts`
- `approve-all-wos.ts`, `approve-all-pending-wos.ts`

---

## 📋 Script Creation Guidelines (N7)

**Before creating a new script:**
1. Check this card for existing scripts
2. Check `scripts/SCRIPTS.md` for full registry
3. Check `scripts/lib/` for reusable functions

**When creating a new script:**
1. Add header comment with PURPOSE, USAGE, LIBS
2. Import from `scripts/lib/` when possible
3. Add entry to `scripts/SCRIPTS.md`
4. Use consistent formatting from `wo-formatters`

**Example header:**
```ts
/**
 * SCRIPT: my-new-script.ts
 * PURPOSE: One-line description
 * USAGE: npx tsx scripts/my-new-script.ts [args]
 * LIBS: wo-queries, wo-operations
 * ADDED: v138
 */
```

---

**Token count:** ~350 tokens
