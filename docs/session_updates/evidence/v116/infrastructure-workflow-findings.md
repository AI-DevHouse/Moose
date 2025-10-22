# Infrastructure Creation Workflow - Investigation Findings

**Date:** 2025-10-22
**Session:** v116
**Question:** Where is project infrastructure created and how do proposers get architecture context?

---

## Key Findings Summary

**CRITICAL GAP IDENTIFIED:** There is **NO automated infrastructure bootstrapping** in the current workflow. The system expects projects to already have source code infrastructure in place before executing work orders.

---

## 1. Project Initialization Flow

### What DOES Happen (`/api/projects/initialize`):

**Files Created:**
- `.env.local.template` - Environment variable template
- `.gitignore` - Git ignore rules
- `SETUP_INSTRUCTIONS.md` - Manual setup guide
- `README.md` - Basic project readme
- Git repository initialized with initial commit

**Source:** `src/app/api/projects/initialize/route.ts:64-76`

### What DOES NOT Happen:

❌ **No `package.json` created**
❌ **No `tsconfig.json` created**
❌ **No `src/` directory created**
❌ **No starter code or project scaffold**
❌ **No dependency installation**
❌ **No build configuration**

**Result:** Projects are created as **empty shells** - just git + docs, no compilable code.

---

## 2. Architecture Context Propagation

### How Proposers Currently Receive Context:

**From Work Order (`src/lib/orchestrator/proposer-executor.ts:13-23`):**
```typescript
{
  task_description: buildEnhancedTaskDescription(wo),
  context: wo.files_in_scope || [],  // ← Just file paths from WO
  security_context: mapRiskToSecurityContext(wo.risk_level),
  expected_output_type: 'code',
  metadata: { work_order_id: wo.id }
}
```

**From Project (`src/lib/enhanced-proposer-service.ts:268-365`):**
The proposer service reads:
- `package.json` → extracts dependency list
- Scans `src/lib`, `src/types`, `src/utils` → builds module list with `@/` paths

**What Proposers DO NOT Receive:**
❌ Architecture documentation
❌ README content
❌ Project structure guidelines
❌ Technology stack specification
❌ Build configuration requirements
❌ Existing tsconfig.json settings

---

## 3. Architect Decomposition Process

### What Architect DOES (`src/lib/architect-decomposition-rules.ts`):

**Input:** Technical specification (feature name, objectives, constraints, acceptance criteria)

**Output:** Array of work orders with:
- Title and description
- Acceptance criteria
- **`files_in_scope`** - file paths to create/modify
- Token budget estimate
- Risk level
- Dependencies (sequential only)

**Source:** `src/lib/architect-decomposition-rules.ts:25-153`

### What Architect DOES NOT Do:

❌ Check if project has existing code
❌ Generate "bootstrap infrastructure" WO
❌ Validate package.json dependencies needed
❌ Create tsconfig.json configuration WO
❌ Read or reference project README/ARCHITECTURE
❌ Detect greenfield vs established project

**Architect Assumption:** Project already has compilable codebase before WO execution begins.

---

## 4. Infrastructure Creation Gap Analysis

### The Missing Workflow:

```
CURRENT FLOW (broken for greenfield):
1. User creates project → empty directory + git + docs
2. User submits spec → architect decomposes to WOs
3. Orchestrator executes WO-0 → proposer generates code
4. Proposer imports @reduxjs/toolkit → ❌ not in package.json
5. Proposer creates .tsx file → ❌ JSX not configured in tsconfig
6. Proposer runs code → ❌ BUILD FAILS

WHAT'S NEEDED (greenfield bootstrap):
1. User creates project → empty directory
2. User submits spec → architect decomposes
3. ⚠️ DETECT: No src/ directory, no package.json
4. 🆕 INJECT: "WO-0: Bootstrap Project Infrastructure" before other WOs
5. WO-0 creates: package.json, tsconfig.json, src/ structure, installs deps
6. WO-1+ execute normally → can now import deps and compile
```

---

## 5. Root Cause: multi-llm-discussion-v1 Build Failures

### Why All PRs Failed to Build:

