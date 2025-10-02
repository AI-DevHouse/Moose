/**
 * Phase 3.1: Sentinel Agent Types
 *
 * Defines types for adaptive quality gate analysis based on
 * GitHub Actions workflow results.
 */

export interface WorkflowResult {
  workflow_name: string;
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped';
  run_id: number;
  run_url: string;
  completed_at: string;
}

export interface TestOutput {
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  failures: TestFailure[];
}

export interface TestFailure {
  test_name: string;
  error_message: string;
  stack_trace?: string;
}

export interface SentinelDecision {
  verdict: 'pass' | 'fail';
  confidence: number; // 0-1
  reasoning: string;
  test_results: TestOutput | null;
  workflow_results: WorkflowResult[];
  escalation_required: boolean;
  escalation_reason?: string;
}

export interface SentinelAnalysisRequest {
  work_order_id: string;
  github_pr_number: number;
  workflow_results: WorkflowResult[];
}

export interface SentinelAnalysisResponse {
  success: boolean;
  decision: SentinelDecision;
  error?: string;
}

/**
 * Database record for sentinel_decisions table
 * (To be created in future schema migration)
 */
export interface SentinelDecisionRecord {
  id: string;
  work_order_id: string;
  github_pr_number: number;
  verdict: 'pass' | 'fail';
  confidence: number;
  reasoning: string;
  test_results: TestOutput | null;
  workflow_results: WorkflowResult[];
  escalation_required: boolean;
  escalation_reason: string | null;
  created_at: string;
  updated_at: string;
}
