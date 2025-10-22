# Fix 1: Greenfield Detection + Bootstrap WO Implementation Plan

**Date:** 2025-10-22
**Objective:** Enable architect to detect greenfield projects and inject infrastructure bootstrap WO
**Scope:** Minimal changes to architect-service.ts and supporting utilities

---

## Critical Design Question: Sequencing

### Option A: Bootstrap BEFORE Decomposition ❌

```
1. Detect greenfield
2. Generate generic bootstrap WO (guess architecture)
3. Decompose spec → generate feature WOs
4. Return [bootstrap, ...features]
```

**Problems:**
- Bootstrap can't know what features need (blind guess)
- May create wrong architecture (Express when spec needs Next.js)
- Requires parsing spec TWICE (once for bootstrap, once for features)

---

### Option B: Bootstrap AFTER Decomposition ✅ RECOMMENDED

```
1. Decompose spec → generate feature WOs (as normal)
2. Detect greenfield
3. Analyze feature WOs to infer architecture needs
4. Generate informed bootstrap WO-0
5. Prepend bootstrap to WO array
6. Update all feature WO dependencies to include "0"
7. Return [bootstrap, ...features]
```

**Advantages:**
- Bootstrap WO knows exactly what features need (scans their descriptions/files)
- Single decomposition pass
- Architecture matches actual requirements
- No need to retrofit feature WOs (bootstrap executes first anyway)

**Why this works:**
- Feature WOs naturally describe what they need ("Configure Redux store", "Implement React components")
- We can infer from WO titles/descriptions: React → needs JSX, Redux → needs @reduxjs/toolkit
- Bootstrap WO-0 creates infrastructure, then WO-1+ execute with correct setup
- Dependency chain enforces order: all WOs depend on "0"

---

## Detailed Implementation Plan

### Phase 1: Add Greenfield Detection Utility

**File:** `src/lib/orchestrator/project-inspector.ts` (NEW)

**Function:** `assessProjectMaturity(projectPath: string): ProjectMaturity`

**Logic:**
```typescript
interface ProjectMaturity {
  is_greenfield: boolean;
  has_src_directory: boolean;
  has_package_json: boolean;
  package_json_dependency_count: number;
  has_tsconfig: boolean;
  existing_ts_file_count: number;
  greenfield_confidence: number; // 0.0-1.0
}

function assessProjectMaturity(projectPath: string): ProjectMaturity {
  const hasSrc = fs.existsSync(path.join(projectPath, 'src'));
  const hasPackageJson = fs.existsSync(path.join(projectPath, 'package.json'));

  let depCount = 0;
  let tsFileCount = 0;

  if (hasPackageJson) {
    const pkg = JSON.parse(fs.readFileSync(...));
    depCount = Object.keys(pkg.dependencies || {}).length +
               Object.keys(pkg.devDependencies || {}).length;
  }

  if (hasSrc) {
    // Count .ts/.tsx files recursively
    tsFileCount = countTypescriptFiles(path.join(projectPath, 'src'));
  }

  // Greenfield heuristic: no src/ OR <3 dependencies OR <5 TS files
  const isGreenfield = !hasSrc || depCount < 3 || tsFileCount < 5;
  const confidence = calculateConfidence(hasSrc, depCount, tsFileCount);

  return {
    is_greenfield: isGreenfield,
    has_src_directory: hasSrc,
    has_package_json: hasPackageJson,
    package_json_dependency_count: depCount,
    has_tsconfig: fs.existsSync(path.join(projectPath, 'tsconfig.json')),
    existing_ts_file_count: tsFileCount,
    greenfield_confidence: confidence
  };
}
```

**Test cases:**
- Empty directory → greenfield (confidence: 1.0)
- Has package.json but no src/ → greenfield (confidence: 0.9)
- Has src/ with 2 files → greenfield (confidence: 0.8)
- Has src/ with 50 files + 20 deps → NOT greenfield (confidence: 0.9)

**Estimated effort:** 1 hour (simple file system checks)

