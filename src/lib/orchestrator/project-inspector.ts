import * as fs from 'fs';
import * as path from 'path';

/**
 * Describes the maturity level of a project based on infrastructure presence
 */
export interface ProjectMaturity {
  is_greenfield: boolean;
  has_src_directory: boolean;
  has_package_json: boolean;
  package_json_dependency_count: number;
  has_tsconfig: boolean;
  existing_ts_file_count: number;
  greenfield_confidence: number; // 0.0-1.0
}

/**
 * Recursively counts TypeScript files (.ts, .tsx) in a directory
 */
function countTypescriptFiles(dirPath: string): number {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  let count = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, .git, dist, build directories
      if (!['node_modules', '.git', 'dist', 'build', '.next', 'out'].includes(entry.name)) {
        count += countTypescriptFiles(fullPath);
      }
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        count++;
      }
    }
  }

  return count;
}

/**
 * Calculates confidence score for greenfield assessment
 * Higher score = more confident in the assessment
 */
function calculateConfidence(
  hasSrc: boolean,
  depCount: number,
  tsFileCount: number
): number {
  // Clear cases get high confidence
  if (!hasSrc && depCount === 0 && tsFileCount === 0) {
    return 1.0; // Empty directory - definitely greenfield
  }

  if (hasSrc && depCount > 20 && tsFileCount > 30) {
    return 0.95; // Clearly established project
  }

  // Calculate confidence based on multiple factors
  let confidence = 0.7; // Base confidence

  // Strong indicators of greenfield
  if (!hasSrc) {
    confidence += 0.15;
  }

  if (depCount < 3) {
    confidence += 0.1;
  }

  if (tsFileCount < 5) {
    confidence += 0.05;
  }

  // Strong indicators of established project
  if (depCount > 15) {
    confidence += 0.15;
  }

  if (tsFileCount > 20) {
    confidence += 0.1;
  }

  return Math.min(confidence, 1.0);
}

/**
 * Assesses whether a project is greenfield or established
 *
 * Greenfield heuristic:
 * - No src/ directory, OR
 * - Less than 3 dependencies, OR
 * - Less than 5 TypeScript files
 *
 * @param projectPath - Absolute path to the project root
 * @returns ProjectMaturity assessment
 */
export function assessProjectMaturity(projectPath: string): ProjectMaturity {
  const hasSrc = fs.existsSync(path.join(projectPath, 'src'));
  const packageJsonPath = path.join(projectPath, 'package.json');
  const hasPackageJson = fs.existsSync(packageJsonPath);

  let depCount = 0;

  if (hasPackageJson) {
    try {
      const pkgContent = fs.readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);

      const deps = Object.keys(pkg.dependencies || {}).length;
      const devDeps = Object.keys(pkg.devDependencies || {}).length;
      depCount = deps + devDeps;
    } catch (error) {
      console.warn(`[ProjectInspector] Failed to parse package.json: ${error}`);
      // If package.json is malformed, treat as having 0 dependencies
      depCount = 0;
    }
  }

  let tsFileCount = 0;
  if (hasSrc) {
    tsFileCount = countTypescriptFiles(path.join(projectPath, 'src'));
  }

  // Greenfield heuristic: no src/ OR <3 dependencies OR <5 TS files
  const isGreenfield = !hasSrc || depCount < 3 || tsFileCount < 5;
  const confidence = calculateConfidence(hasSrc, depCount, tsFileCount);

  const hasTsconfig = fs.existsSync(path.join(projectPath, 'tsconfig.json'));

  return {
    is_greenfield: isGreenfield,
    has_src_directory: hasSrc,
    has_package_json: hasPackageJson,
    package_json_dependency_count: depCount,
    has_tsconfig: hasTsconfig,
    existing_ts_file_count: tsFileCount,
    greenfield_confidence: confidence
  };
}