**Project State:**
- Created via project initialization (or manually with same result)
- Has: `README.md` (1 line), `package.json` (minimal deps), `tsconfig.json`
- **Missing:** `src/` directory (empty project)

**Work Orders Generated:**
- WO-0: "Configure Redux Toolkit Store" → creates `src/renderer/store/` files
- WO-1: "Complete Documentation" → creates docs/config files
- WO-2: "Configure Testing Infrastructure" → creates `test/` files
- WO-3: "Implement Discussion View" → creates React components
- WO-4: "Implement Claude Adapter" → creates services

**Why They Fail:**
1. **WO-0 imports `@reduxjs/toolkit`** but never adds it to package.json → import error
2. **WO-3 creates `.tsx` files** but never adds `"jsx": "react"` to tsconfig.json → JSX error
3. **WO-3 imports `@/store`** but never configures path aliases in tsconfig.json → module not found
4. **WO-4 imports from relative files** it creates in same PR → circular import errors

**Proposer Blind Spots:**
- Doesn't read package.json before importing
- Doesn't read tsconfig.json before using JSX or path aliases
- Doesn't update config files when adding new requirements
- Doesn't validate build succeeds before committing

---

## 6. Proposed Solutions

### Option A: Greenfield Detection + Bootstrap WO (Recommended)

**Implementation:**

1. **Add Project Maturity Detection** (`src/lib/orchestrator/project-inspector.ts`):
   ```typescript
   interface ProjectMaturity {
     is_greenfield: boolean;
     has_src_directory: boolean;
     has_package_json: boolean;
     has_tsconfig: boolean;
     dependency_count: number;
     existing_file_count: number;
   }

   function assessProjectMaturity(projectPath: string): ProjectMaturity
   ```

2. **Modify Architect to Inject Bootstrap WO** (`src/lib/architect-service.ts`):
   ```typescript
   async decomposeSpec(spec, options) {
     const decomposition = await this.generateDecomposition(spec);

     // NEW: Check project maturity
     if (options.projectId) {
       const project = await projectService.getProject(options.projectId);
       const maturity = assessProjectMaturity(project.local_path);

       if (maturity.is_greenfield) {
         // Inject bootstrap WO as WO-0, shift others
         const bootstrapWO = this.generateBootstrapWO(spec, maturity);
         decomposition.work_orders.unshift(bootstrapWO);

         // Update dependencies: all WOs now depend on WO-0
         decomposition.work_orders.slice(1).forEach(wo => {
           wo.dependencies = ['0', ...(wo.dependencies || [])];
         });
       }
     }

     return decomposition;
   }
   ```

3. **Create Bootstrap WO Generator** (`src/lib/bootstrap-wo-generator.ts`):
   ```typescript
   function generateBootstrapWO(spec: TechnicalSpec, maturity: ProjectMaturity): WorkOrder {
     return {
       title: "Bootstrap Project Infrastructure",
       description: `
         Initialize project with required dependencies and configuration:
         - Create package.json with dependencies: ${inferDependencies(spec)}
         - Create tsconfig.json with: ${inferTSConfig(spec)}
         - Create src/ directory structure
         - Install dependencies (npm install)
         - Validate build succeeds
       `,
       acceptance_criteria: [
         "package.json created with all required dependencies",
         "tsconfig.json configured for project needs",
         "src/ directory structure created",
         "Dependencies installed successfully",
         "TypeScript compilation succeeds (npx tsc --noEmit)"
       ],
       files_in_scope: ["package.json", "tsconfig.json", "src/index.ts"],
       context_budget_estimate: 500,
       risk_level: "low",
       dependencies: []
     };
   }
   ```

**Advantages:**
- Minimal code changes
- Preserves existing workflow for established projects
- Explicit "infrastructure WO" visible to user
- Clear dependency tree (all WOs depend on bootstrap)

**Estimated Effort:** 2-3 WOs

---

### Option B: Smart Proposer with Config Awareness

**Implementation:**

1. **Enhance Proposer Context Reading** (`src/lib/enhanced-proposer-service.ts:400+`):
   ```typescript
   private buildInfrastructureContext(projectPath: string): {
     needs_package_json_update: boolean;
     needs_tsconfig_update: boolean;
     missing_dependencies: string[];
     missing_config: string[];
   } {
     // Read existing package.json and tsconfig.json
     // Compare against imports in task_description
     // Return needed updates
   }
   ```