---

### Phase 2: Add Architecture Inference Utility

**File:** `src/lib/bootstrap-architecture-inferrer.ts` (NEW)

**Function:** `inferArchitecture(spec: TechnicalSpec, workOrders: WorkOrder[]): InferredArchitecture`

**Logic:**
```typescript
interface InferredArchitecture {
  framework: 'react' | 'vue' | 'angular' | 'express' | 'nextjs' | 'electron' | 'node' | null;
  ui_library: boolean; // React/Vue/Angular detected
  needs_jsx: boolean;
  state_management: 'redux' | 'zustand' | 'mobx' | null;
  testing_framework: 'jest' | 'vitest' | 'mocha' | null;
  required_dependencies: string[]; // npm package names
  required_dev_dependencies: string[];
  tsconfig_settings: {
    jsx?: 'react' | 'react-jsx';
    paths?: Record<string, string[]>;
    lib?: string[];
  };
}

function inferArchitecture(
  spec: TechnicalSpec,
  workOrders: WorkOrder[]
): InferredArchitecture {
  const allText = [
    spec.feature_name,
    ...spec.objectives,
    ...spec.constraints,
    ...workOrders.map(wo => wo.title + ' ' + wo.description)
  ].join(' ').toLowerCase();

  // Framework detection (keywords in spec + WO descriptions)
  let framework = null;
  if (allText.includes('electron')) framework = 'electron';
  else if (allText.includes('next.js') || allText.includes('nextjs')) framework = 'nextjs';
  else if (allText.includes('react')) framework = 'react';
  else if (allText.includes('express')) framework = 'express';
  else if (allText.includes('vue')) framework = 'vue';
  else if (allText.includes('angular')) framework = 'angular';

  // UI library detection
  const uiLibrary = ['react', 'vue', 'angular', 'nextjs', 'electron'].includes(framework);
  const needsJsx = ['react', 'nextjs'].includes(framework) || allText.includes('jsx') || allText.includes('.tsx');

  // State management detection
  let stateManagement = null;
  if (allText.includes('redux')) stateManagement = 'redux';
  else if (allText.includes('zustand')) stateManagement = 'zustand';
  else if (allText.includes('mobx')) stateManagement = 'mobx';

  // Testing framework detection
  let testingFramework = null;
  if (allText.includes('vitest')) testingFramework = 'vitest';
  else if (allText.includes('jest')) testingFramework = 'jest';
  else if (allText.includes('mocha')) testingFramework = 'mocha';

  // Build dependency list based on detected frameworks
  const deps = [];
  const devDeps = ['typescript', '@types/node'];

  if (framework === 'react' || framework === 'nextjs') {
    deps.push('react', 'react-dom');
    devDeps.push('@types/react', '@types/react-dom');
  }

  if (framework === 'nextjs') {
    deps.push('next');
  }

  if (framework === 'electron') {
    devDeps.push('electron');
  }

  if (framework === 'express') {
    deps.push('express');
    devDeps.push('@types/express');
  }

  if (stateManagement === 'redux') {
    deps.push('@reduxjs/toolkit', 'react-redux');
    devDeps.push('@types/react-redux');
  }

  if (testingFramework === 'jest') {
    devDeps.push('jest', '@types/jest', 'ts-jest');
  } else if (testingFramework === 'vitest') {
    devDeps.push('vitest');
  }

  // Build tsconfig settings
  const tsconfigSettings: any = {};

  if (needsJsx) {
    tsconfigSettings.jsx = 'react-jsx';
    tsconfigSettings.lib = ['ES2020', 'DOM'];
  }

  // Check if any WO uses @/ path aliases
  const usesPathAliases = workOrders.some(wo =>
    wo.description.includes('@/') ||
    wo.files_in_scope?.some(f => f.includes('@/'))
  );

  if (usesPathAliases) {
    tsconfigSettings.paths = {
      '@/*': ['./src/*']
    };
    tsconfigSettings.baseUrl = '.';
  }

  return {
    framework,
    ui_library: uiLibrary,
    needs_jsx: needsJsx,
    state_management: stateManagement,
    testing_framework: testingFramework,
    required_dependencies: deps,
    required_dev_dependencies: devDeps,
    tsconfig_settings: tsconfigSettings
  };
}
```

