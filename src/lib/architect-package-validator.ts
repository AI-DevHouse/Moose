// Architect Package Validator - Post-decomposition validation with architect self-correction
// Validates WO technical_requirements and calls architect to fix blocking issues

import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseServiceClient } from '@/lib/supabase';
import type { TechnicalRequirements } from '@/types/architect';
import type { PeerConflict } from './architect-peer-validator';
import type { AggregatedRequirements } from './bootstrap/requirements-aggregator';

// ============================================================================
// Types
// ============================================================================

export interface WOValidationIssue {
  woId: string;
  woTitle: string;
  blockingIssues: string[];
  invalidPackages: Array<{
    packageName: string;
    version: string;
    reason: string;
    dependencyType: 'production' | 'development';
  }>;
}

export interface WorkOrderSetValidationResult {
  allValid: boolean;
  totalWOs: number;
  validWOs: number;
  correctedWOs: number;
  failedWOs: number;
  corrections: Array<{
    woId: string;
    woTitle: string;
    packageCorrections: number;
    correctedRequirements: TechnicalRequirements;
  }>;
  failures: Array<{
    woId: string;
    woTitle: string;
    reason: string;
  }>;
  executionTimeMs: number;
}

interface WorkOrder {
  id: string;
  title: string;
  description: string;
  technical_requirements: TechnicalRequirements | null;
  project_id: string | null;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Validate all WOs in a set, with architect self-correction for blocking issues
 *
 * @param wos - Array of newly created work orders
 * @param projectId - Project ID
 * @param provider - LLM provider (e.g., 'anthropic', 'openai')
 * @param model - Model identifier (e.g., 'claude-sonnet-4-5-20250929')
 * @param originalSpec - Original tech spec (for context in correction)
 * @returns Validation results with corrections applied
 */
export async function validateWorkOrderSetWithArchitectCorrection(
  wos: WorkOrder[],
  projectId: string,
  provider: string,
  model: string,
  originalSpec: string
): Promise<WorkOrderSetValidationResult> {
  const startTime = Date.now();

  console.log(`[ArchitectValidator] Validating ${wos.length} WOs post-decomposition`);

  const validWOs: string[] = [];
  const needsCorrection: WOValidationIssue[] = [];

  // Phase 1: Identify WOs with blocking issues
  for (const wo of wos) {
    if (!wo.technical_requirements) {
      validWOs.push(wo.id);
      continue;
    }

    const issues = await validateWorkOrderPackages(wo, projectId);

    if (issues.blockingIssues.length > 0) {
      needsCorrection.push(issues);
      console.log(`[ArchitectValidator] WO "${wo.title}" has ${issues.blockingIssues.length} blocking issues`);
    } else {
      validWOs.push(wo.id);
    }
  }

  const corrections: WorkOrderSetValidationResult['corrections'] = [];
  const failures: WorkOrderSetValidationResult['failures'] = [];

  // Phase 2: Call architect to fix WOs with issues
  if (needsCorrection.length > 0) {
    console.log(`[ArchitectValidator] Calling architect to correct ${needsCorrection.length} WOs...`);

    for (const issue of needsCorrection) {
      try {
        const wo = wos.find(w => w.id === issue.woId)!;

        const correctionResult = await callArchitectForCorrection(
          wo,
          issue,
          provider,
          model,
          originalSpec,
          projectId
        );

        if (correctionResult.success) {
          corrections.push({
            woId: wo.id,
            woTitle: wo.title,
            packageCorrections: issue.invalidPackages.length,
            correctedRequirements: correctionResult.correctedRequirements!
          });

          // Update WO in database with corrected requirements
          await updateWorkOrderWithCorrections(
            wo.id,
            correctionResult.correctedRequirements!,
            issue.invalidPackages
          );

          validWOs.push(wo.id);
        } else {
          failures.push({
            woId: wo.id,
            woTitle: wo.title,
            reason: correctionResult.error || 'Architect correction failed'
          });
        }

      } catch (error: any) {
        console.error(`[ArchitectValidator] Failed to correct WO ${issue.woId}:`, error);
        failures.push({
          woId: issue.woId,
          woTitle: issue.woTitle,
          reason: error.message
        });
      }
    }
  }

  const executionTimeMs = Date.now() - startTime;

  const result: WorkOrderSetValidationResult = {
    allValid: failures.length === 0,
    totalWOs: wos.length,
    validWOs: validWOs.length,
    correctedWOs: corrections.length,
    failedWOs: failures.length,
    corrections,
    failures,
    executionTimeMs
  };

  console.log(`[ArchitectValidator] ✅ Validation complete (${executionTimeMs}ms):`);
  console.log(`  - Valid: ${result.validWOs}`);
  console.log(`  - Corrected: ${result.correctedWOs}`);
  console.log(`  - Failed: ${result.failedWOs}`);

  return result;
}

// ============================================================================
// Package Validation
// ============================================================================

/**
 * Validate packages in a single WO's technical requirements
 * Returns blocking issues only (consistency issues handled pre-proposer)
 */
async function validateWorkOrderPackages(
  wo: WorkOrder,
  projectId: string
): Promise<WOValidationIssue> {
  const blockingIssues: string[] = [];
  const invalidPackages: WOValidationIssue['invalidPackages'] = [];

  const tr = wo.technical_requirements!;
  const prodDeps = tr.npm_dependencies || [];
  const devDeps = tr.npm_dev_dependencies || [];

  // Check production dependencies
  for (const dep of prodDeps) {
    const { pkg, version } = parseDependency(dep);
    const validation = await validateNpmPackageVersion(pkg, version);

    if (!validation.valid) {
      blockingIssues.push(`Production: ${pkg}@${version} - ${validation.reason}`);
      invalidPackages.push({
        packageName: pkg,
        version,
        reason: validation.reason,
        dependencyType: 'production'
      });
    }
  }

  // Check dev dependencies
  for (const dep of devDeps) {
    const { pkg, version } = parseDependency(dep);
    const validation = await validateNpmPackageVersion(pkg, version);

    if (!validation.valid) {
      blockingIssues.push(`Development: ${pkg}@${version} - ${validation.reason}`);
      invalidPackages.push({
        packageName: pkg,
        version,
        reason: validation.reason,
        dependencyType: 'development'
      });
    }
  }

  return {
    woId: wo.id,
    woTitle: wo.title,
    blockingIssues,
    invalidPackages
  };
}

/**
 * Validate package version against npm registry
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
        return { valid: false, reason: `Package "${packageName}" does not exist on npm` };
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
        reason: `Version ${version} does not exist (latest: ${latestVersion})`
      };
    }

    return { valid: true, reason: '' };

  } catch (error: any) {
    console.warn(`[ArchitectValidator] Failed to validate ${packageName}@${version}:`, error.message);
    // On network errors, assume valid to avoid blocking entire decomposition
    return { valid: true, reason: '' };
  }
}

/**
 * Parse dependency string into package name and version
 */
function parseDependency(dep: string): { pkg: string; version: string } {
  const parts = dep.split('@');

  if (dep.startsWith('@')) {
    // Scoped package: @scope/name@version
    return {
      pkg: `@${parts[1]}/${parts[2]}`,
      version: parts[3] || 'latest'
    };
  }

  // Regular package: name@version
  return {
    pkg: parts[0],
    version: parts[1] || 'latest'
  };
}

// ============================================================================
// Architect Correction
// ============================================================================

interface ArchitectCorrectionResult {
  success: boolean;
  correctedRequirements?: TechnicalRequirements;
  error?: string;
}

/**
 * Call architect to correct invalid packages in a work order
 * Uses the same model that generated the WO originally
 */
async function callArchitectForCorrection(
  wo: WorkOrder,
  issue: WOValidationIssue,
  provider: string,
  model: string,
  originalSpec: string,
  projectId: string
): Promise<ArchitectCorrectionResult> {

  console.log(`[ArchitectValidator] Requesting correction for WO "${wo.title}" using ${provider}/${model}`);

  // Build correction prompt
  const invalidPackagesList = issue.invalidPackages
    .map(p => `- ${p.packageName}@${p.version} (${p.dependencyType}): ${p.reason}`)
    .join('\n');

  const correctionPrompt = `You previously decomposed a technical specification and created a work order with invalid npm packages.

WORK ORDER: "${wo.title}"
DESCRIPTION: ${wo.description}

INVALID PACKAGES DETECTED:
${invalidPackagesList}

CURRENT TECHNICAL REQUIREMENTS:
${JSON.stringify(wo.technical_requirements, null, 2)}

TASK: Revise the technical_requirements to fix these issues:
1. Remove packages that don't exist on npm
2. Replace with correct alternatives that achieve the same goal
3. If the intent was configuration (e.g., jest coverage thresholds), update file_updates to use config files instead of invalid packages
4. Ensure all package versions are valid

Return ONLY a valid JSON object with this structure:
{
  "correctedRequirements": {
    "npm_dependencies": [...],
    "npm_dev_dependencies": [...],
    "file_updates": {...},
    "external_services": [...],
    "environment_variables": [...],
    "tsconfig_requirements": {...}
  },
  "correctionReasoning": "Brief explanation of changes made"
}`;

  try {
    let content: string;

    if (provider === 'anthropic') {
      // Use Anthropic SDK
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY!
      });

      const response = await anthropic.messages.create({
        model: model,
        max_tokens: 4000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: correctionPrompt
          }
        ]
      });

      content = response.content[0].type === 'text' ? response.content[0].text : '';

    } else if (provider === 'openai') {
      // Use OpenAI API (future support)
      throw new Error('OpenAI provider not yet implemented for architect correction');
    } else {
      return {
        success: false,
        error: `Unsupported provider: ${provider}`
      };
    }

    if (!content) {
      return {
        success: false,
        error: 'Architect returned empty response'
      };
    }

    // Parse the JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        error: 'Could not parse architect correction response'
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.correctedRequirements) {
      return {
        success: false,
        error: 'Architect response missing correctedRequirements'
      };
    }

    console.log(`[ArchitectValidator] ✅ Architect corrected WO "${wo.title}"`);
    if (parsed.correctionReasoning) {
      console.log(`   Reasoning: ${parsed.correctionReasoning}`);
    }

    return {
      success: true,
      correctedRequirements: parsed.correctedRequirements
    };

  } catch (error: any) {
    console.error('[ArchitectValidator] Architect correction failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// Database Updates
// ============================================================================

/**
 * Update work order with corrected technical requirements
 */
async function updateWorkOrderWithCorrections(
  woId: string,
  correctedRequirements: TechnicalRequirements,
  invalidPackages: WOValidationIssue['invalidPackages']
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  try {
    // Get existing metadata
    const { data: woData, error: fetchError } = await supabase
      .from('work_orders')
      .select('metadata')
      .eq('id', woId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch WO metadata: ${fetchError.message}`);
    }

    const existingMetadata = (woData?.metadata && typeof woData.metadata === 'object' && !Array.isArray(woData.metadata))
      ? woData.metadata as Record<string, any>
      : {};

    // Update WO with corrected requirements
    const { error: updateError } = await supabase
      .from('work_orders')
      .update({
        technical_requirements: correctedRequirements as any,
        metadata: {
          ...existingMetadata,
          architect_correction: {
            corrected_at: new Date().toISOString(),
            invalid_packages: invalidPackages.map(p => ({
              package: p.packageName,
              version: p.version,
              reason: p.reason
            })),
            correction_phase: 'post_decomposition'
          }
        } as any
      })
      .eq('id', woId);

    if (updateError) {
      throw new Error(`Failed to update WO: ${updateError.message}`);
    }

    console.log(`[ArchitectValidator] Updated WO ${woId} with corrected requirements`);

  } catch (error: any) {
    console.error('[ArchitectValidator] Failed to update WO with corrections:', error);
    throw error;
  }
}

// ============================================================================
// Peer Dependency Conflict Resolution
// ============================================================================

export interface PeerConflictResolutionResult {
  success: boolean;
  correctedRequirements?: AggregatedRequirements;
  resolutionStrategy?: string;
  error?: string;
}

/**
 * Call architect to resolve peer dependency conflicts in aggregated requirements
 *
 * @param conflicts - Array of detected peer conflicts
 * @param currentRequirements - Current aggregated requirements with conflicts
 * @param provider - LLM provider (e.g., 'anthropic', 'openai')
 * @param model - Model identifier
 * @returns Resolution result with corrected requirements
 */
export async function callArchitectForPeerConflictResolution(
  conflicts: PeerConflict[],
  currentRequirements: AggregatedRequirements,
  provider: string,
  model: string
): Promise<PeerConflictResolutionResult> {

  console.log(`[ArchitectValidator] Requesting peer conflict resolution using ${provider}/${model}`);
  console.log(`[ArchitectValidator] Resolving ${conflicts.length} peer conflict(s)`);

  // Build conflict list for prompt
  const conflictsList = conflicts
    .map((c, idx) => {
      return `${idx + 1}. ${c.conflictingPackage}@${c.conflictingPackageVersion} requires ${c.package}@${c.requiredVersion}, but ${c.installedVersion} is being installed`;
    })
    .join('\n');

  const resolutionPrompt = `You are resolving peer dependency conflicts in an aggregated package.json.

PEER DEPENDENCY CONFLICTS DETECTED:
${conflictsList}

CURRENT AGGREGATED REQUIREMENTS:
Production dependencies (${currentRequirements.dependencies.length}):
${currentRequirements.dependencies.slice(0, 20).join(', ')}${currentRequirements.dependencies.length > 20 ? ` ... (${currentRequirements.dependencies.length - 20} more)` : ''}

Development dependencies (${currentRequirements.devDependencies.length}):
${currentRequirements.devDependencies.slice(0, 20).join(', ')}${currentRequirements.devDependencies.length > 20 ? ` ... (${currentRequirements.devDependencies.length - 20} more)` : ''}

TASK: Resolve these peer dependency conflicts using ONE of these strategies:
1. **Downgrade conflicting package**: If the package causing the issue (e.g., jest@29) can be safely downgraded to satisfy the peer dep (e.g., jest@24), do so.
2. **Upgrade package with peer requirement**: If the dependent package (e.g., jest-electron) has a newer version that supports the installed version, upgrade it.
3. **Remove non-essential package**: If the dependent package (e.g., jest-electron) is not essential for core functionality, remove it.
4. **Find alternative package**: Replace the dependent package with an alternative that doesn't have conflicting peer deps.

IMPORTANT:
- Preserve all other packages that are not involved in the conflict
- Do not remove essential packages (react, typescript, core frameworks)
- Prefer strategy #2 (upgrade) or #3 (remove) over #1 (downgrade) when possible
- Ensure all package versions remain valid in npm registry

Return ONLY a valid JSON object with this structure:
{
  "correctedDependencies": ["package@version", ...],
  "correctedDevDependencies": ["package@version", ...],
  "resolutionStrategy": "Brief explanation of what you changed and why (1-2 sentences)",
  "removedPackages": ["package1", "package2"]
}`;

  try {
    let content: string;

    if (provider === 'anthropic') {
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY!
      });

      const response = await anthropic.messages.create({
        model: model,
        max_tokens: 8000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: resolutionPrompt
          }
        ]
      });

      content = response.content[0].type === 'text' ? response.content[0].text : '';

    } else if (provider === 'openai') {
      throw new Error('OpenAI provider not yet implemented for peer conflict resolution');
    } else {
      return {
        success: false,
        error: `Unsupported provider: ${provider}`
      };
    }

    if (!content) {
      return {
        success: false,
        error: 'Architect returned empty response'
      };
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        error: 'Could not parse architect resolution response'
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.correctedDependencies || !parsed.correctedDevDependencies) {
      return {
        success: false,
        error: 'Architect response missing correctedDependencies or correctedDevDependencies'
      };
    }

    console.log(`[ArchitectValidator] ✅ Architect resolved peer conflicts`);
    console.log(`   Strategy: ${parsed.resolutionStrategy}`);
    if (parsed.removedPackages && parsed.removedPackages.length > 0) {
      console.log(`   Removed packages: ${parsed.removedPackages.join(', ')}`);
    }

    const correctedRequirements: AggregatedRequirements = {
      dependencies: parsed.correctedDependencies,
      devDependencies: parsed.correctedDevDependencies,
      environmentVariables: currentRequirements.environmentVariables,
      externalServices: currentRequirements.externalServices,
      tsconfigSettings: currentRequirements.tsconfigSettings
    };

    return {
      success: true,
      correctedRequirements,
      resolutionStrategy: parsed.resolutionStrategy
    };

  } catch (error: any) {
    console.error('[ArchitectValidator] Peer conflict resolution failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
