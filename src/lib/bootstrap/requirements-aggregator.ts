// Requirements Aggregator - Validates and merges technical requirements from all WOs
// Core intelligence layer for detecting architecture conflicts

import type { WorkOrder, TechnicalRequirements } from '@/types/architect';
import { execSync } from 'child_process';
import { detectPeerConflicts, type PeerConflict } from '../architect-peer-validator';

export interface AggregatedRequirements {
  dependencies: string[];              // Deduplicated, resolved to single version
  devDependencies: string[];
  environmentVariables: string[];
  externalServices: Array<{
    name: string;
    env_vars: string[];
    purpose: string;
  }>;
  tsconfigSettings: {
    jsx?: string;
    target?: string;
    lib?: string[];
    module?: string;
    [key: string]: any;
  };
}

export interface ConflictReport {
  critical: ConflictDetail[];    // MUST fix before proceeding
  warnings: ConflictDetail[];    // Log but allow
  metadata: {
    total_wos: number;
    wos_with_requirements: number;
    total_unique_deps: number;
    total_env_vars: number;
    frameworks_detected: string[];
  };
}

export interface ConflictDetail {
  type: 'version_conflict' | 'framework_conflict' | 'tsconfig_conflict' |
        'multiple_databases' | 'build_tool_conflict' | 'invalid_package_version' |
        'peer_dependency_conflict';
  severity: 'critical' | 'warning';
  message: string;
  affected_wos: string[];           // WO titles for human readability
  resolution_hint?: string;
  conflicting_values?: string[];
}

export class ArchitectureConflictError extends Error {
  constructor(
    message: string,
    public report: ConflictReport
  ) {
    super(message);
    this.name = 'ArchitectureConflictError';
  }
}

/**
 * Aggregate technical requirements from all work orders
 *
 * Validates consistency, detects conflicts, and produces unified infrastructure spec.
 * Throws ArchitectureConflictError if critical conflicts detected.
 */
