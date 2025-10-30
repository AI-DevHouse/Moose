// Package Validator - Pre-proposer validation for package consistency and validity
// Ensures all WOs use consistent package versions and valid npm packages

import { createSupabaseServiceClient } from '@/lib/supabase';
import type { WorkOrder } from './types';
import type { TechnicalRequirements } from '@/types/architect';

// ============================================================================
// Types
// ============================================================================

export interface PackageValidationResult {
  success: boolean;
  correctionsMade: number;
  corrections: PackageCorrection[];
  blockingIssues: string[];
  validationReport: ValidationReport;
  correctedRequirements?: TechnicalRequirements;
}

export interface PackageCorrection {
  packageName: string;
  oldVersion: string;
  newVersion: string;
  reason: 'consistency_completed' | 'consistency_approved' | 'invalid_npm' | 'critical_block';
  sourceWoId?: string;  // Which WO provided the standard version
  sourceWoTitle?: string;
  confidence: 'high' | 'medium' | 'low';
  dependencyType: 'production' | 'development';
}

export interface ValidationReport {
  totalPackagesChecked: number;
  validPackages: number;
  correctedPackages: number;
  blockedPackages: number;
  executionTimeMs: number;
}

export interface ProjectPackageRegistry {
  completed: Map<string, PackageInfo>;     // packageName → info (highest priority)
  approved: Map<string, PackageInfo>;      // packageName → info (medium priority)
  inProgress: Map<string, PackageInfo>;    // packageName → info (low priority)
}

