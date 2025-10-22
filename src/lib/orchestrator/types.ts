// Orchestrator-specific types

import type { EnhancedProposerResponse } from '@/lib/enhanced-proposer-service';
import type { RoutingDecision } from '@/lib/manager-routing-rules';

// Aider execution result
export interface AiderResult {
  success: boolean;
  branch_name: string;
  stdout: string;
  stderr: string;
}

// GitHub PR result
export interface GitHubPRResult {
  pr_url: string;
  pr_number: number;
  branch_name: string;
}

// Complete execution result
export interface ExecutionResult {
  success: boolean;
  work_order_id: string;
  pr_url?: string;
  pr_number?: number;
  branch_name?: string;
  execution_time_ms: number;
  error?: {
    stage: 'routing' | 'proposer' | 'aider' | 'github';
    message: string;
  };
}

// Orchestrator status
export interface OrchestratorStatus {
  polling: boolean;
  interval_ms: number;
  executing_count: number;
  executing_work_orders: string[];
  last_poll: string | null;
  total_executed: number;
  total_failed: number;
  errors: Array<{
    message: string;
    timestamp: string;
    work_order_id?: string;
  }>;
}

// Work Order type (extended from database)
export interface WorkOrder {
  id: string;
  title: string;
  description: string;
  status: string;
  risk_level: 'low' | 'medium' | 'high';
  estimated_cost: number;
  pattern_confidence: number;
  proposer_id: string | null;
  project_id?: string | null;  // NEW: Links work order to target project
  acceptance_criteria: string[] | null;
  files_in_scope: string[] | null;
  context_budget_estimate: number | null;
  decomposition_doc: string | null;
  architect_version: string | null;
  metadata: any;
  github_pr_url?: string | null;
  github_pr_number?: number | null;
  github_branch?: string | null;
  created_at: string;
  updated_at: string;
}

// Worktree Pool types
export interface WorktreeHandle {
  id: string;                    // e.g., "wt-1"
  path: string;                  // e.g., "C:\dev\multi-llm-discussion-v1-wt-1"
  project_id: string;
  leased_to: string | null;      // work_order_id (null if available)
  leased_at: Date | null;
}

export interface WorktreePoolStatus {
  total: number;
  available: number;
  leased: number;
  waiters: number;
  leasedWorktrees: Map<string, WorktreeHandle>;  // workOrderId → handle
}