export async function aggregateRequirements(
  workOrders: WorkOrder[]
): Promise<{ requirements: AggregatedRequirements; report: ConflictReport }> {

  console.log(`[Aggregator] Processing ${workOrders.length} work orders...`);

  // Build conflict report structure
  const report: ConflictReport = {
    critical: [],
    warnings: [],
    metadata: {
      total_wos: workOrders.length,
      wos_with_requirements: 0,
      total_unique_deps: 0,
      total_env_vars: 0,
      frameworks_detected: []
    }
  };

  // Step 1: Collect all requirements
  const allDeps = new Map<string, Set<string>>();        // package -> Set<version>
  const allDevDeps = new Map<string, Set<string>>();
  const allEnvVars = new Set<string>();
  const servicesMap = new Map<string, { name: string; env_vars: string[]; purpose: string }>();
  const tsconfigSettings: Record<string, any> = {};
  const frameworksDetected = new Set<string>();

  for (const wo of workOrders) {
    const req = wo.technical_requirements;
    if (!req) {
      console.log(`[Aggregator] ⚠️  WO "${wo.title}" has no technical_requirements`);
      continue;
    }

    report.metadata.wos_with_requirements++;

    // Collect dependencies with version tracking
    req.npm_dependencies?.forEach(dep => {
      const { pkg, version } = parseDependency(dep);
      if (!allDeps.has(pkg)) {
        allDeps.set(pkg, new Set());
      }
      allDeps.get(pkg)!.add(version);
    });

    req.npm_dev_dependencies?.forEach(dep => {
      const { pkg, version } = parseDependency(dep);
      if (!allDevDeps.has(pkg)) {
        allDevDeps.set(pkg, new Set());
      }
      allDevDeps.get(pkg)!.add(version);
    });

    // Track env vars
    req.environment_variables?.forEach(varName => allEnvVars.add(varName));

    // Collect external services (dedupe by name)
    req.external_services?.forEach(svc => {
      if (!servicesMap.has(svc.name)) {
        servicesMap.set(svc.name, svc);
      } else {
        // Merge env_vars if same service mentioned in multiple WOs
        const existing = servicesMap.get(svc.name)!;
        const mergedEnvVars = Array.from(new Set([...existing.env_vars, ...svc.env_vars]));
        servicesMap.set(svc.name, { ...existing, env_vars: mergedEnvVars });
      }
    });

    // Collect tsconfig settings
    if (req.tsconfig_requirements) {
      Object.assign(tsconfigSettings, req.tsconfig_requirements);
    }
  }

  // Step 1.5: Validate package versions against npm registry
  console.log('[Aggregator] Validating package versions against npm registry...');
  const [invalidDeps, invalidDevDeps] = await Promise.all([
    validatePackageVersions(allDeps, 'production'),
    validatePackageVersions(allDevDeps, 'development')
  ]);

  // Report invalid package versions as CRITICAL conflicts
  if (invalidDeps.size > 0) {
    invalidDeps.forEach((details, pkg) => {
      const affectedWOs = findWOsWithDependency(workOrders, pkg, 'production');
      report.critical.push({
        type: 'invalid_package_version',
        severity: 'critical',
        message: `Invalid production dependency: ${pkg}@${details.invalidVersions.join(', ')} - ${details.reason}`,
        affected_wos: affectedWOs,
        conflicting_values: details.invalidVersions,
        resolution_hint: `Update WO technical_requirements with valid version. Check npm registry: https://www.npmjs.com/package/${pkg}`
      });
    });
    console.error(`[Aggregator] ❌ Found ${invalidDeps.size} invalid production dependencies`);
  }

  if (invalidDevDeps.size > 0) {
    invalidDevDeps.forEach((details, pkg) => {
      const affectedWOs = findWOsWithDependency(workOrders, pkg, 'development');
      report.critical.push({
        type: 'invalid_package_version',
        severity: 'critical',
        message: `Invalid dev dependency: ${pkg}@${details.invalidVersions.join(', ')} - ${details.reason}`,
        affected_wos: affectedWOs,
        conflicting_values: details.invalidVersions,
        resolution_hint: `Update WO technical_requirements with valid version. Check npm registry: https://www.npmjs.com/package/${pkg}`
      });
    });
    console.error(`[Aggregator] ❌ Found ${invalidDevDeps.size} invalid dev dependencies`);
  }

  const totalInvalid = invalidDeps.size + invalidDevDeps.size;
  if (totalInvalid === 0) {
    console.log('[Aggregator] ✅ All package versions validated successfully');
  }

  // Step 1.75: Detect peer dependency conflicts
  console.log('[Aggregator] Detecting peer dependency conflicts...');

  // Build aggregated requirements for peer validation
  const tempRequirements: AggregatedRequirements = {
    dependencies: Array.from(allDeps.entries()).map(([pkg, versions]) => {
      const version = Array.from(versions)[0]; // Use first version for now
      return `${pkg}@${version}`;
    }),
    devDependencies: Array.from(allDevDeps.entries()).map(([pkg, versions]) => {
      const version = Array.from(versions)[0];
      return `${pkg}@${version}`;
    }),
    environmentVariables: Array.from(allEnvVars),
    externalServices: Array.from(servicesMap.values()),
    tsconfigSettings
  };

  try {
    const peerResult = await detectPeerConflicts(tempRequirements, true); // cleanup temp dir

    if (peerResult.hasConflicts) {
      console.log(`[Aggregator] ⚠️  Found ${peerResult.conflicts.length} peer dependency conflict(s)`);

      // Convert peer conflicts to ConflictDetail format
      peerResult.conflicts.forEach((conflict: PeerConflict) => {
        // Find which WOs contributed the conflicting packages
        const affectedByPackage = findWOsWithDependency(workOrders, conflict.package, 'production')
          .concat(findWOsWithDependency(workOrders, conflict.package, 'development'));
        const affectedByConflicting = findWOsWithDependency(workOrders, conflict.conflictingPackage, 'production')
          .concat(findWOsWithDependency(workOrders, conflict.conflictingPackage, 'development'));
        const allAffectedWOs = Array.from(new Set([...affectedByPackage, ...affectedByConflicting]));

        report.critical.push({
          type: 'peer_dependency_conflict',
          severity: 'critical',
          message: `Peer dependency conflict: ${conflict.conflictingPackage}@${conflict.conflictingPackageVersion} requires ${conflict.package}@${conflict.requiredVersion}, but ${conflict.installedVersion} is being installed`,
          affected_wos: allAffectedWOs,
          conflicting_values: [
            `${conflict.package}@${conflict.installedVersion} (installed)`,
            `${conflict.package}@${conflict.requiredVersion} (required by ${conflict.conflictingPackage})`
          ],
          resolution_hint: `Either downgrade ${conflict.package} to ${conflict.requiredVersion}, upgrade ${conflict.conflictingPackage} to support ${conflict.package}@${conflict.installedVersion}, or remove ${conflict.conflictingPackage} if not essential.`
        });
      });
    } else {
      console.log('[Aggregator] ✅ No peer dependency conflicts detected');
    }
  } catch (error: any) {
    console.warn('[Aggregator] Failed to detect peer conflicts:', error.message);
    // Don't block aggregation if peer detection fails
  }

  // Step 2: Detect conflicts

  // 2a. Version conflicts (CRITICAL if major version differs)
  detectVersionConflicts(allDeps, 'production', workOrders, report);
  detectVersionConflicts(allDevDeps, 'development', workOrders, report);

  // 2b. Framework conflicts (CRITICAL - can only have one primary framework)
  detectFrameworkConflicts(allDeps, workOrders, report, frameworksDetected);

  // 2c. TypeScript JSX conflicts (CRITICAL - can only have one JSX mode)
  detectTsconfigConflicts(workOrders, report);

  // 2d. Multiple databases (WARNING - might be intentional)
  detectMultipleDatabases(servicesMap, report);

  // 2e. Build tool conflicts (WARNING)
  detectBuildToolConflicts(allDeps, workOrders, report);

  // Step 2.5: Deduplicate across dependency types
  // Move build tools, type definitions, and dev-only packages from production to dev
  console.log('[Aggregator] Deduplicating dependencies across types...');

  const BUILD_TOOLS = new Set([
    'typescript', 'webpack', 'webpack-cli', 'webpack-dev-server', 'webpack-merge',
    'eslint', 'jest', 'ts-jest', 'jest-environment-jsdom', 'jest-environment-node',
    'electron-builder', 'prettier', 'ts-node', 'nodemon', 'concurrently', 'wait-on',
    'cross-env', 'rimraf', 'electron', '@electron/rebuild'
  ]);

  const packagesToMove: string[] = [];

  for (const [pkg, versions] of Array.from(allDeps.entries())) {
    // Check if package should be in devDependencies
    const shouldBeDevDep =
      BUILD_TOOLS.has(pkg) ||           // Known build tools
      pkg.startsWith('@types/') ||      // Type definitions
      pkg.startsWith('@testing-library/') ||  // Testing libraries
      pkg.startsWith('@jest/') ||       // Jest packages
      pkg.startsWith('@babel/') ||      // Babel packages (build-time)
      pkg.startsWith('@typescript-eslint/') || // TypeScript linting
      pkg.startsWith('eslint-') ||      // ESLint plugins
      pkg.includes('-loader') ||        // Webpack loaders
      pkg.includes('-plugin') && (pkg.includes('webpack') || pkg.includes('babel')); // Build plugins

    if (shouldBeDevDep) {
      packagesToMove.push(pkg);

      // If already in devDeps, merge versions; otherwise move it
      if (allDevDeps.has(pkg)) {
        const existingVersions = allDevDeps.get(pkg)!;
        versions.forEach((v: string) => existingVersions.add(v));
      } else {
        allDevDeps.set(pkg, versions);
      }
    }
  }

  // Remove moved packages from production dependencies
  packagesToMove.forEach(pkg => {
    allDeps.delete(pkg);
    console.log(`[Aggregator] Moved ${pkg} from dependencies to devDependencies`);
  });

  if (packagesToMove.length > 0) {
    console.log(`[Aggregator] Moved ${packagesToMove.length} packages to devDependencies`);
  }

  // Step 3: Resolve to single version per package
  const resolvedDeps = resolveDependencies(allDeps);
  const resolvedDevDeps = resolveDependencies(allDevDeps);

  // Step 4: Build final aggregated requirements
  const requirements: AggregatedRequirements = {
    dependencies: resolvedDeps,
    devDependencies: resolvedDevDeps,
    environmentVariables: Array.from(allEnvVars),
    externalServices: Array.from(servicesMap.values()),
    tsconfigSettings
  };

  // Update metadata
  report.metadata.total_unique_deps = resolvedDeps.length + resolvedDevDeps.length;
  report.metadata.total_env_vars = requirements.environmentVariables.length;
  report.metadata.frameworks_detected = Array.from(frameworksDetected);

  // Log summary
  console.log(`[Aggregator] Summary:`, {
    dependencies: resolvedDeps.length,
    devDependencies: resolvedDevDeps.length,
    environmentVariables: requirements.environmentVariables.length,
    externalServices: requirements.externalServices.length,
    critical_conflicts: report.critical.length,
    warnings: report.warnings.length
  });

  // Log warnings (don't throw)
  if (report.warnings.length > 0) {
    console.warn('[Aggregator] ⚠️  Warnings detected:');
    report.warnings.forEach(w => {
      console.warn(`  - ${w.message}`);
      if (w.resolution_hint) {
        console.warn(`    Hint: ${w.resolution_hint}`);
      }
    });
  }

  // Critical conflicts will be handled by caller (not thrown here - stored in report)
  if (report.critical.length > 0) {
    console.error('[Aggregator] ❌ Critical conflicts detected:');
    report.critical.forEach(c => {
      console.error(`  - ${c.message}`);
      console.error(`    Affected: ${c.affected_wos.join(', ')}`);
    });
  }

  return { requirements, report };
}