**Test cases:**
- Spec mentions "React components" → infers React, JSX, adds react deps
- Spec mentions "Redux store" → adds @reduxjs/toolkit
- WO files include "src/renderer/..." → infers Electron
- WO descriptions use "@/" imports → adds paths config

**Estimated effort:** 2-3 hours (keyword detection + dependency mapping)

---

### Phase 3: Add Bootstrap WO Generator

**File:** `src/lib/bootstrap-wo-generator.ts` (NEW)

**Function:** `generateBootstrapWO(arch: InferredArchitecture, maturity: ProjectMaturity): WorkOrder`

**Logic:**
```typescript
function generateBootstrapWO(
  arch: InferredArchitecture,
  maturity: ProjectMaturity
): WorkOrder {
  const tasks = [];

  // Determine what needs to be created
  if (!maturity.has_package_json || maturity.package_json_dependency_count < 3) {
    tasks.push('Create package.json with required dependencies');
  } else {
    tasks.push('Update package.json to add missing dependencies');
  }

  if (!maturity.has_tsconfig || arch.needs_jsx) {
    tasks.push('Create/update tsconfig.json with appropriate compiler options');
  }

  if (!maturity.has_src_directory) {
    tasks.push('Create src/ directory structure');
    tasks.push('Create placeholder src/index.ts file');
  }

  // Build detailed description
  const description = `
Bootstrap project infrastructure to support ${arch.framework || 'TypeScript'} development.

