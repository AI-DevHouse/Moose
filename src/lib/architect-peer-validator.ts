// Architect Peer Dependency Validator
// Detects peer dependency conflicts in aggregated requirements BEFORE bootstrap
// Uses npm's own validation to catch issues that individual package checks miss

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import type { AggregatedRequirements } from './bootstrap/requirements-aggregator';

// ============================================================================
// Types
// ============================================================================

export interface PeerConflict {
  package: string;                  // Package that has unsatisfied peer dep (e.g., "jest")
  requiredVersion: string;          // Version range required by peer dep (e.g., "^24.0.0")
  installedVersion: string;         // Version we're trying to install (e.g., "29.7.0")
  conflictingPackage: string;       // Package declaring the peer dep (e.g., "jest-electron")
  conflictingPackageVersion: string; // Version of conflicting package (e.g., "0.1.12")
}

export interface PeerConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: PeerConflict[];
  npmOutput: string;                // Full npm error output for debugging
  tempDir?: string;                 // Temp dir path (for manual inspection if needed)
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect peer dependency conflicts using npm's validation
 *
 * Creates a temporary package.json with all aggregated dependencies,
 * runs npm install --dry-run, and parses output for peer conflicts.
 *
 * @param requirements - Aggregated requirements from all WOs
 * @param cleanupTempDir - Whether to delete temp dir after check (default: true)
 * @returns Structured conflict information
 */
export async function detectPeerConflicts(
  requirements: AggregatedRequirements,
  cleanupTempDir: boolean = true
): Promise<PeerConflictDetectionResult> {

  console.log('[PeerValidator] Starting peer dependency conflict detection...');

  // 1. Create temporary directory
  const tempDir = path.join(os.tmpdir(), `moose-peer-check-${Date.now()}`);

  try {
    fs.mkdirSync(tempDir, { recursive: true });

    // 2. Create package.json from aggregated requirements
    const packageJson = createTempPackageJson(requirements);
    const packageJsonPath = path.join(tempDir, 'package.json');

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');

    console.log(`[PeerValidator] Created temp package.json in ${tempDir}`);
    console.log(`[PeerValidator] Testing ${requirements.dependencies.length} prod + ${requirements.devDependencies.length} dev dependencies`);

    // 3. Run npm install --dry-run to detect conflicts
    let npmOutput = '';
    let hasConflicts = false;

    try {
      execSync('npm install --dry-run', {
        cwd: tempDir,
        stdio: 'pipe',
        encoding: 'utf-8',
        timeout: 60000 // 1 minute timeout
      });

      console.log('[PeerValidator] ✅ No peer dependency conflicts detected');

    } catch (error: any) {
      // npm install failed - likely due to conflicts
      npmOutput = error.stderr || error.stdout || '';
      hasConflicts = true;

      console.log('[PeerValidator] ⚠️  npm install --dry-run failed, checking for peer conflicts...');
    }

    // 4. Parse npm error output for peer dependency conflicts
    const conflicts = hasConflicts ? parseNpmPeerConflicts(npmOutput, packageJson) : [];

    if (conflicts.length > 0) {
      console.log(`[PeerValidator] Found ${conflicts.length} peer dependency conflict(s):`);
      conflicts.forEach(c => {
        console.log(`  - ${c.package}: ${c.conflictingPackage}@${c.conflictingPackageVersion} requires "${c.requiredVersion}", but found ${c.installedVersion}`);
      });
    }

    // 5. Cleanup temp directory (unless debugging)
    if (cleanupTempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('[PeerValidator] Cleaned up temp directory');
    } else {
      console.log(`[PeerValidator] Temp directory preserved for inspection: ${tempDir}`);
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      npmOutput,
      tempDir: cleanupTempDir ? undefined : tempDir
    };

  } catch (error: any) {
    // Unexpected error (not npm conflict)
    console.error('[PeerValidator] Unexpected error during conflict detection:', error.message);

    // Cleanup on error
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    return {
      hasConflicts: false,
      conflicts: [],
      npmOutput: error.message
    };
  }
}

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse npm error output to extract peer dependency conflicts
 *
 * Example npm output:
 * ```
 * npm error Found: jest@29.7.0
 * npm error node_modules/jest
 * npm error   dev jest@"29.7.0" from the root project
 * npm error
 * npm error Could not resolve dependency:
 * npm error peer jest@"^24.0.0" from jest-electron@0.1.12
 * npm error node_modules/jest-electron
 * npm error   dev jest-electron@"0.1.12" from the root project
 * ```
 */
function parseNpmPeerConflicts(
  npmOutput: string,
  packageJson: any
): PeerConflict[] {
  const conflicts: PeerConflict[] = [];

  // Split output into lines for processing
  const lines = npmOutput.split('\n').map(line => line.trim());

  let currentFoundPackage: string | null = null;
  let currentFoundVersion: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pattern 1: "Found: jest@29.7.0"
    const foundMatch = line.match(/Found:\s+([^@]+)@(.+)/);
    if (foundMatch) {
      currentFoundPackage = foundMatch[1];
      currentFoundVersion = foundMatch[2];
      continue;
    }

    // Pattern 2: "peer jest@"^24.0.0" from jest-electron@0.1.12"
    const peerMatch = line.match(/peer\s+([^@]+)@"([^"]+)"\s+from\s+([^@]+)@(.+)/);
    if (peerMatch && currentFoundPackage && currentFoundVersion) {
      const peerPackage = peerMatch[1];
      const peerRequiredVersion = peerMatch[2];
      const conflictingPackage = peerMatch[3];
      const conflictingPackageVersion = peerMatch[4];

      // Only add if the peer package matches the found package
      if (peerPackage === currentFoundPackage) {
        conflicts.push({
          package: peerPackage,
          requiredVersion: peerRequiredVersion,
          installedVersion: currentFoundVersion,
          conflictingPackage,
          conflictingPackageVersion
        });
      }

      // Reset state after capturing conflict
      currentFoundPackage = null;
      currentFoundVersion = null;
    }
  }

  return conflicts;
}

/**
 * Create temporary package.json from aggregated requirements
 */
function createTempPackageJson(requirements: AggregatedRequirements): any {
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};

  // Parse production dependencies
  for (const dep of requirements.dependencies) {
    const { pkg, version } = parseDependency(dep);
    dependencies[pkg] = version;
  }

  // Parse dev dependencies
  for (const dep of requirements.devDependencies) {
    const { pkg, version } = parseDependency(dep);
    devDependencies[pkg] = version;
  }

  return {
    name: 'moose-peer-validation-temp',
    version: '0.0.0',
    private: true,
    description: 'Temporary package.json for peer dependency validation',
    dependencies,
    devDependencies
  };
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

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format conflicts as human-readable summary
 */
export function formatConflictSummary(result: PeerConflictDetectionResult): string {
  if (!result.hasConflicts) {
    return '✅ No peer dependency conflicts detected';
  }

  const lines: string[] = [
    `⚠️  Found ${result.conflicts.length} peer dependency conflict(s):`,
    ''
  ];

  for (const conflict of result.conflicts) {
    lines.push(`• ${conflict.package}:`);
    lines.push(`  - Installed: ${conflict.installedVersion}`);
    lines.push(`  - Required: ${conflict.requiredVersion} (by ${conflict.conflictingPackage}@${conflict.conflictingPackageVersion})`);
    lines.push('');
  }

  return lines.join('\n');
}