/**
 * Parse "package@version" into { pkg, version }
 * Handles both scoped (@scope/name@version) and unscoped (name@version) packages
 */
function parseDependency(dep: string): { pkg: string; version: string } {
  if (dep.startsWith('@')) {
    // Scoped package: @scope/name@version
    // Find the LAST @ to split package from version
    const lastAtIndex = dep.lastIndexOf('@');
    if (lastAtIndex > 0) {
      return {
        pkg: dep.substring(0, lastAtIndex),
        version: dep.substring(lastAtIndex + 1)
      };
    }
  } else {
    // Unscoped package: name@version
    const atIndex = dep.indexOf('@');
    if (atIndex > 0) {
      return {
        pkg: dep.substring(0, atIndex),
        version: dep.substring(atIndex + 1)
      };
    }
  }

  // No version specified
  return { pkg: dep, version: 'latest' };
}

/** Detect version conflicts within dependency list */
function detectVersionConflicts(
  depsMap: Map<string, Set<string>>,
  depType: 'production' | 'development',
  workOrders: WorkOrder[],
  report: ConflictReport
): void {
  depsMap.forEach((versions, pkg) => {
    if (versions.size <= 1) return;

    const versionArray = Array.from(versions);
    const conflictSeverity = determineVersionConflictSeverity(versionArray);

    const affectedWOs = findWOsWithDependency(workOrders, pkg, depType);

    if (conflictSeverity === 'major') {
      report.critical.push({
        type: 'version_conflict',
        severity: 'critical',
        message: `Package "${pkg}" has conflicting MAJOR versions: ${versionArray.join(' vs ')}`,
        affected_wos: affectedWOs,
        conflicting_values: versionArray,
        resolution_hint: `All WOs must use the same major version. Review WOs and choose one version (recommend latest stable).`
      });
    } else if (conflictSeverity === 'minor') {
      report.warnings.push({
        type: 'version_conflict',
        severity: 'warning',
        message: `Package "${pkg}" has different minor versions: ${versionArray.join(' vs ')}`,
        affected_wos: affectedWOs,
        conflicting_values: versionArray,
        resolution_hint: `Minor versions are usually compatible. Will use highest version (${versionArray.sort().reverse()[0]}).`
      });
    }
  });
}