## Tasks:
${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Required Dependencies:
${arch.required_dependencies.length > 0 ? arch.required_dependencies.join(', ') : 'None'}

## Required Dev Dependencies:
${arch.required_dev_dependencies.join(', ')}

## TypeScript Configuration:
${Object.keys(arch.tsconfig_settings).length > 0 ? JSON.stringify(arch.tsconfig_settings, null, 2) : 'Standard configuration'}

## Validation:
- Run \`npm install\` to install dependencies
- Run \`npx tsc --noEmit\` to verify TypeScript compilation succeeds
- Commit all configuration files

## Important:
- Do NOT create feature code yet (only infrastructure)
- Do NOT install dependencies (list them in package.json, orchestrator will run npm install)
- Ensure all paths and configurations are correct before committing
`.trim();

  // Build acceptance criteria
  const acceptanceCriteria = [
    'package.json created/updated with all required dependencies',
    'tsconfig.json configured with appropriate compiler options',
    'src/ directory structure exists',
    'TypeScript compilation succeeds (no errors from npx tsc --noEmit)',
    'All configuration files committed to git'
  ];

  if (arch.needs_jsx) {
    acceptanceCriteria.push('tsconfig.json includes "jsx": "react-jsx"');
  }

  if (arch.tsconfig_settings.paths) {
    acceptanceCriteria.push('tsconfig.json includes path aliases configuration');
  }

  // Build files in scope
  const filesInScope = ['package.json', 'tsconfig.json'];
  if (!maturity.has_src_directory) {
    filesInScope.push('src/index.ts');
  }

  return {
    title: 'Bootstrap Project Infrastructure',
    description,
    acceptance_criteria: acceptanceCriteria,
    files_in_scope: filesInScope,
    context_budget_estimate: 500,
    risk_level: 'low',
    dependencies: [] // Bootstrap has no dependencies (it's WO-0)
  };
}
```

**Key features:**
- Adapts to project state (creates vs updates)
- Includes all inferred dependencies
- Clear validation steps for proposer
- Emphasizes "infrastructure only, no feature code yet"

**Estimated effort:** 1-2 hours (template generation)

---

### Phase 4: Modify Architect Service

**File:** `src/lib/architect-service.ts`

**Modification:** Update `decomposeSpec()` method

**Current code (line 40-43):**
```typescript
async decomposeSpec(
  spec: TechnicalSpec,
  options?: DecomposeOptions
): Promise<DecompositionOutput> {
  // Build prompt using centralized rules
  const prompt = buildArchitectPrompt(spec);

  const response = await this.anthropic.messages.create({...});

  // Parse and validate
  let decomposition = JSON.parse(cleanContent);

  validateWorkOrderCount(decomposition.work_orders.length);
  // ... other validations

  return decomposition;
}
```

**New code:**
```typescript
async decomposeSpec(
  spec: TechnicalSpec,
  options?: DecomposeOptions
): Promise<DecompositionOutput> {
  // Build prompt using centralized rules
  const prompt = buildArchitectPrompt(spec);

  const response = await this.anthropic.messages.create({...});

  // Parse and validate
  let decomposition = JSON.parse(cleanContent);

  validateWorkOrderCount(decomposition.work_orders.length);
  // ... other validations

  // **NEW: Greenfield detection and bootstrap injection**
  if (options?.projectId) {
    const project = await projectService.getProject(options.projectId);

    if (project) {
      // Check if project is greenfield
      const maturity = assessProjectMaturity(project.local_path);

      if (maturity.is_greenfield) {
        console.log(`[Architect] Greenfield project detected (confidence: ${maturity.greenfield_confidence})`);

        // Infer architecture from spec + generated WOs
        const architecture = inferArchitecture(spec, decomposition.work_orders);

        console.log(`[Architect] Inferred architecture: ${architecture.framework || 'generic TypeScript'}`);
        console.log(`[Architect] Required dependencies: ${architecture.required_dependencies.join(', ')}`);

        // Generate bootstrap WO
        const bootstrapWO = generateBootstrapWO(architecture, maturity);

        // Prepend bootstrap WO as WO-0
        decomposition.work_orders.unshift(bootstrapWO);

        // Update all feature WO dependencies to include "0"
        decomposition.work_orders.slice(1).forEach((wo, index) => {
          // Original dependencies (shifted by 1 because we inserted WO-0)
          const originalDeps = (wo.dependencies || []).map(depIdx =>
            (parseInt(depIdx) + 1).toString()
          );

          // Add dependency on bootstrap WO-0
          wo.dependencies = ['0', ...originalDeps];
        });

        // Update decomposition doc to reflect bootstrap injection
        decomposition.decomposition_doc = `# Implementation Plan\n\n` +
          `## Bootstrap Phase\n\n` +
          `**WO-0 (Bootstrap):** Creates project infrastructure (package.json, tsconfig.json, src/ structure)\n\n` +
          `**Architecture Detected:** ${architecture.framework || 'TypeScript'}\n\n` +
          `**All feature work orders depend on WO-0 completing first.**\n\n` +
          `---\n\n` +
          decomposition.decomposition_doc;

        console.log(`[Architect] Bootstrap WO injected as WO-0, ${decomposition.work_orders.length - 1} feature WOs updated`);
      } else {
        console.log(`[Architect] Established project detected, no bootstrap needed`);
      }
    }
  }

  return decomposition;
}
```

**Changes summary:**
1. After standard decomposition, check if `options.projectId` provided
2. Fetch project from DB
3. Assess project maturity
4. If greenfield:
   - Infer architecture from spec + WOs
   - Generate bootstrap WO
   - Prepend as WO-0
   - Update all feature WO dependencies
   - Update decomposition doc
5. Return enhanced decomposition

**Estimated effort:** 1 hour (integration logic)

---

### Phase 5: Update Architect API Route

**File:** `src/app/api/architect/decompose/route.ts`

**Modification:** Pass `projectId` to architect service

**Current code:**
```typescript
const decomposition = await architectService.decomposeSpec(spec, {
  generateWireframes: body.generate_wireframes,
  generateContracts: body.generate_contracts
});
```

**New code:**
```typescript
const decomposition = await architectService.decomposeSpec(spec, {
  generateWireframes: body.generate_wireframes,
  generateContracts: body.generate_contracts,
  projectId: body.project_id // NEW: Pass project ID if provided
});
```

**Estimated effort:** 5 minutes (trivial change)

---

## Complete Flow After Implementation

### User submits spec for multi-llm-discussion-v1:

```
1. POST /api/architect/decompose
   Body: { spec: {...}, project_id: 'f73e8c9f-...' }