2. **Add Pre-Generation Validation** (new method):
   ```typescript
   async generateProposal(request: ProposerRequest): Promise<ProposerResponse> {
     // NEW: Check if task requires infrastructure updates
     const infraNeeds = this.buildInfrastructureContext(projectPath);

     if (infraNeeds.needs_package_json_update) {
       // Prompt proposer to update package.json first
       prompt += `\nBEFORE generating code, update package.json to add: ${infraNeeds.missing_dependencies}`;
     }

     if (infraNeeds.needs_tsconfig_update) {
       prompt += `\nBEFORE generating code, update tsconfig.json to add: ${infraNeeds.missing_config}`;
     }

     // Generate code + config updates atomically
     const response = await this.callProposer(prompt);

     // NEW: Validate build succeeds
     await this.validateBuild(projectPath);

     return response;
   }
   ```

3. **Add Build Validation** (new service):
   ```typescript
   async validateBuild(projectPath: string): Promise<BuildValidation> {
     const result = execSync('npx tsc --noEmit', { cwd: projectPath });

     if (result.exitCode !== 0) {
       // Parse TypeScript errors
       // Classify (import, type, config)
       // Trigger self-refinement if fixable
       throw new BuildValidationError(errors);
     }
   }
   ```

**Advantages:**
- Works for any project (greenfield or established)
- Proposer becomes self-sufficient
- No special "bootstrap WO" needed
- Fixes errors reactively

**Disadvantages:**
- More complex proposer logic
- Longer execution time (validation + possible refinement)
- May miss edge cases
- No explicit infrastructure visibility to user

**Estimated Effort:** 4-6 WOs

---

### Option C: Hybrid (Recommended for Production)

Combine both approaches:

**Phase 1 (Immediate):** Implement Option A (greenfield detection + bootstrap WO)
**Phase 2 (Post-validation):** Add Option B validation for all proposers

**Rationale:**
- Option A fixes greenfield projects immediately with minimal risk
- Option B catches edge cases in established projects
- Defense-in-depth approach

---

## 7. Answers to Original Questions

### Q1: "Where is infrastructure created?"

**A:** **Nowhere automatically.** The `/api/projects/initialize` route creates docs/git only. Users must manually create package.json, tsconfig.json, src/ structure, OR the first WO must do it (but currently doesn't).

### Q2: "Is it a separate action or the first WO?"

**A:** **Neither currently exists.** There is no infrastructure creation action, and the architect doesn't generate infrastructure WOs. Work orders assume infrastructure already exists.

### Q3: "How do proposers get architecture context?"

**A:** **They don't.** Proposers receive:
- Work order description
- File paths (files_in_scope)
- Dependency list from package.json (if it exists)
- Module paths from project scan

Proposers DO NOT receive:
- README content
- Architecture documentation
- Technology stack specification
- Build configuration details

---

## 8. Immediate Action for v116

**Test Option B manually first:**

Create 3 test WOs on **moose-mission-control** (established project with existing infrastructure) to validate:
1. Proposer works correctly when package.json/tsconfig.json exist
2. Proposer doesn't break builds in established projects
3. Error pattern differs from multi-llm-discussion-v1

**If moose tests pass → confirms greenfield is the issue → implement Option A**
**If moose tests fail → proposer has deeper issues → implement Option B first**

---

## 9. References

**Code Locations:**
- Project initialization: `src/app/api/projects/initialize/route.ts`
- Proposer context: `src/lib/enhanced-proposer-service.ts:51-62, 268-365`
- Proposer request: `src/lib/orchestrator/proposer-executor.ts:13-24`
- Architect decomposition: `src/lib/architect-decomposition-rules.ts:25-153`
- Template generator: `src/lib/project-template-generator.ts`

**Evidence:**
- multi-llm-discussion-v1 file listing: `evidence/v116/build-failure-analysis.md` (Appendix)
- PR error logs: `evidence/v116/error-classification.json`

---

**Investigation Complete**
**Decision Gate:** Proceed with moose-mission-control test (Option B validation) before implementing fixes.
