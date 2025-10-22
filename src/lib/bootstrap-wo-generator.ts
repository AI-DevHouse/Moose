import type { WorkOrder } from '../types/architect';
import type { InferredArchitecture } from './bootstrap-architecture-inferrer';
import type { ProjectMaturity } from './orchestrator/project-inspector';
import type { DetectedRequirement } from './requirement-analyzer';

/**
 * Generates a bootstrap work order (WO-0) that creates project infrastructure
 *
 * The bootstrap WO creates:
 * - package.json with required dependencies
 * - tsconfig.json with appropriate compiler options
 * - src/ directory structure
 * - Basic entry point file
 * - .env.example with framework + service-specific environment variables
 *
 * @param arch - Inferred architecture from spec/WOs
 * @param maturity - Project maturity assessment
 * @param requirements - Optional detected external service requirements
 * @returns WorkOrder for bootstrapping infrastructure
 */
export function generateBootstrapWO(
  arch: InferredArchitecture,
  maturity: ProjectMaturity,
  requirements?: DetectedRequirement[]
): WorkOrder {
  const tasks: string[] = [];

  // Determine what needs to be created vs updated
  const needsPackageJson = !maturity.has_package_json || maturity.package_json_dependency_count < 3;
  const needsTsconfig = !maturity.has_tsconfig || arch.needs_jsx;
  const needsSrcDir = !maturity.has_src_directory;

  if (needsPackageJson) {
    if (!maturity.has_package_json) {
      tasks.push('Create package.json with required dependencies');
    } else {
      tasks.push('Update package.json to add missing dependencies');
    }
  }

  if (needsTsconfig) {
    if (!maturity.has_tsconfig) {
      tasks.push('Create tsconfig.json with appropriate compiler options');
    } else {
      tasks.push('Update tsconfig.json to add JSX and path configuration');
    }
  }

  if (needsSrcDir) {
    tasks.push('Create src/ directory structure');
    tasks.push('Create placeholder src/index.ts file');
  }

  // Always create .env.example for new projects (best practice)
  tasks.push('Create .env.example with environment variable template');

  // Build detailed description
  const frameworkName = arch.framework || 'TypeScript';
  const frameworkDisplay = frameworkName.charAt(0).toUpperCase() + frameworkName.slice(1);

  const description = `
Bootstrap project infrastructure to support ${frameworkDisplay} development.

## Tasks:
${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Required Dependencies:
${arch.required_dependencies.length > 0 ? arch.required_dependencies.join(', ') : 'None (TypeScript only)'}

## Required Dev Dependencies:
${arch.required_dev_dependencies.join(', ')}

## TypeScript Configuration:
${Object.keys(arch.tsconfig_settings).length > 0 ? JSON.stringify(arch.tsconfig_settings, null, 2) : 'Standard configuration'}

## Environment Variables Template (.env.example):
Create a complete template file that users can copy to .env.local and fill in their secrets.

**Framework Variables:**
- NODE_ENV (development/production)
${arch.framework === 'nextjs' ? '- NEXT_PUBLIC_* variables for client-side config\n' : ''}${arch.framework === 'electron' ? '- Electron-specific environment variables\n' : ''}${arch.state_management === 'redux' ? '- Redux DevTools configuration (REDUX_DEVTOOLS_ENABLED)\n' : ''}
${requirements && requirements.length > 0 ? `**External Service Requirements (${requirements.length} detected):**
${requirements.map(req =>
  `- ${req.service} (${req.category})${req.required ? ' - REQUIRED' : ' - Optional'}
  Variable: ${req.env_var}
  Setup: ${req.instructions}
  Get from: ${req.setup_url}`
).join('\n')}

` : '**No external service dependencies detected.**\n'}
**Important:**
- Copy .env.example to .env.local and fill in actual values
- Include .env.example in git, but ensure .env.local is in .gitignore
- Add clear comments for each variable explaining what it's for

## Validation:
- Ensure package.json has valid JSON structure
- Ensure tsconfig.json has valid JSON structure
- Run \`npm install\` to verify dependencies can be installed
- Run \`npx tsc --noEmit\` to verify TypeScript compilation succeeds
- Commit all configuration files

## Important:
- Do NOT create feature code yet (only infrastructure)
- Do NOT run npm install yourself (list dependencies in package.json, orchestrator will handle installation)
- Ensure all paths and configurations are correct before committing
- Create minimal, valid configuration files
`.trim();

  // Build acceptance criteria
  const acceptanceCriteria: string[] = [];

  if (needsPackageJson) {
    acceptanceCriteria.push('package.json created/updated with all required dependencies');
    acceptanceCriteria.push('package.json has valid JSON structure and can be parsed');
  }

  if (needsTsconfig) {
    acceptanceCriteria.push('tsconfig.json configured with appropriate compiler options');
    acceptanceCriteria.push('tsconfig.json has valid JSON structure and can be parsed');
  }

  if (needsSrcDir) {
    acceptanceCriteria.push('src/ directory structure exists');
    acceptanceCriteria.push('src/index.ts created as entry point (can be empty or minimal)');
  }

  acceptanceCriteria.push('TypeScript compilation succeeds (npx tsc --noEmit returns no errors)');

  // Environment variable criteria
  if (requirements && requirements.length > 0) {
    acceptanceCriteria.push(`.env.example created with framework variables AND ${requirements.length} detected service requirement(s)`);
    // List critical services
    const criticalServices = requirements.filter(r => r.required);
    if (criticalServices.length > 0) {
      acceptanceCriteria.push(`Critical services included: ${criticalServices.map(r => r.service).join(', ')}`);
    }
  } else {
    acceptanceCriteria.push('.env.example created with framework-appropriate environment variable template');
  }

  acceptanceCriteria.push('.env.local added to .gitignore (if not already present)');
  acceptanceCriteria.push('All configuration files committed to git');

  // Framework-specific acceptance criteria
  if (arch.needs_jsx) {
    acceptanceCriteria.push('tsconfig.json includes "jsx": "react-jsx" or "jsx": "react"');
  }

  if (arch.tsconfig_settings.paths) {
    acceptanceCriteria.push('tsconfig.json includes path aliases configuration (@/* mapping)');
  }

  if (arch.framework === 'electron') {
    acceptanceCriteria.push('Electron entry point configured (main process file reference in package.json)');
  }

  // Build files in scope
  const filesInScope: string[] = [];

  if (needsPackageJson) {
    filesInScope.push('package.json');
  }

  if (needsTsconfig) {
    filesInScope.push('tsconfig.json');
  }

  if (needsSrcDir) {
    filesInScope.push('src/index.ts');
  }

  // Always add .env.example (best practice for any project)
  filesInScope.push('.env.example');
  filesInScope.push('.gitignore'); // May need to update to exclude .env.local

  // Build context budget estimate
  // Bootstrap is typically straightforward - 500-1000 tokens
  const contextBudget = 500 + (filesInScope.length * 100);

  return {
    title: 'Bootstrap Project Infrastructure',
    description,
    acceptance_criteria: acceptanceCriteria,
    files_in_scope: filesInScope,
    context_budget_estimate: contextBudget,
    risk_level: 'low',
    dependencies: [] // Bootstrap has no dependencies (it's WO-0)
  };
}