export interface PackageInfo {
  version: string;
  woIds: string[];          // All WOs using this package
  woTitles: string[];       // Titles for logging
  latestWoId: string;       // Most recent WO using this version
  latestWoTitle: string;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Validate and auto-correct a Work Order's package versions
 *
 * Dual-goal validation:
 * 1. Consistency: Ensure packages match versions from completed/approved WOs
 * 2. Validity: Ensure packages exist in npm registry
 *
 * Resolution hierarchy:
 * 1. HIGH confidence: Use version from completed WOs
 * 2. MEDIUM confidence: Use version from approved WOs
 * 3. LOW confidence: Validate against npm, use latest if invalid
 * 4. BLOCK: Cannot resolve
 */
export async function validateAndCorrectWorkOrder(
  wo: WorkOrder,
  projectId: string
): Promise<PackageValidationResult> {
  const startTime = Date.now();

  console.log(`[PackageValidator] Validating WO ${wo.id}: "${wo.title}"`);

  // Handle WOs without technical requirements
  if (!wo.technical_requirements) {
    console.log(`[PackageValidator] No technical requirements, skipping validation`);
    return {
      success: true,
      correctionsMade: 0,
      corrections: [],
      blockingIssues: [],
      validationReport: {
        totalPackagesChecked: 0,
        validPackages: 0,
        correctedPackages: 0,
        blockedPackages: 0,
        executionTimeMs: Date.now() - startTime
      }
    };
  }

  // Step 1: Build project package registry
  console.log(`[PackageValidator] Building project package registry...`);
  const registry = await buildProjectPackageRegistry(projectId, wo.id);

  console.log(`[PackageValidator] Registry: ${registry.completed.size} completed, ${registry.approved.size} approved, ${registry.inProgress.size} in-progress`);

  // Step 2: Validate and correct packages
  const corrections: PackageCorrection[] = [];
  const blockingIssues: string[] = [];

  const prodDeps = wo.technical_requirements.npm_dependencies || [];
  const devDeps = wo.technical_requirements.npm_dev_dependencies || [];

  // Validate production dependencies
  for (const dep of prodDeps) {
    const correction = await validatePackage(dep, 'production', registry, wo.id);
    if (correction) {
      if (correction.reason === 'critical_block') {
        blockingIssues.push(`Production: ${correction.packageName}@${correction.oldVersion} - cannot resolve`);
      } else {
        corrections.push(correction);
      }
    }
  }

  // Validate dev dependencies
  for (const dep of devDeps) {
    const correction = await validatePackage(dep, 'development', registry, wo.id);
    if (correction) {
      if (correction.reason === 'critical_block') {
        blockingIssues.push(`Development: ${correction.packageName}@${correction.oldVersion} - cannot resolve`);
      } else {
        corrections.push(correction);
      }
    }
  }

  // Step 3: Apply corrections if needed
  let correctedRequirements: TechnicalRequirements | undefined;

  if (corrections.length > 0) {
    console.log(`[PackageValidator] Applying ${corrections.length} corrections...`);
    correctedRequirements = applyCorrections(wo.technical_requirements, corrections);
  }

  const executionTimeMs = Date.now() - startTime;

  const result: PackageValidationResult = {
    success: blockingIssues.length === 0,
    correctionsMade: corrections.length,
    corrections,
    blockingIssues,
    validationReport: {
      totalPackagesChecked: prodDeps.length + devDeps.length,
      validPackages: prodDeps.length + devDeps.length - corrections.length,
      correctedPackages: corrections.length,
      blockedPackages: blockingIssues.length,
      executionTimeMs
    },
    correctedRequirements
  };

  // Log summary
  if (corrections.length > 0) {
    console.log(`[PackageValidator] ✅ Corrected ${corrections.length} packages (${executionTimeMs}ms):`);
    corrections.forEach(c => {
      console.log(`  - ${c.packageName}: ${c.oldVersion} → ${c.newVersion} (${c.reason}, confidence: ${c.confidence})`);
    });
  } else {
    console.log(`[PackageValidator] ✅ All packages valid (${executionTimeMs}ms)`);
  }

  if (blockingIssues.length > 0) {
    console.error(`[PackageValidator] ❌ ${blockingIssues.length} blocking issues:`);
    blockingIssues.forEach(issue => console.error(`  - ${issue}`));
  }

  return result;
}

// ============================================================================
// Registry Building
// ============================================================================

/**
 * Build project-wide package registry from all WOs
 * Maps package names to version info, organized by WO status
 */
async function buildProjectPackageRegistry(
  projectId: string,
  currentWoId: string
): Promise<ProjectPackageRegistry> {
  const supabase = createSupabaseServiceClient();

  // Fetch all WOs for this project (excluding current WO)
  const { data, error } = await supabase
    .from('work_orders')
    .select('id, title, status, technical_requirements, created_at')
    .eq('project_id', projectId)
    .neq('id', currentWoId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[PackageValidator] Failed to fetch project WOs:', error);
    throw new Error(`Failed to build package registry: ${error.message}`);
  }

  const workOrders = (data || []) as Array<{
    id: string;
    title: string;
    status: string;
    technical_requirements: TechnicalRequirements | null;
    created_at: string;
  }>;

  const completed = new Map<string, PackageInfo>();
  const approved = new Map<string, PackageInfo>();
  const inProgress = new Map<string, PackageInfo>();

  // Process WOs by status
  for (const wo of workOrders) {
    if (!wo.technical_requirements) continue;

    const targetMap =
      wo.status === 'completed' ? completed :
      wo.status === 'approved' ? approved :
      wo.status === 'in_progress' ? inProgress :
      null;

    if (!targetMap) continue;

    // Extract packages
    const allDeps = [
      ...(wo.technical_requirements.npm_dependencies || []),
      ...(wo.technical_requirements.npm_dev_dependencies || [])
    ];

    for (const dep of allDeps) {
      const { pkg, version } = parseDependency(dep);

      const existing = targetMap.get(pkg);
      if (existing) {
        // Package exists - add this WO to the list
        existing.woIds.push(wo.id);
        existing.woTitles.push(wo.title);
      } else {
        // New package for this status
        targetMap.set(pkg, {
          version,
          woIds: [wo.id],
          woTitles: [wo.title],
          latestWoId: wo.id,
          latestWoTitle: wo.title
        });
      }
    }
  }

  // Resolve version conflicts within each registry
  resolveRegistryConflicts(completed);
  resolveRegistryConflicts(approved);
  resolveRegistryConflicts(inProgress);

  return { completed, approved, inProgress };
}

/**
 * Resolve version conflicts within a registry
 * If multiple WOs use different versions, choose highest semantic version
 */
function resolveRegistryConflicts(registry: Map<string, PackageInfo>): void {
  for (const [pkg, info] of Array.from(registry.entries())) {
    if (info.woIds.length <= 1) continue;

    // Check if all WOs actually use the same version
    // (they should, but handle edge case where they don't)
    // For now, we trust that completed WOs are consistent
    // Future enhancement: scan all and pick highest
  }
}

// ============================================================================
// Package Validation
// ============================================================================

/**
 * Validate a single package dependency
 * Returns correction object if package needs fixing, null if valid
 */
async function validatePackage(
  dependency: string,
  depType: 'production' | 'development',
  registry: ProjectPackageRegistry,
  currentWoId: string
): Promise<PackageCorrection | null> {
  const { pkg, version } = parseDependency(dependency);

  // Check hierarchy: completed → approved → npm validation

  // Priority 1: Completed WOs (HIGH confidence)
  if (registry.completed.has(pkg)) {
    const standardInfo = registry.completed.get(pkg)!;
    if (version !== standardInfo.version) {
      return {
        packageName: pkg,
        oldVersion: version,
        newVersion: standardInfo.version,
        reason: 'consistency_completed',
        sourceWoId: standardInfo.latestWoId,
        sourceWoTitle: standardInfo.latestWoTitle,
        confidence: 'high',
        dependencyType: depType
      };
    }
    // Version matches, no correction needed
    return null;
  }

  // Priority 2: Approved WOs (MEDIUM confidence)
  if (registry.approved.has(pkg)) {
    const standardInfo = registry.approved.get(pkg)!;
    if (version !== standardInfo.version) {
      return {
        packageName: pkg,
        oldVersion: version,
        newVersion: standardInfo.version,
        reason: 'consistency_approved',
        sourceWoId: standardInfo.latestWoId,
        sourceWoTitle: standardInfo.latestWoTitle,
        confidence: 'medium',
        dependencyType: depType
      };
    }
    return null;
  }

  // Priority 3: New package - validate against npm registry (LOW confidence)
  const npmValid = await validateNpmPackageVersion(pkg, version);

  if (!npmValid.valid) {
    // Package invalid - try to get latest valid version
    const latestVersion = await fetchLatestNpmVersion(pkg);

    if (latestVersion) {
      return {
        packageName: pkg,
        oldVersion: version,
        newVersion: latestVersion,
        reason: 'invalid_npm',
        confidence: 'low',
        dependencyType: depType
      };
    } else {
      // Cannot resolve - BLOCK
      return {
        packageName: pkg,
        oldVersion: version,
        newVersion: '',
        reason: 'critical_block',
        confidence: 'low',
        dependencyType: depType
      };
    }
  }

  // Package is new and valid - allow it
  return null;
}

/**
 * Validate package version against npm registry
 * Reuses logic from requirements-aggregator.ts
 */
async function validateNpmPackageVersion(
  packageName: string,
  version: string
): Promise<{ valid: boolean; reason: string }> {
  try {
    const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const response = await fetch(registryUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { valid: false, reason: `Package "${packageName}" does not exist` };
      }
      return { valid: false, reason: `Registry error (HTTP ${response.status})` };
    }

    const data = await response.json();

    if (!data.versions) {
      return { valid: false, reason: 'Package metadata malformed' };
    }

    if (version === 'latest') {
      return { valid: true, reason: '' };
    }

    if (!data.versions[version]) {
      const latestVersion = data['dist-tags']?.latest || 'unknown';
      return {
        valid: false,
        reason: `Version ${version} does not exist. Latest: ${latestVersion}`
      };
    }

    return { valid: true, reason: '' };

  } catch (error: any) {
    console.warn(`[PackageValidator] Failed to validate ${packageName}@${version}:`, error.message);
    // Assume valid on network errors to avoid blocking
    return { valid: true, reason: '' };
  }
}

