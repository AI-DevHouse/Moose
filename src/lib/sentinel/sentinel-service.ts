/**
 * Phase 3.1: Sentinel Service
 *
 * Main orchestration logic for Sentinel agent:
 * 1. Fetch Work Order by PR number (with retries for race conditions)
 * 2. Fetch workflow logs from GitHub
 * 3. Parse test results
 * 4. Make pass/fail decision
 * 5. Update Work Order status
 * 6. Escalate to Client Manager if needed
 */

import { createClient } from '@supabase/supabase-js';
import { Octokit } from '@octokit/rest';
import { handleCriticalError } from '@/lib/error-escalation';
import { SentinelDecision, WorkflowResult, TestOutput, SentinelAnalysisRequest } from '@/types/sentinel';
import { SentinelDecisionMaker } from './decision-maker';
import { TestParser } from './test-parser';

export class SentinelService {
  private supabase;
  private octokit: Octokit;
  private decisionMaker: SentinelDecisionMaker;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.octokit = new Octokit({
      auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN
    });

    this.decisionMaker = new SentinelDecisionMaker(process.env.EXPECTED_WORKFLOWS);
  }

  /**
   * Main analysis entry point
   */
  async analyzeWorkOrder(request: SentinelAnalysisRequest): Promise<SentinelDecision> {
    const { work_order_id, github_pr_number, workflow_results } = request;

    console.log(`[Sentinel] Analyzing WO ${work_order_id}, PR #${github_pr_number}`);

    // 1. Fetch Work Order with retries (handle race condition)
    const workOrder = await this.fetchWorkOrderWithRetry(work_order_id, github_pr_number);

    if (!workOrder) {
      throw new Error(`Work Order not found: ${work_order_id}`);
    }

    // 2. Fetch test logs from GitHub (if Test workflow exists)
    let testResults: TestOutput | null = null;
    const testWorkflow = workflow_results.find(w =>
      w.workflow_name === 'Test' || w.workflow_name === 'Integration Tests'
    );

    if (testWorkflow) {
      testResults = await this.fetchTestResults(testWorkflow);
    }

    // 3. Make decision
    const decision = this.decisionMaker.analyze(workflow_results, testResults);

    console.log(`[Sentinel] Decision: ${decision.verdict} (confidence: ${decision.confidence})`);

    // 4. Update Work Order status
    await this.updateWorkOrderStatus(work_order_id, decision);

    // 5. Escalate if needed
    if (decision.escalation_required) {
      await this.escalateToClientManager(work_order_id, decision);
    }

    return decision;
  }

  /**
   * Fetch Work Order by PR number with retry logic
   * Handles race condition where webhook arrives before github_pr_number is set
   */
  private async fetchWorkOrderWithRetry(
    work_order_id: string,
    github_pr_number: number,
    maxAttempts: number = 3,
    delayMs: number = 2000
  ): Promise<any> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[Sentinel] Fetching WO (attempt ${attempt}/${maxAttempts})...`);

      const { data, error } = await this.supabase
        .from('work_orders')
        .select('*')
        .eq('github_pr_number', github_pr_number)
        .single();

      if (data) {
        console.log(`[Sentinel] Found WO: ${data.id}`);
        return data;
      }

      if (attempt < maxAttempts) {
        console.log(`[Sentinel] WO not found, retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.error(`[Sentinel] WO not found after ${maxAttempts} attempts`);
    return null;
  }

  /**
   * Fetch test results from GitHub workflow logs
   */
  private async fetchTestResults(workflow: WorkflowResult): Promise<TestOutput | null> {
    try {
      // Extract repo owner/name from run_url
      const urlMatch = workflow.run_url.match(/github\.com\/([^/]+)\/([^/]+)\/actions/);
      if (!urlMatch) {
        console.warn('[Sentinel] Could not parse repo from workflow URL');
        return null;
      }

      const owner = urlMatch[1];
      const repo = urlMatch[2];

      // Fetch workflow run logs
      const { data: jobs } = await this.octokit.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: workflow.run_id
      });

      if (!jobs.jobs || jobs.jobs.length === 0) {
        return null;
      }

      // Get logs from first job (assumes test output is in first job)
      const jobId = jobs.jobs[0].id;
      const { data: logs } = await this.octokit.actions.downloadJobLogsForWorkflowRun({
        owner,
        repo,
        job_id: jobId
      });

      // Parse logs
      const logText = typeof logs === 'string' ? logs : JSON.stringify(logs);
      return TestParser.parse(logText);
    } catch (error) {
      console.error('[Sentinel] Error fetching test results:', error);
      return null;
    }
  }

  /**
   * Update Work Order status based on decision
   */
  private async updateWorkOrderStatus(
    work_order_id: string,
    decision: SentinelDecision
  ): Promise<void> {
    const newStatus = decision.verdict === 'pass' ? 'completed' : 'failed';

    const { error } = await this.supabase
      .from('work_orders')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        metadata: {
          sentinel_decision: {
            verdict: decision.verdict,
            confidence: decision.confidence,
            reasoning: decision.reasoning,
            analyzed_at: new Date().toISOString()
          }
        }
      })
      .eq('id', work_order_id);

    if (error) {
      await handleCriticalError({
        component: 'Sentinel',
        operation: 'updateWorkOrderStatus',
        error: error as Error,
        workOrderId: work_order_id,
        severity: 'critical',
        metadata: { decision }
      });
      throw error;
    }

    console.log(`[Sentinel] Updated WO ${work_order_id} status to: ${newStatus}`);
  }

  /**
   * Escalate to Client Manager for human review
   */
  private async escalateToClientManager(
    work_order_id: string,
    decision: SentinelDecision
  ): Promise<void> {
    console.log(`[Sentinel] ESCALATION REQUIRED for WO ${work_order_id}`);
    console.log(`  Reason: ${decision.escalation_reason}`);
    console.log(`  Confidence: ${decision.confidence}`);

    try {
      // Call Client Manager to create escalation
      const response = await fetch('http://localhost:3000/api/client-manager/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_order_id })
      });

      if (!response.ok) {
        const error = await response.json();

        await handleCriticalError({
          component: 'Sentinel',
          operation: 'escalateToClientManager',
          error: new Error(`Client Manager API returned ${response.status}: ${JSON.stringify(error)}`),
          workOrderId: work_order_id,
          severity: 'critical',
          metadata: { decision, apiError: error }
        });

        // Fallback: Update Work Order to indicate escalation needed
        await this.supabase
          .from('work_orders')
          .update({
            status: 'needs_human_review',
            metadata: {
              sentinel_escalation_failed: true,
              escalation_reason: decision.escalation_reason
            } as any,
            updated_at: new Date().toISOString()
          })
          .eq('id', work_order_id);

        return;
      }

      const result = await response.json();
      console.log(`[Sentinel] Escalation created: ${result.escalation.id}`);
      console.log(`  Recommended option: ${result.recommendation.recommended_option_id}`);
      console.log(`  Confidence: ${result.recommendation.confidence}`);
    } catch (error) {
      console.error('[Sentinel] Error calling Client Manager:', error);

      // Fallback: Update Work Order status
      await this.supabase
        .from('work_orders')
        .update({
          status: 'needs_human_review',
          updated_at: new Date().toISOString()
        })
        .eq('id', work_order_id);
    }
  }
}
