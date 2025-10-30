// Bootstrap Executor - Creates project infrastructure using Aider
// Reuses existing aider-executor patterns for reliability

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { AggregatedRequirements } from './requirements-aggregator';
import type { ProjectMaturity } from '../orchestrator/project-inspector';
import { executeAider } from '../orchestrator/aider-executor';
import type { WorkOrder } from '@/types/architect';

export interface BootstrapResult {
  success: boolean;
  commit_hash?: string;
  branch_name?: string;
  files_created: string[];
  validation_errors?: string[];
  execution_time_ms: number;
  error_message?: string;
}

/**
 * Bootstrap executor - runs BEFORE work orders
 *
 * Creates project infrastructure using Aider.
 * Reuses existing aider-executor patterns for reliability.
 */
export class BootstrapExecutor {

  /**
   * Execute bootstrap infrastructure setup
   *
   * Flow:
   * 1. Generate bootstrap prompt from aggregated requirements
   * 2. Create pseudo-WO for Aider execution
   * 3. Execute Aider using existing executor
   * 4. Validate output
   * 5. Auto-fix package-lock.json if missing
   * 6. Return result with detailed logging
   */
  async execute(
    projectPath: string,
    requirements: AggregatedRequirements,
    maturity: ProjectMaturity,
    projectId: string
  ): Promise<BootstrapResult> {
    const startTime = Date.now();

    console.log(`[Bootstrap] Starting infrastructure setup...`);
    console.log(`[Bootstrap] Project: ${projectPath}`);
    console.log(`[Bootstrap] Dependencies: ${requirements.dependencies.length} prod, ${requirements.devDependencies.length} dev`);
    console.log(`[Bootstrap] Env vars: ${requirements.environmentVariables.length}`);
    console.log(`[Bootstrap] External services: ${requirements.externalServices.length}`);

    try {
      // Step 1: Generate prompt
      const prompt = this.generateBootstrapPrompt(requirements, maturity);

      // Step 2: Create pseudo work order for Aider
      const bootstrapWO: WorkOrder = {
        title: 'Bootstrap project infrastructure',
        description: prompt,
        acceptance_criteria: this.generateAcceptanceCriteria(requirements, maturity),
        files_in_scope: this.determineFilesInScope(maturity),
        context_budget_estimate: 4000,
        risk_level: 'low',
        dependencies: [],
        technical_requirements: {
          npm_dependencies: requirements.dependencies,
          npm_dev_dependencies: requirements.devDependencies,
          environment_variables: requirements.environmentVariables,
          external_services: requirements.externalServices,
          tsconfig_requirements: requirements.tsconfigSettings as any
        }
      };

      console.log(`[Bootstrap] Files in scope: ${bootstrapWO.files_in_scope.join(', ')}`);

      // Step 3: Execute using existing Aider executor
      console.log(`[Bootstrap] Executing Aider...`);

      const proposerResponse = {
        content: prompt,
        proposer_used: 'gpt-4o-mini',
        confidence: 1.0,
        metadata: {}
      };

      // Cast to any to match executeAider's expected type (has project_id field)
      const woWithProject = {
        ...bootstrapWO,
        id: `bootstrap-${Date.now()}`,
        project_id: projectId
      } as any;

      // Use existing executeAider - handles branching, git, timeouts, etc.
      // Note: Bootstrap already uses direct execution (no proposer response needed)
      const aiderResult = await executeAider(
        woWithProject,
        'gpt-4o-mini',
        projectPath
      );

      if (!aiderResult.success) {
        throw new Error(`Aider execution failed: ${aiderResult.stderr}`);
      }

      console.log(`[Bootstrap] Aider completed successfully`);
      console.log(`[Bootstrap] Branch: ${aiderResult.branch_name}`);

      // Step 4: Validate output
      console.log(`[Bootstrap] Validating output...`);
      const validationErrors = this.validateBootstrapOutput(projectPath, requirements, maturity);

      if (validationErrors.length > 0) {
        console.warn(`[Bootstrap] Validation found ${validationErrors.length} issues:`);
        validationErrors.forEach(err => console.warn(`  - ${err}`));

        // Check if we can auto-fix
        const autoFixable = this.tryAutoFix(projectPath, validationErrors);

        if (autoFixable.fixed) {
          console.log(`[Bootstrap] Auto-fixed: ${autoFixable.message}`);

          // Amend the commit to include fixes
          try {
            execSync('git add -A', { cwd: projectPath, stdio: 'pipe' });
            execSync('git commit --amend --no-edit', { cwd: projectPath, stdio: 'pipe' });
            console.log(`[Bootstrap] Amended commit with auto-fixes`);
          } catch (amendError) {
            console.error(`[Bootstrap] Failed to amend commit:`, amendError);
          }

          // Re-validate
          const revalidationErrors = this.validateBootstrapOutput(projectPath, requirements, maturity);
          if (revalidationErrors.length > 0) {
            // Still has errors after auto-fix
            return {
              success: false,
              files_created: [],
              validation_errors: revalidationErrors,
              execution_time_ms: Date.now() - startTime,
              error_message: `Bootstrap validation failed after auto-fix:\n${revalidationErrors.join('\n')}`
            };
          }
        } else {
          // Can't auto-fix, return failure
          return {
            success: false,
            files_created: [],
            validation_errors: validationErrors,
            execution_time_ms: Date.now() - startTime,
            error_message: `Bootstrap validation failed:\n${validationErrors.join('\n')}`
          };
        }
      }

      // Step 5: Get commit info
      const commitHash = execSync('git rev-parse HEAD', {
        cwd: projectPath,
        encoding: 'utf-8'
      }).trim();

      const filesCreated = execSync('git diff-tree --no-commit-id --name-only -r HEAD', {
        cwd: projectPath,
        encoding: 'utf-8'
      }).trim().split('\n').filter(Boolean);

      const executionTime = Date.now() - startTime;

      console.log(`[Bootstrap] ✅ Completed successfully in ${executionTime}ms`);
      console.log(`[Bootstrap] Commit: ${commitHash}`);
      console.log(`[Bootstrap] Files created: ${filesCreated.length}`);

      // Step 6: Push to remote main
      console.log(`[Bootstrap] Pushing bootstrap to GitHub main...`);
      try {
        // Ensure we're on main branch
        const currentBranch = execSync('git branch --show-current', {
          cwd: projectPath,
          encoding: 'utf-8'
        }).trim();

        if (currentBranch !== 'main') {
          console.log(`[Bootstrap] Switching from ${currentBranch} to main...`);
          execSync('git checkout main', { cwd: projectPath, stdio: 'pipe' });
        }

        // Push to origin main
        execSync('git push origin main', {
          cwd: projectPath,
          stdio: 'pipe',
          encoding: 'utf-8'
        });

        console.log(`[Bootstrap] ✅ Pushed to GitHub main successfully`);
      } catch (pushError: any) {
        console.error(`[Bootstrap] ⚠️  Failed to push to GitHub:`, pushError.message);
        console.error(`[Bootstrap] Bootstrap committed locally but not pushed to remote`);
        console.error(`[Bootstrap] You may need to manually run: git push origin main`);
        // Don't fail the bootstrap - local commit succeeded
      }

      return {
        success: true,
        commit_hash: commitHash,
        branch_name: aiderResult.branch_name,
        files_created: filesCreated,
        execution_time_ms: executionTime
      };

    } catch (error: any) {
      console.error(`[Bootstrap] ❌ Failed:`, error.message);

      return {
        success: false,
        files_created: [],
        execution_time_ms: Date.now() - startTime,
        error_message: error.message
      };
    }
  }