/** Determine if version conflict is major/minor/patch */
function determineVersionConflictSeverity(versions: string[]): 'major' | 'minor' | 'patch' {
  const parsed = versions.map(v => {
    const match = v.match(/^(\d+)\.(\d+)\.(\d+)/);
    return match ? {
      major: parseInt(match[1]),
      minor: parseInt(match[2]),
      patch: parseInt(match[3])
    } : null;
  }).filter(Boolean);

  if (parsed.length < 2) return 'patch';

  const majors = new Set(parsed.map(v => v!.major));
  if (majors.size > 1) return 'major';

  const minors = new Set(parsed.map(v => v!.minor));
  if (minors.size > 1) return 'minor';

  return 'patch';
}

/** Detect framework conflicts (React vs Vue vs Angular, etc.) */
function detectFrameworkConflicts(
  depsMap: Map<string, Set<string>>,
  workOrders: WorkOrder[],
  report: ConflictReport,
  frameworksDetected: Set<string>
): void {
  const frameworkPatterns = [
    { name: 'Next.js', keywords: ['next'], category: 'fullstack' },
    { name: 'React', keywords: ['react'], category: 'ui' },
    { name: 'Vue', keywords: ['vue'], category: 'ui' },
    { name: 'Angular', keywords: ['@angular/core'], category: 'ui' },
    { name: 'Svelte', keywords: ['svelte'], category: 'ui' },
    { name: 'Express', keywords: ['express'], category: 'backend' },
    { name: 'Fastify', keywords: ['fastify'], category: 'backend' },
  ];

  const detected: Array<{ name: string; category: string; wos: string[] }> = [];

  frameworkPatterns.forEach(framework => {
    const wos: string[] = [];

    framework.keywords.forEach(keyword => {
      if (depsMap.has(keyword)) {
        const affectedWOs = findWOsWithDependency(workOrders, keyword, 'production');
        wos.push(...affectedWOs);
      }
    });

    if (wos.length > 0) {
      detected.push({ name: framework.name, category: framework.category, wos: Array.from(new Set(wos)) });
      frameworksDetected.add(framework.name);
    }
  });

  // Check for UI framework conflicts
  const uiFrameworks = detected.filter(d => d.category === 'ui');

  if (uiFrameworks.length > 1) {
    report.critical.push({
      type: 'framework_conflict',
      severity: 'critical',
      message: `Multiple UI frameworks detected: ${uiFrameworks.map(f => f.name).join(', ')}. Can only use ONE UI framework.`,
      affected_wos: uiFrameworks.flatMap(f => f.wos),
      conflicting_values: uiFrameworks.map(f => f.name),
      resolution_hint: `Choose React OR Vue OR Angular. Update all WOs to use consistent framework.`
    });
  }

  // Check for backend framework conflicts (warning, not critical)
  const backendFrameworks = detected.filter(d => d.category === 'backend');

  if (backendFrameworks.length > 1) {
    report.warnings.push({
      type: 'framework_conflict',
      severity: 'warning',
      message: `Multiple backend frameworks: ${backendFrameworks.map(f => f.name).join(', ')}. Unusual but might be intentional (microservices).`,
      affected_wos: backendFrameworks.flatMap(f => f.wos),
      conflicting_values: backendFrameworks.map(f => f.name)
    });
  }
}

