// FLAKY Test Detector - Track test reliability and classify flaky tests

import { createSupabaseServiceClient } from '@/lib/supabase';

/**
 * Test result status for tracking history
 */
export type TestStatus = 'pass' | 'fail';

/**
 * Test classification based on pass rate
 *
 * - STABLE_PASS: >90% pass rate (reliable test, always passes)
 * - FLAKY: 10-90% pass rate (unreliable test, intermittent failures)
 * - STABLE_FAIL: <10% pass rate (reliable test, always fails)
 */
export type TestClassification = 'STABLE_PASS' | 'FLAKY' | 'STABLE_FAIL';

/**
 * Test history entry for tracking pass/fail patterns
 */
export interface TestHistoryEntry {
  test_name: string;
  status: TestStatus;
  work_order_id: string;
  timestamp: Date;
}

/**
 * Test statistics for classification
 */
export interface TestStats {
  test_name: string;
  total_runs: number;
  total_passes: number;
  total_fails: number;
  pass_rate: number;
  classification: TestClassification;
  should_ignore: boolean;
  last_seen: Date;
}

/**
 * FLAKY Detection Thresholds (configurable)
 */
export const FLAKY_THRESHOLDS = {
  STABLE_PASS_MIN: 0.90,      // >90% = STABLE_PASS
  FLAKY_MIN: 0.10,             // 10-90% = FLAKY
  FLAKY_MAX: 0.90,
  MIN_RUNS_FOR_CLASSIFICATION: 5,  // Need 5+ runs to classify
  AUTO_IGNORE_FLAKE_RATE: 0.10,   // Auto-ignore if >10% flake rate over 20+ runs
  AUTO_IGNORE_MIN_RUNS: 20         // Need 20+ runs to auto-ignore
};

/**
 * Flaky Detector (Singleton)
 *
 * Tracks test pass/fail history and classifies tests as:
 * - STABLE_PASS (>90% pass)
 * - FLAKY (10-90% pass)
 * - STABLE_FAIL (<10% pass)
 *
 * Auto-ignores FLAKY tests with >10% flake rate over 20+ runs
 */
export class FlakyDetector {
  private static instance: FlakyDetector;