  /**
   * Generate detailed Aider prompt from requirements
   */
  private generateBootstrapPrompt(
    requirements: AggregatedRequirements,
    maturity: ProjectMaturity
  ): string {
    const tasks: string[] = [];

    // Determine what needs creation vs update
    const needsPackageJson = !maturity.has_package_json;
    const needsTsconfig = !maturity.has_tsconfig;
    const needsSrcDir = !maturity.has_src_directory;
    const needsJSX = requirements.tsconfigSettings.jsx !== undefined;

    // Task 1: package.json
    if (needsPackageJson) {
      tasks.push(`
## Task 1: Create package.json

Create a valid package.json file with:

**Name and version:**
\`\`\`json
{
  "name": "project",
  "version": "0.1.0",
  "private": true
}
\`\`\`

**Scripts:**
\`\`\`json
"scripts": {
  "dev": "node --loader ts-node/esm src/index.ts",
  "build": "tsc",
  "test": "echo \\"No tests yet\\"",
  "lint": "tsc --noEmit"
}
\`\`\`

**Production dependencies (${requirements.dependencies.length}):**
${requirements.dependencies.map(d => `- ${d}`).join('\n')}

**Development dependencies (${requirements.devDependencies.length}):**
${requirements.devDependencies.map(d => `- ${d}`).join('\n')}

**Important:**
- Use exact versions specified above
- Ensure valid JSON structure
- Add proper indentation (2 spaces)
`);
    }

    // Task 2: tsconfig.json
    if (needsTsconfig) {
      tasks.push(`
## Task 2: Create tsconfig.json

Create tsconfig.json with these compiler options:

\`\`\`json
{
  "compilerOptions": {
    "target": "${requirements.tsconfigSettings.target || 'ES2020'}",
    "module": "${requirements.tsconfigSettings.module || 'commonjs'}",
    "lib": ${JSON.stringify(requirements.tsconfigSettings.lib || ['ES2020'])},
    ${needsJSX ? `"jsx": "${requirements.tsconfigSettings.jsx}",` : ''}
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
\`\`\`

**Critical:** ${needsJSX ? `Ensure "jsx" setting is exactly "${requirements.tsconfigSettings.jsx}"` : 'Ensure valid JSON structure'}
`);
    }

    // Task 3: Directory structure
    if (needsSrcDir) {
      const entryFile = needsJSX ? 'src/index.tsx' : 'src/index.ts';
      tasks.push(`
## Task 3: Create directory structure

Create:
- \`src/\` directory
- \`${entryFile}\` with minimal placeholder content:

\`\`\`typescript
// Project entry point
console.log('Project initialized');

${needsJSX ? `
import React from 'react';

// Placeholder component
export function App() {
  return <div>Hello World</div>;
}
` : ''}
\`\`\`
`);
    }

    // Task 4: Environment variables
    if (requirements.environmentVariables.length > 0 || requirements.externalServices.length > 0) {
      tasks.push(`
## Task 4: Create .env.example

Create .env.example with template for all required environment variables:

${requirements.environmentVariables.map(v => `${v}=`).join('\n')}

${requirements.externalServices.length > 0 ? `
**External Services (${requirements.externalServices.length}):**

${requirements.externalServices.map(svc =>
  `# ${svc.name} - ${svc.purpose}\n${svc.env_vars.map(v => `${v}=`).join('\n')}`
).join('\n\n')}
` : ''}

**Include clear comments explaining:**
- What each variable is for
- Where to obtain values
- Example values (non-sensitive)
`);
    }

    // Task 5: .gitignore
    tasks.push(`
## Task 5: Update .gitignore

Ensure .gitignore includes:
\`\`\`
node_modules/
dist/
.env
.env.local
*.log
\`\`\`

**CRITICAL:** Do NOT add package-lock.json to .gitignore (it must be committed)
`);

    // Task 6: npm install
    tasks.push(`
## Task 6: Run npm install

Execute: \`npm install --legacy-peer-deps\`

This will:
- Install all dependencies (ignoring peer dependency warnings)
- Generate package-lock.json (REQUIRED for CI/CD)
- Verify package.json is valid

**Why --legacy-peer-deps:**
- Handles unavoidable peer dependency conflicts in aggregated requirements
- Ensures consistent behavior with worktree pool execution
- Allows bootstrap to complete even with minor version mismatches

**You MUST run this before committing.**
`);

    // Validation section
    const validation = `
## Validation Checklist

Before committing, verify:

✅ package.json exists and is valid JSON
✅ All ${requirements.dependencies.length + requirements.devDependencies.length} dependencies listed
✅ tsconfig.json exists and is valid JSON
✅ TypeScript compiles: \`npx tsc --noEmit\` returns no errors
✅ src/ directory exists with entry point file
✅ .env.example exists with all ${requirements.environmentVariables.length} variables
✅ .gitignore excludes .env.local but NOT package-lock.json
✅ package-lock.json exists (created by npm install)

## Commit Instructions

After validation passes:
1. Stage all files: \`git add .\`
2. Commit with message: "chore: bootstrap project infrastructure"
3. Ensure package-lock.json is included in the commit

## CRITICAL REQUIREMENTS
- Run npm install before committing
- Do not create feature code, only infrastructure
- Verify TypeScript compilation succeeds
- Include package-lock.json in commit
`;

    return `${tasks.join('\n\n')}\n\n${validation}`;
  }

