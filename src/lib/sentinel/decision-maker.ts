/**
 * Phase 3.1: Sentinel Decision Maker
 *
 * Analyzes workflow results and makes pass/fail decisions for Work Orders.
 * MVP: Binary pass/fail only, no flaky detection.
 */

import { SentinelDecision, WorkflowResult, TestOutput } from '@/types/sentinel';

export class SentinelDecisionMaker {
  private expectedWorkflows: string[];

  constructor(expectedWorkflowsEnv?: string) {
    // Parse from EXPECTED_WORKFLOWS env var
    this.expectedWorkflows = expectedWorkflowsEnv
      ? expectedWorkflowsEnv.split(',').map(w => w.trim())
      : ['Build', 'Test', 'Integration Tests', 'Lint'];
  }

  /**
   * Make a pass/fail decision based on workflow results
   *
   * MVP Logic:
   * - PASS: All expected workflows succeeded
   * - FAIL: Any expected workflow failed
   * - ESCALATE: Missing workflows or unexpected patterns
   */
  analyze(
    workflowResults: WorkflowResult[],
    testResults: TestOutput | null
  ): SentinelDecision {
    const workflowMap = new Map<string, WorkflowResult>();
    for (const result of workflowResults) {
      workflowMap.set(result.workflow_name, result);
    }

    // Check for missing workflows
    const missingWorkflows = this.expectedWorkflows.filter(
      name => !workflowMap.has(name)
    );

    if (missingWorkflows.length > 0) {
      return {
        verdict: 'fail',
        confidence: 0.7,
        reasoning: `Missing expected workflows: ${missingWorkflows.join(', ')}. Cannot make reliable quality assessment.`,
        test_results: testResults,
        workflow_results: workflowResults,
        escalation_required: true,
        escalation_reason: 'Incomplete workflow execution'
      };
    }

    // Check for any failures
    const failedWorkflows = workflowResults.filter(
      w => w.conclusion === 'failure'
    );

    if (failedWorkflows.length > 0) {
      const failedNames = failedWorkflows.map(w => w.workflow_name).join(', ');

      // Calculate confidence based on clarity of failure
      const confidence = this.calculateFailureConfidence(failedWorkflows, testResults);

      return {
        verdict: 'fail',
        confidence,
        reasoning: `Workflows failed: ${failedNames}. ${this.formatFailureDetails(testResults)}`,
        test_results: testResults,
        workflow_results: workflowResults,
        escalation_required: confidence < 0.8,
        escalation_reason: confidence < 0.8 ? 'Low confidence in failure analysis' : undefined
      };
    }

    // Check for cancelled/skipped workflows
    const incompleteWorkflows = workflowResults.filter(
      w => w.conclusion === 'cancelled' || w.conclusion === 'skipped'
    );

    if (incompleteWorkflows.length > 0) {
      return {
        verdict: 'fail',
        confidence: 0.6,
        reasoning: `Some workflows were cancelled or skipped. Manual review required.`,
        test_results: testResults,
        workflow_results: workflowResults,
        escalation_required: true,
        escalation_reason: 'Incomplete workflow execution'
      };
    }

    // All workflows passed
    return {
      verdict: 'pass',
      confidence: 1.0,
      reasoning: `All expected workflows passed successfully. ${this.formatSuccessDetails(testResults)}`,
      test_results: testResults,
      workflow_results: workflowResults,
      escalation_required: false
    };
  }

  private calculateFailureConfidence(
    failedWorkflows: WorkflowResult[],
    testResults: TestOutput | null
  ): number {
    // Start with base confidence
    let confidence = 0.9;

    // Reduce confidence if we don't have test details
    if (!testResults || testResults.total_tests === 0) {
      confidence -= 0.2;
    }

    // Reduce confidence if multiple workflows failed (may indicate infrastructure issue)
    if (failedWorkflows.length > 2) {
      confidence -= 0.1;
    }

    return Math.max(0.5, confidence);
  }

  private formatFailureDetails(testResults: TestOutput | null): string {
    if (!testResults || testResults.failed === 0) {
      return 'No test details available.';
    }

    const failureList = testResults.failures
      .slice(0, 3) // Show first 3 failures
      .map(f => `"${f.test_name}"`)
      .join(', ');

    const remaining = testResults.failures.length > 3
      ? ` and ${testResults.failures.length - 3} more`
      : '';

    return `Failed tests: ${failureList}${remaining}. (${testResults.failed}/${testResults.total_tests} failed)`;
  }

  private formatSuccessDetails(testResults: TestOutput | null): string {
    if (!testResults || testResults.total_tests === 0) {
      return '';
    }

    return `Tests: ${testResults.passed}/${testResults.total_tests} passed.`;
  }

  /**
   * Get expected workflow names for validation
   */
  getExpectedWorkflows(): string[] {
    return [...this.expectedWorkflows];
  }
}
