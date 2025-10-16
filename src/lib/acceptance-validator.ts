/**
 * Acceptance Validator (Phase 4)
 *
 * Validates work order quality across 5 dimensions:
 * 1. Architecture (25%) - File sizes, complexity
 * 2. Readability (15%) - Complexity, lint warnings
 * 3. Completeness (25%) - TODO count, build success
 * 4. Test Coverage (20%) - Coverage %, tests passed
 * 5. Build Success (15%) - Build outcome
 *
 * Ref: docs/Self_Reinforcement_Architecture.md §4.1
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface AcceptanceResult {
  dimension_scores: {
    architecture: number;      // 1-10
    readability: number;        // 1-10
    completeness: number;       // 1-10
    test_coverage: number;      // 1-10
    build_success: number;      // 10 or 0
  };
  acceptance_score: number;     // Weighted aggregate
  build_passed: boolean;
  tests_passed: boolean;
  lint_errors: number;
  todo_count: number;
  test_coverage_percent: number;
  timestamp: string;
}

interface BuildResult {
  success: boolean;
  output: string;
  errorCount: number;
}

interface TestResult {
  success: boolean;
  passed: boolean;
  output: string;
  coverage: number;
}

interface LintResult {
  errorCount: number;
  warningCount: number;
  output: string;
}

/**
 * Main validation function - runs all checks and calculates acceptance score
 */
export async function validateWorkOrderAcceptance(
  workOrderId: string,
  prUrl: string,
  projectPath: string
): Promise<AcceptanceResult> {
  console.log(`\n📊 Running acceptance validation for WO ${workOrderId.slice(0, 8)}...`);

  // Run automated checks
  const buildResult = await runBuild(projectPath);
  const testResult = await runTests(projectPath);
  const lintResult = await runLint(projectPath);

  // Extract metrics
  const todoCount = await countTodosInProject(projectPath);
  const fileSizes = await analyzeFileSizes(projectPath);
  const complexity = await estimateComplexity(projectPath);

  // Calculate per-dimension scores
  const dimensionScores = {
    architecture: calculateArchitectureScore(fileSizes, complexity),
    readability: calculateReadabilityScore(complexity, lintResult.warningCount),
    completeness: calculateCompletenessScore(todoCount, buildResult.success),
    test_coverage: calculateTestCoverageScore(testResult.coverage, testResult.passed),
    build_success: buildResult.success ? 10 : 0
  };

  // Weighted aggregate (matches macro rubric)
  const acceptance_score = (
    dimensionScores.architecture * 0.25 +
    dimensionScores.readability * 0.15 +
    dimensionScores.completeness * 0.25 +
    dimensionScores.test_coverage * 0.20 +
    dimensionScores.build_success * 0.15
  );

  const result: AcceptanceResult = {
    dimension_scores: dimensionScores,
    acceptance_score: Math.round(acceptance_score * 10) / 10, // Round to 1 decimal
    build_passed: buildResult.success,
    tests_passed: testResult.passed,
    lint_errors: lintResult.errorCount,
    todo_count: todoCount,
    test_coverage_percent: testResult.coverage,
    timestamp: new Date().toISOString()
  };

  console.log(`✅ Acceptance Score: ${result.acceptance_score.toFixed(1)}/10`);
  console.log(`   Architecture: ${dimensionScores.architecture}/10`);
  console.log(`   Readability: ${dimensionScores.readability}/10`);
  console.log(`   Completeness: ${dimensionScores.completeness}/10`);
  console.log(`   Test Coverage: ${dimensionScores.test_coverage}/10`);
  console.log(`   Build Success: ${dimensionScores.build_success}/10`);

  return result;
}

/**
 * Score 1: Architecture (25%)
 * Based on file sizes and code complexity
 *
 * Scoring:
 * - 10: All files <500 lines, low complexity
 * - 7-9: Mostly small files, moderate complexity
 * - 4-6: Some large files (500-1000 lines)
 * - 1-3: Multiple files >1000 lines or very high complexity
 */