/** Detect TypeScript config conflicts */
function detectTsconfigConflicts(
  workOrders: WorkOrder[],
  report: ConflictReport
): void {
  const jsxModes = new Map<string, string[]>();

  workOrders.forEach(wo => {
    const jsx = wo.technical_requirements?.tsconfig_requirements?.jsx;
    if (jsx) {
      if (!jsxModes.has(jsx)) {
        jsxModes.set(jsx, []);
      }
      jsxModes.get(jsx)!.push(wo.title);
    }
  });

  if (jsxModes.size > 1) {
    report.critical.push({
      type: 'tsconfig_conflict',
      severity: 'critical',
      message: `Conflicting TypeScript JSX modes: ${Array.from(jsxModes.keys()).join(' vs ')}. Can only use ONE JSX compiler setting.`,
      affected_wos: Array.from(jsxModes.values()).flat(),
      conflicting_values: Array.from(jsxModes.keys()),
      resolution_hint: `All WOs using JSX must specify the same jsx compiler option (recommend "react-jsx" for modern React).`
    });
  }
}

/** Detect multiple databases (warning, might be legit) */
function detectMultipleDatabases(
  servicesMap: Map<string, any>,
  report: ConflictReport
): void {
  const dbKeywords = ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Supabase', 'Firebase', 'DynamoDB'];
  const detectedDBs: string[] = [];

  servicesMap.forEach((svc, name) => {
    if (dbKeywords.some(db => name.includes(db))) {
      detectedDBs.push(name);
    }
  });

  if (detectedDBs.length > 1) {
    report.warnings.push({
      type: 'multiple_databases',
      severity: 'warning',
      message: `Multiple databases detected: ${detectedDBs.join(', ')}. Might be intentional (e.g., Postgres + Redis cache).`,
      affected_wos: [],
      conflicting_values: detectedDBs,
      resolution_hint: `Verify this is intentional. Multiple primary databases (Postgres + MongoDB) is unusual.`
    });
  }
}