/**
 * Fetch latest valid version from npm registry
 */
async function fetchLatestNpmVersion(packageName: string): Promise<string | null> {
  try {
    const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const response = await fetch(registryUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data['dist-tags']?.latest || null;

  } catch (error: any) {
    console.warn(`[PackageValidator] Failed to fetch latest for ${packageName}:`, error.message);
    return null;
  }
}

// ============================================================================
// Correction Application
// ============================================================================

/**
 * Apply corrections to technical requirements
 * Returns new TechnicalRequirements object with corrected package versions
 */
function applyCorrections(
  requirements: TechnicalRequirements,
  corrections: PackageCorrection[]
): TechnicalRequirements {
  const corrected: TechnicalRequirements = {
    ...requirements,
    npm_dependencies: [...(requirements.npm_dependencies || [])],
    npm_dev_dependencies: [...(requirements.npm_dev_dependencies || [])]
  };

  for (const correction of corrections) {
    const targetArray = correction.dependencyType === 'production'
      ? corrected.npm_dependencies!
      : corrected.npm_dev_dependencies!;

    const oldDep = `${correction.packageName}@${correction.oldVersion}`;
    const newDep = `${correction.packageName}@${correction.newVersion}`;

    const index = targetArray.findIndex(dep => dep === oldDep);
    if (index !== -1) {
      targetArray[index] = newDep;
    }
  }

  return corrected;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Parse "package@version" into components
 */
function parseDependency(dep: string): { pkg: string; version: string } {
  const match = dep.match(/^(@?[^@]+)@(.+)$/);
  if (!match) {
    return { pkg: dep, version: 'latest' };
  }
  return { pkg: match[1], version: match[2] };
}