export function calculateArchitectureScore(fileSizes: number[], complexity: number): number {
  if (fileSizes.length === 0) return 5; // Default for no files

  const avgFileSize = fileSizes.reduce((a, b) => a + b, 0) / fileSizes.length;
  const maxFileSize = Math.max(...fileSizes);
  const largeFileCount = fileSizes.filter(size => size > 500).length;

  let score = 10;

  // Penalize large files
  if (maxFileSize > 1000) score -= 4;
  else if (maxFileSize > 700) score -= 2;
  else if (maxFileSize > 500) score -= 1;

  // Penalize high average file size
  if (avgFileSize > 400) score -= 2;
  else if (avgFileSize > 300) score -= 1;

  // Penalize multiple large files
  if (largeFileCount > 3) score -= 2;
  else if (largeFileCount > 1) score -= 1;

  // Penalize high complexity
  if (complexity > 50) score -= 3;
  else if (complexity > 30) score -= 2;
  else if (complexity > 20) score -= 1;

  return Math.max(1, Math.min(10, score));
}

/**
 * Score 2: Readability (15%)
 * Based on code complexity and lint warnings
 *
 * Scoring:
 * - 10: Low complexity, 0 lint warnings
 * - 7-9: Moderate complexity, few warnings (<5)
 * - 4-6: Higher complexity or moderate warnings (5-15)
 * - 1-3: High complexity or many warnings (>15)
 */
export function calculateReadabilityScore(complexity: number, lintWarnings: number): number {
  let score = 10;

  // Penalize complexity
  if (complexity > 50) score -= 4;
  else if (complexity > 30) score -= 3;
  else if (complexity > 20) score -= 2;
  else if (complexity > 10) score -= 1;

  // Penalize lint warnings
  if (lintWarnings > 20) score -= 4;
  else if (lintWarnings > 15) score -= 3;
  else if (lintWarnings > 10) score -= 2;
  else if (lintWarnings > 5) score -= 1;

  return Math.max(1, Math.min(10, score));
}

/**
 * Score 3: Completeness (25%)
 * Based on TODO count and build success
 *
 * Scoring:
 * - 10: Build passes, 0 TODOs
 * - 7-9: Build passes, few TODOs (1-3)
 * - 4-6: Build passes, moderate TODOs (4-8) OR build fails with progress
 * - 1-3: Build fails with many errors OR many TODOs (>8)
 */
export function calculateCompletenessScore(todoCount: number, buildSuccess: boolean): number {
  if (!buildSuccess) {
    return 2; // Build failure = incomplete
  }

  let score = 10;

  // Penalize TODOs
  if (todoCount > 10) score -= 5;
  else if (todoCount > 8) score -= 4;
  else if (todoCount > 5) score -= 3;
  else if (todoCount > 3) score -= 2;
  else if (todoCount > 0) score -= 1;

  return Math.max(1, Math.min(10, score));
}

/**
 * Score 4: Test Coverage (20%)
 * Based on coverage % and whether tests pass
 *
 * Scoring:
 * - 10: ≥80% coverage, all tests pass
 * - 7-9: 60-79% coverage, all tests pass
 * - 4-6: 40-59% coverage OR some tests fail
 * - 1-3: <40% coverage OR many tests fail
 * - 0: No tests found
 */
export function calculateTestCoverageScore(coverage: number, testsPassed: boolean): number {
  if (coverage === 0) return 0; // No tests

  if (!testsPassed) {
    // Tests exist but failing
    return Math.max(1, Math.min(4, Math.floor(coverage / 20)));
  }

  // Tests pass, score by coverage
  if (coverage >= 80) return 10;
  if (coverage >= 70) return 9;
  if (coverage >= 60) return 8;
  if (coverage >= 50) return 7;
  if (coverage >= 40) return 6;
  if (coverage >= 30) return 5;
  if (coverage >= 20) return 4;
  if (coverage >= 10) return 3;
  return 2;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function runBuild(projectPath: string): Promise<BuildResult> {
  try {
    const output = execSync('npm run build', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 120000 // 2 minute timeout
    });

    return { success: true, output, errorCount: 0 };
  } catch (error: any) {
    const output = error.stdout || error.stderr || error.message;
    const errorCount = (output.match(/error/gi) || []).length;
    return { success: false, output, errorCount };
  }
}

