/**
 * OutcomeAggregator: Collects multi-dimensional outcomes for work orders
 *
 * Aggregates outcomes across:
 * - Code writing (outcome_vectors)
 * - Tests (github_events)
 * - Build (github_events)
 * - PR/CI (github_events)
 * - Production (future monitoring integration)
 */

import { createClient } from '@supabase/supabase-js';

export interface MultiDimensionalOutcome {
  work_order_id: string;

  // Code writing dimension
  code_writing: {
    success: boolean;
    errors: number;
    failure_class?: string;
    execution_time_ms: number;
    model_used: string;
    cost: number;
  };

  // Test dimension
  tests: {
    success: boolean;
    passed: number;
    failed: number;
    execution_time_ms: number;
    coverage_percent?: number;
  };

  // Build dimension
  build: {
    success: boolean;
    time_ms: number;
    error_count: number;
    warnings: number;
  };

  // PR/CI dimension
  pr_ci: {
    pr_merged: boolean;
    review_comments: number;
    merge_time_hours: number;
    ci_checks_passed: number;
    ci_checks_failed: number;
  };

  // Production dimension (future)
  production?: {
    errors_24h: number;
    uptime_percent: number;
  };
}

export class OutcomeAggregator {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Aggregate all outcome dimensions for a work order
   */
  async aggregateOutcomes(workOrderId: string): Promise<MultiDimensionalOutcome | null> {
    // 1. Get code writing outcomes
    const { data: outcomeVector, error: outcomeError } = await this.supabase
      .from('outcome_vectors')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (outcomeError || !outcomeVector) {
      console.log(`No outcome vector found for work order ${workOrderId}`);
      return null;
    }

    // 2. Get GitHub events for this WO
    const { data: githubEvents } = await this.supabase
      .from('github_events')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: true });

    // 3. Parse test results
    const testResults = this.parseTestResults(githubEvents || []);

    // 4. Parse build results
    const buildResults = this.parseBuildResults(githubEvents || []);

    // 5. Parse PR/CI results
    const prCiResults = this.parsePRResults(githubEvents || []);

    return {
      work_order_id: workOrderId,
      code_writing: {
        success: outcomeVector.success,
        errors: this.countErrors(outcomeVector.failure_classes),
        failure_class: this.getFirstFailureClass(outcomeVector.failure_classes),
        execution_time_ms: outcomeVector.execution_time_ms,
        model_used: outcomeVector.model_used,
        cost: parseFloat(outcomeVector.cost)
      },
      tests: testResults,
      build: buildResults,
      pr_ci: prCiResults
    };
  }

  private parseTestResults(events: any[]): MultiDimensionalOutcome['tests'] {
    // Find test workflow events
    const testEvents = events.filter(e =>
      e.event_type === 'workflow_run' &&
      (e.workflow_name?.toLowerCase().includes('test') ||
       e.workflow_name?.toLowerCase().includes('vitest') ||
       e.workflow_name?.toLowerCase().includes('jest'))
    );

    if (testEvents.length === 0) {
      // Default: assume tests passed if no test events
      return {
        success: true,
        passed: 0,
        failed: 0,
        execution_time_ms: 0
      };
    }

    // Get most recent test run
    const latestTest = testEvents[testEvents.length - 1];

    return {
      success: latestTest.status === 'success' || latestTest.status === 'completed',
      passed: latestTest.payload?.test_stats?.passed || 0,
      failed: latestTest.payload?.test_stats?.failed || 0,
      execution_time_ms: latestTest.payload?.duration_ms || 0,
      coverage_percent: latestTest.payload?.coverage?.total
    };
  }

  private parseBuildResults(events: any[]): MultiDimensionalOutcome['build'] {
    // Find build workflow events
    const buildEvents = events.filter(e =>
      e.event_type === 'workflow_run' &&
      (e.workflow_name?.toLowerCase().includes('build') ||
       e.workflow_name?.toLowerCase().includes('compile'))
    );

    if (buildEvents.length === 0) {
      // Default: assume build passed if no build events
      return {
        success: true,
        time_ms: 0,
        error_count: 0,
        warnings: 0
      };
    }

    const latestBuild = buildEvents[buildEvents.length - 1];

    return {
      success: latestBuild.status === 'success' || latestBuild.status === 'completed',
      time_ms: latestBuild.payload?.duration_ms || 0,
      error_count: latestBuild.payload?.error_count || 0,
      warnings: latestBuild.payload?.warning_count || 0
    };
  }

  private parsePRResults(events: any[]): MultiDimensionalOutcome['pr_ci'] {
    // Find PR events
    const prEvents = events.filter(e =>
      e.event_type === 'pull_request' ||
      e.event_type === 'pull_request_review'
    );
    const ciEvents = events.filter(e =>
      e.event_type === 'check_suite' ||
      e.event_type === 'workflow_run'
    );

    if (prEvents.length === 0) {
      // Default: no PR yet
      return {
        pr_merged: false,
        review_comments: 0,
        merge_time_hours: 0,
        ci_checks_passed: 0,
        ci_checks_failed: 0
      };
    }

    const prEvent = prEvents[prEvents.length - 1];
    const pr = prEvent.payload;

    // Calculate merge time
    const createdAt = pr.created_at ? new Date(pr.created_at) : new Date();
    const mergedAt = pr.merged_at ? new Date(pr.merged_at) : null;
    const mergeTimeHours = mergedAt
      ? (mergedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
      : 0;

    // Count CI checks
    const ciPassed = ciEvents.filter(e =>
      e.status === 'success' || e.status === 'completed'
    ).length;
    const ciFailed = ciEvents.filter(e =>
      e.status === 'failure' || e.status === 'failed'
    ).length;

    return {
      pr_merged: pr.merged === true || pr.state === 'merged',
      review_comments: pr.review_comments || pr.comments || 0,
      merge_time_hours: mergeTimeHours,
      ci_checks_passed: ciPassed,
      ci_checks_failed: ciFailed
    };
  }

  private countErrors(failureClasses: any): number {
    if (!failureClasses) return 0;
    if (Array.isArray(failureClasses)) return failureClasses.length;
    if (typeof failureClasses === 'object') {
      return Object.keys(failureClasses).length;
    }
    return 0;
  }

  private getFirstFailureClass(failureClasses: any): string | undefined {
    if (!failureClasses) return undefined;
    if (Array.isArray(failureClasses) && failureClasses.length > 0) {
      return failureClasses[0];
    }
    if (typeof failureClasses === 'object') {
      const keys = Object.keys(failureClasses);
      return keys.length > 0 ? keys[0] : undefined;
    }
    return undefined;
  }
}