2. Architect service receives request

3. Standard decomposition runs:
   - Claude generates 5 feature WOs:
     * WO-0: "Configure Redux Store"
     * WO-1: "Implement Discussion View"
     * WO-2: "Create Provider Adapters"
     * WO-3: "Add Testing Infrastructure"
     * WO-4: "Documentation"

4. **NEW: Greenfield detection**
   - Fetch project: local_path = C:\dev\multi-llm-discussion-v1
   - Check maturity:
     * has_src: false
     * dependency_count: 3 (react, react-dom, typescript)
     * ts_file_count: 0
   - Result: is_greenfield = true (confidence: 0.95)

5. **NEW: Architecture inference**
   - Scan spec + WOs for keywords
   - Detect: "Redux store", "React components", ".tsx files"
   - Infer:
     * framework: 'react'
     * needs_jsx: true
     * state_management: 'redux'
     * required_deps: ['react', 'react-dom', '@reduxjs/toolkit', 'react-redux']
     * tsconfig: { jsx: 'react-jsx', paths: { '@/*': ['./src/*'] } }

6. **NEW: Generate bootstrap WO**
   - Title: "Bootstrap Project Infrastructure"
   - Description: "Create package.json with React + Redux deps, tsconfig with JSX..."
   - Files: ['package.json', 'tsconfig.json', 'src/index.ts']

7. **NEW: Inject bootstrap**
   - Array becomes:
     * WO-0: "Bootstrap Project Infrastructure" (deps: [])
     * WO-1: "Configure Redux Store" (deps: ['0'])
     * WO-2: "Implement Discussion View" (deps: ['0', '1'])
     * WO-3: "Create Provider Adapters" (deps: ['0', '2'])
     * WO-4: "Add Testing Infrastructure" (deps: ['0'])
     * WO-5: "Documentation" (deps: ['0', '4'])

8. Return decomposition with 6 WOs (bootstrap + 5 features)

9. User approves all 6 WOs

10. Orchestrator executes:
    - WO-0 runs first → creates package.json, tsconfig.json, src/
    - Proposer generates code that:
      * Creates package.json with react, @reduxjs/toolkit
      * Creates tsconfig.json with "jsx": "react-jsx"
      * Creates src/index.ts placeholder
    - Commit succeeds, PR created
    - **Build validation: npx tsc --noEmit → SUCCESS (no errors)**

11. WO-1 runs next → "Configure Redux Store"
    - Proposer imports '@reduxjs/toolkit' → ✅ exists in package.json
    - Creates .tsx files → ✅ JSX configured in tsconfig
    - Uses @/ imports → ✅ paths configured
    - **Build validation: SUCCESS**