async function runTests(projectPath: string): Promise<TestResult> {
  try {
    // Try to run tests with coverage
    const output = execSync('npm test -- --coverage --passWithNoTests', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 180000 // 3 minute timeout
    });

    const coverage = extractCoveragePercent(output);
    const passed = !output.toLowerCase().includes('failed');

    return { success: true, passed, output, coverage };
  } catch (error: any) {
    const output = error.stdout || error.stderr || error.message;
    const coverage = extractCoveragePercent(output);

    // Check if it's just "no tests found" vs actual failures
    if (output.includes('No tests found') || output.includes('no test')) {
      return { success: true, passed: true, output, coverage: 0 };
    }

    return { success: false, passed: false, output, coverage };
  }
}

async function runLint(projectPath: string): Promise<LintResult> {
  try {
    const output = execSync('npm run lint', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 60000 // 1 minute timeout
    });

    return { errorCount: 0, warningCount: 0, output };
  } catch (error: any) {
    const output = error.stdout || error.stderr || error.message;

    // Parse lint output for error/warning counts
    const errorMatch = output.match(/(\d+)\s+error/i);
    const warningMatch = output.match(/(\d+)\s+warning/i);

    const errorCount = errorMatch ? parseInt(errorMatch[1]) : 0;
    const warningCount = warningMatch ? parseInt(warningMatch[1]) : 0;

    return { errorCount, warningCount, output };
  }
}

async function countTodosInProject(projectPath: string): Promise<number> {
  try {
    const output = execSync('git grep -i "TODO\\|FIXME\\|XXX" -- "*.ts" "*.tsx" "*.js" "*.jsx" || echo "No TODOs"', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    if (output.trim() === 'No TODOs' || output.trim() === '') {
      return 0;
    }

    // Count lines (each line is one TODO)
    return output.trim().split('\n').length;
  } catch (error) {
    return 0; // No TODOs found or git grep failed
  }
}

async function analyzeFileSizes(projectPath: string): Promise<number[]> {
  try {
    // Find all TS/TSX/JS/JSX files (exclude node_modules, dist)
    const output = execSync(
      'git ls-files "*.ts" "*.tsx" "*.js" "*.jsx" | xargs wc -l 2>/dev/null || echo ""',
      {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: 'pipe'
      }
    );

    if (!output.trim()) return [];

    // Parse wc output: "123 path/to/file.ts"
    const lines = output.trim().split('\n');
    const sizes = lines
      .map(line => {
        const match = line.trim().match(/^(\d+)/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(size => size > 0);

    return sizes;
  } catch (error) {
    return [];
  }
}

async function estimateComplexity(projectPath: string): Promise<number> {
  try {
    // Simple complexity heuristic: count conditional statements and loops
    const output = execSync(
      'git grep -h -E "(if\\s*\\(|for\\s*\\(|while\\s*\\(|switch\\s*\\(|case\\s+)" -- "*.ts" "*.tsx" "*.js" "*.jsx" | wc -l || echo 0',
      {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: 'pipe'
      }
    );

    return parseInt(output.trim()) || 0;
  } catch (error) {
    return 0;
  }
}

function extractCoveragePercent(output: string): number {
  // Try multiple patterns for coverage output
  const patterns = [
    /All files\s*\|\s*(\d+\.?\d*)/i,           // Jest format
    /Statements\s*:\s*(\d+\.?\d*)%/i,          // Istanbul format
    /Lines\s*:\s*(\d+\.?\d*)%/i,               // Alternative format
    /Coverage:\s*(\d+\.?\d*)%/i                // Generic format
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) {
      return parseFloat(match[1]);
    }
  }

  return 0; // No coverage found
}