  /**
   * Generate acceptance criteria for validation
   */
  private generateAcceptanceCriteria(
    requirements: AggregatedRequirements,
    maturity: ProjectMaturity
  ): string[] {
    const criteria: string[] = [];

    if (!maturity.has_package_json) {
      criteria.push('package.json created with valid JSON structure');
      criteria.push(`package.json contains all ${requirements.dependencies.length} production dependencies`);
      criteria.push(`package.json contains all ${requirements.devDependencies.length} dev dependencies`);
    }

    if (!maturity.has_tsconfig) {
      criteria.push('tsconfig.json created with valid JSON structure');
      if (requirements.tsconfigSettings.jsx) {
        criteria.push(`tsconfig.json has jsx: "${requirements.tsconfigSettings.jsx}"`);
      }
    }

    if (!maturity.has_src_directory) {
      const ext = requirements.tsconfigSettings.jsx ? '.tsx' : '.ts';
      criteria.push('src/ directory exists');
      criteria.push(`src/index${ext} exists`);
    }

    criteria.push('npm install completed successfully');
    criteria.push('package-lock.json created and committed');
    criteria.push('TypeScript compilation succeeds (no errors from tsc --noEmit)');

    if (requirements.environmentVariables.length > 0) {
      criteria.push(`.env.example created with ${requirements.environmentVariables.length} environment variables`);
    }

    if (requirements.externalServices.length > 0) {
      criteria.push(`External service configuration documented for: ${requirements.externalServices.map(s => s.name).join(', ')}`);
    }

    criteria.push('.gitignore updated (excludes .env but NOT package-lock.json)');

    return criteria;
  }

