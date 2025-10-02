/**
 * Phase 3.1: Test Output Parser
 *
 * Parses test results from GitHub Actions workflow logs.
 * Initially supports PowerShell test output format.
 */

import { TestOutput, TestFailure } from '@/types/sentinel';

export class TestParser {
  /**
   * Parse PowerShell test output from integration test script
   *
   * Expected format:
   * ✓ Test Name
   * ✗ Failed Test Name
   *   Error: Reason for failure
   *
   * Final line:
   * Tests: 18/20 passed
   */
  static parsePowerShellTests(output: string): TestOutput {
    const lines = output.split('\n');
    const failures: TestFailure[] = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    let currentFailure: Partial<TestFailure> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check for passing test
      if (line.startsWith('✓') || line.startsWith('V')) {
        passed++;
        continue;
      }

      // Check for failing test
      if (line.startsWith('✗') || line.startsWith('X')) {
        const testName = line.substring(1).trim();
        currentFailure = { test_name: testName, error_message: '' };
        failed++;
        continue;
      }

      // Capture error message for current failure
      if (currentFailure && line.startsWith('Error:')) {
        currentFailure.error_message = line.substring(6).trim();
        failures.push(currentFailure as TestFailure);
        currentFailure = null;
        continue;
      }

      // Parse summary line
      const summaryMatch = line.match(/Tests:\s*(\d+)\/(\d+)\s+passed/i);
      if (summaryMatch) {
        passed = parseInt(summaryMatch[1], 10);
        const total = parseInt(summaryMatch[2], 10);
        failed = total - passed;
        break;
      }
    }

    const total = passed + failed + skipped;

    return {
      total_tests: total,
      passed,
      failed,
      skipped,
      duration_ms: 0, // Not parsed from PowerShell output
      failures
    };
  }

  /**
   * Parse Jest/npm test output
   *
   * Expected format:
   * PASS  src/test.ts
   * FAIL  src/other.ts
   *   ● Test suite failed to run
   *
   * Tests:       5 passed, 2 failed, 7 total
   */
  static parseJestTests(output: string): TestOutput {
    const lines = output.split('\n');
    const failures: TestFailure[] = [];
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    let currentFailure: Partial<TestFailure> | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Check for test summary line
      const summaryMatch = trimmed.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+failed,\s+(\d+)\s+total/i);
      if (summaryMatch) {
        passed = parseInt(summaryMatch[1], 10);
        failed = parseInt(summaryMatch[2], 10);
        const total = parseInt(summaryMatch[3], 10);
        skipped = total - passed - failed;
        break;
      }

      // Check for failure marker
      if (trimmed.startsWith('● ')) {
        const testName = trimmed.substring(2);
        currentFailure = { test_name: testName, error_message: '' };
        continue;
      }

      // Capture error message
      if (currentFailure && trimmed.length > 0 && !trimmed.startsWith('●')) {
        currentFailure.error_message = trimmed;
        failures.push(currentFailure as TestFailure);
        currentFailure = null;
      }
    }

    const total = passed + failed + skipped;

    return {
      total_tests: total,
      passed,
      failed,
      skipped,
      duration_ms: 0,
      failures
    };
  }

  /**
   * Auto-detect format and parse
   */
  static parse(output: string): TestOutput {
    // Check for PowerShell format indicators
    if (output.includes('Tests:') && (output.includes('✓') || output.includes('✗'))) {
      return this.parsePowerShellTests(output);
    }

    // Check for Jest format indicators
    if (output.includes('PASS') || output.includes('FAIL')) {
      return this.parseJestTests(output);
    }

    // Default: return empty results
    return {
      total_tests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration_ms: 0,
      failures: []
    };
  }
}