  // In-memory cache of test statistics
  private testStatsCache: Map<string, TestStats> = new Map();

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): FlakyDetector {
    if (!FlakyDetector.instance) {
      FlakyDetector.instance = new FlakyDetector();
    }
    return FlakyDetector.instance;
  }

  /**
   * Record test result in database
   *
   * TODO: Implement after deployment when we have real test data
   * For now, this is infrastructure-only (no database writes)
   *
   * @param testName - Test name (e.g., "test_user_authentication")
   * @param status - Pass or fail
   * @param workOrderId - Work order ID that triggered this test
   */
  public async recordTestResult(
    testName: string,
    status: TestStatus,
    workOrderId: string
  ): Promise<void> {
    // TODO: Store test results in database
    // This will be implemented after deployment when we have real test execution data
    console.log(`[FlakyDetector] Would record ${status} for test "${testName}" (WO ${workOrderId}) - NOT IMPLEMENTED YET`);

    // Invalidate cache for this test
    this.testStatsCache.delete(testName);
  }

  /**
   * Get test statistics from database
   *
   * Queries outcome_vectors for test history and calculates statistics
   *
   * @param testName - Test name to analyze
   * @param maxResults - Max number of historical results to analyze (default 50)
   * @returns Test statistics with classification
   */
  public async getTestStats(
    testName: string,
    maxResults: number = 50
  ): Promise<TestStats> {
    // Check cache first
    if (this.testStatsCache.has(testName)) {
      return this.testStatsCache.get(testName)!;
    }

    const supabase = createSupabaseServiceClient();

    try {
      // Query outcome_vectors for this test's history
      const { data, error } = await supabase
        .from('outcome_vectors')
        .select('success, created_at, metadata')
        .eq('metadata->test_result->>test_name', testName)
        .order('created_at', { ascending: false })
        .limit(maxResults);

      if (error) {
        throw new Error(`Failed to query test history: ${error.message}`);
      }

      if (!data || data.length === 0) {
        // No history - return default stats
        return {
          test_name: testName,
          total_runs: 0,
          total_passes: 0,
          total_fails: 0,
          pass_rate: 0,
          classification: 'STABLE_FAIL',
          should_ignore: false,
          last_seen: new Date()
        };
      }

      // Calculate statistics
      const totalRuns = data.length;
      const totalPasses = data.filter(d => d.success).length;
      const totalFails = totalRuns - totalPasses;
      const passRate = totalPasses / totalRuns;

      // Classify test based on pass rate
      const classification = this.classifyTest(passRate, totalRuns);

      // Determine if should auto-ignore
      const shouldIgnore = this.shouldIgnoreTest(passRate, totalRuns, classification);

      const stats: TestStats = {
        test_name: testName,
        total_runs: totalRuns,
        total_passes: totalPasses,
        total_fails: totalFails,
        pass_rate: passRate,
        classification,
        should_ignore: shouldIgnore,
        last_seen: new Date(data[0].created_at)
      };

      // Cache stats
      this.testStatsCache.set(testName, stats);

      return stats;
    } catch (error) {
      console.error(`[FlakyDetector] Error getting test stats:`, error);
      // Return default stats on error
      return {
        test_name: testName,
        total_runs: 0,
        total_passes: 0,
        total_fails: 0,
        pass_rate: 0,
        classification: 'STABLE_FAIL',
        should_ignore: false,
        last_seen: new Date()
      };
    }
  }

  /**
   * Classify test based on pass rate
   *
   * @param passRate - Pass rate (0.0 to 1.0)
   * @param totalRuns - Total number of runs
   * @returns Test classification
   */
  private classifyTest(passRate: number, totalRuns: number): TestClassification {
    // Need minimum runs to classify
    if (totalRuns < FLAKY_THRESHOLDS.MIN_RUNS_FOR_CLASSIFICATION) {
      // Insufficient data - assume STABLE_PASS if passing, STABLE_FAIL otherwise
      return passRate >= 0.5 ? 'STABLE_PASS' : 'STABLE_FAIL';
    }

    if (passRate > FLAKY_THRESHOLDS.STABLE_PASS_MIN) {
      return 'STABLE_PASS';
    } else if (passRate >= FLAKY_THRESHOLDS.FLAKY_MIN && passRate <= FLAKY_THRESHOLDS.FLAKY_MAX) {
      return 'FLAKY';
    } else {
      return 'STABLE_FAIL';
    }
  }

  /**
   * Determine if test should be auto-ignored
   *
   * Auto-ignore if:
   * - Classification is FLAKY
   * - Total runs >= 20
   * - Flake rate > 10%
   *
   * @param passRate - Pass rate (0.0 to 1.0)
   * @param totalRuns - Total number of runs
   * @param classification - Test classification
   * @returns True if should ignore
   */
  private shouldIgnoreTest(
    passRate: number,
    totalRuns: number,
    classification: TestClassification
  ): boolean {
    if (classification !== 'FLAKY') {
      return false;
    }

    if (totalRuns < FLAKY_THRESHOLDS.AUTO_IGNORE_MIN_RUNS) {
      return false;
    }

    // Flake rate = failure rate for FLAKY tests
    const flakeRate = 1 - passRate;

    return flakeRate > FLAKY_THRESHOLDS.AUTO_IGNORE_FLAKE_RATE;
  }

  /**
   * Analyze multiple test results and filter out flaky tests
   *
   * Returns filtered list excluding:
   * - Tests classified as FLAKY with should_ignore=true
   * - Tests with insufficient history (assumed stable)
   *
   * @param testResults - Array of test names and their current status
   * @returns Filtered test results (non-flaky failures only)
   */
  public async filterFlakyTests(
    testResults: Array<{ test_name: string; status: TestStatus }>
  ): Promise<Array<{ test_name: string; status: TestStatus; classification: TestClassification }>> {
    const filtered: Array<{ test_name: string; status: TestStatus; classification: TestClassification }> = [];

    for (const test of testResults) {
      const stats = await this.getTestStats(test.test_name);

      // Skip flaky tests that should be ignored
      if (stats.should_ignore) {
        console.log(`[FlakyDetector] Ignoring flaky test "${test.test_name}" (${(stats.pass_rate * 100).toFixed(1)}% pass rate over ${stats.total_runs} runs)`);
        continue;
      }

      // Include non-flaky test results
      filtered.push({
        ...test,
        classification: stats.classification
      });
    }

    return filtered;
  }

  /**
   * Clear cache (for testing)
   */
  public clearCache(): void {
    this.testStatsCache.clear();
  }
}