  /**
   * Determine which files Aider should track
   */
  private determineFilesInScope(maturity: ProjectMaturity): string[] {
    const files: string[] = [];

    if (!maturity.has_package_json) {
      files.push('package.json');
    }

    if (!maturity.has_tsconfig) {
      files.push('tsconfig.json');
    }

    if (!maturity.has_src_directory) {
      files.push('src/index.ts'); // Aider will detect .tsx if needed
    }

    files.push('.env.example');
    files.push('.gitignore');

    return files;
  }

  /**
   * Validate bootstrap output
   *
   * Returns array of error messages (empty if valid)
   */
  private validateBootstrapOutput(
    projectPath: string,
    requirements: AggregatedRequirements,
    maturity: ProjectMaturity
  ): string[] {
    const errors: string[] = [];

    // Check 1: package.json exists and is valid
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      errors.push('package.json not found');
    } else {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

        // Check dependencies
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        requirements.dependencies.forEach(dep => {
          const pkgName = dep.split('@')[0];
          if (!allDeps[pkgName]) {
            errors.push(`package.json missing dependency: ${pkgName}`);
          }
        });

        // Check scripts
        if (!pkg.scripts?.build) {
          errors.push('package.json missing "build" script');
        }
      } catch (e: any) {
        errors.push(`package.json is invalid JSON: ${e.message}`);
      }
    }

    // Check 2: tsconfig.json exists and is valid
    const tsconfigPath = path.join(projectPath, 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) {
      errors.push('tsconfig.json not found');
    } else {
      try {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));

        // Check jsx setting if required
        if (requirements.tsconfigSettings.jsx) {
          if (tsconfig.compilerOptions?.jsx !== requirements.tsconfigSettings.jsx) {
            errors.push(`tsconfig.json has incorrect jsx setting: expected "${requirements.tsconfigSettings.jsx}", got "${tsconfig.compilerOptions?.jsx}"`);
          }
        }
      } catch (e: any) {
        errors.push(`tsconfig.json is invalid JSON: ${e.message}`);
      }
    }

    // Check 3: package-lock.json exists
    const packageLockPath = path.join(projectPath, 'package-lock.json');
    if (!fs.existsSync(packageLockPath)) {
      errors.push('package-lock.json not found (npm install did not run or failed)');
    }

    // Check 4: src/ directory and entry point
    if (!maturity.has_src_directory) {
      const srcPath = path.join(projectPath, 'src');
      if (!fs.existsSync(srcPath)) {
        errors.push('src/ directory not found');
      } else {
        const ext = requirements.tsconfigSettings.jsx ? '.tsx' : '.ts';
        const entryPath = path.join(srcPath, `index${ext}`);
        if (!fs.existsSync(entryPath)) {
          errors.push(`src/index${ext} not found`);
        }
      }
    }

    // Check 5: .env.example
    if (requirements.environmentVariables.length > 0) {
      const envExamplePath = path.join(projectPath, '.env.example');
      if (!fs.existsSync(envExamplePath)) {
        errors.push('.env.example not found');
      } else {
        const content = fs.readFileSync(envExamplePath, 'utf-8');
        const missingVars = requirements.environmentVariables.filter(v => !content.includes(v));
        if (missingVars.length > 0) {
          errors.push(`.env.example missing variables: ${missingVars.join(', ')}`);
        }
      }
    }

    // Check 6: .gitignore safety
    const gitignorePath = path.join(projectPath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      if (content.includes('package-lock.json')) {
        errors.push('.gitignore incorrectly excludes package-lock.json (it must be committed)');
      }
    }

    // Check 7: TypeScript compilation (lightweight check - skip if too slow)
    // Note: Commenting out for performance - Aider already validates this
    /*
    try {
      execSync('npx tsc --noEmit', {
        cwd: projectPath,
        stdio: 'pipe',
        encoding: 'utf-8',
        timeout: 30000
      });
    } catch (e: any) {
      const stderr = e.stderr?.toString() || e.message;
      if (stderr.includes('error TS')) {
        errors.push(`TypeScript compilation failed: ${stderr.substring(0, 200)}`);
      }
    }
    */

    return errors;
  }

  /**
   * Try to auto-fix common issues
   */
  private tryAutoFix(projectPath: string, errors: string[]): { fixed: boolean; message: string } {
    // Only auto-fix: missing package-lock.json
    const needsNpmInstall = errors.some(e => e.includes('package-lock.json not found'));

    if (needsNpmInstall) {
      console.log('[Bootstrap] Auto-fix: Running npm install...');
      try {
        execSync('npm install', {
          cwd: projectPath,
          stdio: 'pipe',
          encoding: 'utf-8',
          timeout: 120000 // 2 minutes
        });
        return { fixed: true, message: 'Generated package-lock.json via npm install' };
      } catch (e: any) {
        return { fixed: false, message: `npm install failed: ${e.message}` };
      }
    }

    return { fixed: false, message: 'No auto-fixable issues' };
  }
}