12. All subsequent WOs build successfully
```

---

## Testing Strategy

### Test Case 1: Greenfield React Project (multi-llm-discussion-v1)

**Setup:**
- Empty project (no src/)
- Spec mentions: "React components", "Redux store", "TypeScript"

**Expected:**
- Detects greenfield: YES
- Infers framework: react
- Bootstrap WO includes: react, react-dom, @reduxjs/toolkit, tsconfig with JSX
- All feature WOs depend on bootstrap

**Validation:**
- WO-0 builds successfully
- Creates package.json with correct deps
- Creates tsconfig.json with JSX enabled
- WO-1+ can import React/Redux without errors

---

### Test Case 2: Established Project (moose-mission-control)

**Setup:**
- Has src/ with 50+ files
- Has 30+ dependencies in package.json

**Expected:**
- Detects greenfield: NO
- No bootstrap WO injected
- Original decomposition returned unchanged

**Validation:**
- Decomposition has standard feature WOs only
- No WO-0 bootstrap
- No dependency modifications

---

### Test Case 3: Partially Set Up Project

**Setup:**
- Has package.json with 5 dependencies
- Has tsconfig.json
- No src/ directory

**Expected:**
- Detects greenfield: YES (no src/)
- Bootstrap WO creates src/ but updates (not creates) package.json/tsconfig
- Adds missing dependencies

**Validation:**
- Bootstrap description says "Update package.json" not "Create"
- Preserves existing package.json fields
- Adds only missing dependencies

---

## Rollback Plan

**If bootstrap WO generation fails or breaks decomposition:**

1. **Immediate fix:** Add feature flag to disable
   ```typescript
   if (options?.projectId && !process.env.DISABLE_BOOTSTRAP_INJECTION) {
     // greenfield detection logic
   }
   ```

2. **Quick rollback:** Set `DISABLE_BOOTSTRAP_INJECTION=true` in .env

3. **No database changes required** - old decompositions still work

4. **No existing WOs affected** - only applies to new decompositions

---

## Risk Assessment

### Low Risk
✅ Only affects NEW decompositions (not existing WOs)
✅ Only activates for greenfield projects (established projects unaffected)
✅ Can be disabled with env var
✅ No breaking changes to API or database schema

### Medium Risk
⚠️ Architecture inference may be wrong (e.g., detects Express when should be Next.js)
- **Mitigation:** User reviews decomposition before approving WOs
- **Fallback:** User can edit bootstrap WO description before approval

⚠️ Bootstrap WO may create incorrect package.json
- **Mitigation:** Proposer validates with refinement cycle
- **Fallback:** User can manually fix in subsequent WO

### High Risk
❌ None identified

---

## Implementation Order

**Session v116 (today):**
1. ✅ Design complete (this document)
2. Create `project-inspector.ts` utility (30 min)
3. Create `bootstrap-architecture-inferrer.ts` (2 hours)
4. Create `bootstrap-wo-generator.ts` (1 hour)
5. Test utilities in isolation (30 min)

**Session v117 (next):**
6. Modify `architect-service.ts` to inject bootstrap (1 hour)
7. Update architect API route (5 min)
8. Test with multi-llm-discussion-v1 spec (30 min)
9. Validate bootstrap WO generates correctly (30 min)

**Session v118 (validation):**
10. Execute full workflow: decompose → approve → orchestrate
11. Verify WO-0 creates infrastructure correctly
12. Verify WO-1+ build successfully
13. Document results

**Total estimated effort:** 6-8 hours across 3 sessions

---

## Success Criteria

✅ **Greenfield detection works correctly**
- Empty projects detected as greenfield
- Established projects NOT detected as greenfield
- Confidence score > 0.8 for clear cases

✅ **Architecture inference is accurate**
- React specs → React dependencies + JSX config
- Redux mentions → @reduxjs/toolkit added
- Path aliases → paths config added

✅ **Bootstrap WO generates valid code**
- package.json is valid JSON with correct structure
- tsconfig.json has appropriate compiler options
- src/ directory created
- TypeScript compilation succeeds after WO-0

✅ **Feature WOs build successfully**
- No "Cannot find module" errors
- No "JSX not configured" errors
- No path alias resolution errors
- Build success rate > 90%

✅ **No regressions for established projects**
- moose-mission-control decompositions unchanged
- No bootstrap WO injected when not needed

---

## Decision Gate: Proceed?

**Ready to implement Phase 1-5 with this sequencing?**

This approach:
- ✅ Decomposes spec FIRST (architect understands features)
- ✅ Infers architecture FROM feature WOs (bootstrap knows what's needed)
- ✅ Injects bootstrap as WO-0 (executes first)
- ✅ No need to retrofit WOs (dependency chain ensures order)
- ✅ Simple and self-contained

**Alternative concerns or modifications before starting implementation?**