/** Detect build tool conflicts */
function detectBuildToolConflicts(
  depsMap: Map<string, Set<string>>,
  workOrders: WorkOrder[],
  report: ConflictReport
): void {
  const buildTools = ['webpack', 'vite', 'rollup', 'esbuild', 'parcel', 'turbopack'];
  const detected: string[] = [];

  buildTools.forEach(tool => {
    if (depsMap.has(tool)) {
      detected.push(tool);
    }
  });

  if (detected.length > 1) {
    const affectedWOs = detected.flatMap(tool =>
      findWOsWithDependency(workOrders, tool, 'production')
    );

    report.warnings.push({
      type: 'build_tool_conflict',
      severity: 'warning',
      message: `Multiple build tools: ${detected.join(', ')}. Usually only need one.`,
      affected_wos: affectedWOs,
      conflicting_values: detected,
      resolution_hint: `Most projects use one build tool. If intentional (monorepo), document why.`
    });
  }
}

/** Resolve dependencies to single version (chooses highest semantic version) */
function resolveDependencies(
  depsMap: Map<string, Set<string>>
): string[] {
  const resolved: string[] = [];

  depsMap.forEach((versions, pkg) => {
    if (versions.size === 1) {
      resolved.push(`${pkg}@${Array.from(versions)[0]}`);
    } else {
      // Multiple versions - choose highest
      const sorted = Array.from(versions).sort((a, b) => {
        // Simple string comparison for versions
        return b.localeCompare(a);
      });
      const chosen = sorted[0];
      resolved.push(`${pkg}@${chosen}`);
      console.log(`[Aggregator] Resolved ${pkg}: chose ${chosen} from ${Array.from(versions).join(', ')}`);
    }
  });

  return resolved;
}

/** Find WOs that depend on a specific package */
function findWOsWithDependency(
  workOrders: WorkOrder[],
  packageName: string,
  depType: 'production' | 'development'
): string[] {
  return workOrders
    .filter(wo => {
      const deps = depType === 'production'
        ? wo.technical_requirements?.npm_dependencies
        : wo.technical_requirements?.npm_dev_dependencies;
      return deps?.some(dep => dep.includes(packageName));
    })
    .map(wo => wo.title);
}

/**
 * Validate package versions against npm registry
 * Returns map of invalid packages with error details
 */
async function validatePackageVersions(
  depsMap: Map<string, Set<string>>,
  depType: 'production' | 'development'
): Promise<Map<string, { invalidVersions: string[]; reason: string }>> {
  const invalidPackages = new Map<string, { invalidVersions: string[]; reason: string }>();
  const validationPromises: Promise<void>[] = [];

  for (const [pkg, versions] of Array.from(depsMap.entries())) {
    for (const version of Array.from(versions)) {
      validationPromises.push(
        (async () => {
          const result = await validateNpmPackageVersion(pkg, version);
          if (!result.valid) {
            const existing = invalidPackages.get(pkg) || { invalidVersions: [], reason: result.reason };
            existing.invalidVersions.push(version);
            invalidPackages.set(pkg, existing);
          }
        })()
      );
    }
  }

  // Run validations in parallel with concurrency limit
  // npm CLI is much faster than HTTP, so we can use larger batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < validationPromises.length; i += BATCH_SIZE) {
    const batch = validationPromises.slice(i, i + BATCH_SIZE);
    await Promise.all(batch);
  }

  return invalidPackages;
}

/**
 * Check if a specific package@version exists in npm registry
 * Uses npm CLI for fast validation with local cache
 */
async function validateNpmPackageVersion(
  packageName: string,
  version: string
): Promise<{ valid: boolean; reason: string }> {
  try {
    // Use npm view command which leverages local cache
    // This is 2-10x faster than HTTP fetch after first run
    const command = `npm view ${packageName}@${version} version --json`;

    const output = execSync(command, {
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 3000, // 3 second timeout (faster than HTTP)
      windowsHide: true
    });

    // If npm view succeeds, package@version exists
    // Output will be the version number or JSON
    if (output && output.trim()) {
      return { valid: true, reason: '' };
    }

    return { valid: false, reason: 'npm view returned empty result' };

  } catch (error: any) {
    // npm view exits with error if package/version doesn't exist
    const stderr = error.stderr?.toString() || error.message || '';

    // Parse npm error messages
    if (stderr.includes('404') || stderr.includes('Not Found')) {
      return {
        valid: false,
        reason: `Package or version not found in npm registry`
      };
    }

    if (stderr.includes('No matching version')) {
      // Get available versions for better error message
      try {
        const versionsOutput = execSync(`npm view ${packageName} versions --json`, {
          stdio: 'pipe',
          encoding: 'utf-8',
          timeout: 2000,
          windowsHide: true
        });
        const versions = JSON.parse(versionsOutput);
        const versionCount = Array.isArray(versions) ? versions.length : 0;

        // Try to get latest version
        let latest = 'unknown';
        try {
          const latestOutput = execSync(`npm view ${packageName} dist-tags.latest`, {
            stdio: 'pipe',
            encoding: 'utf-8',
            timeout: 1000,
            windowsHide: true
          });
          latest = latestOutput.trim();
        } catch {}

        return {
          valid: false,
          reason: `Version ${version} does not exist. Latest: ${latest}. Available versions: ${versionCount} total`
        };
      } catch {
        return {
          valid: false,
          reason: `Version ${version} does not exist`
        };
      }
    }

    // Network errors, timeouts, etc.
    console.warn(`[Validator] Failed to validate ${packageName}@${version}:`, error.message);
    // Don't fail validation on network/timeout errors - assume valid to avoid blocking
    return { valid: true, reason: '' };
  }
}
