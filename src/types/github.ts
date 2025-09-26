// src/types/github.ts
// Enhanced GitHub Integration Types - Preserving Mission Control Work Order Integration
// Version: Enhanced from existing while adding Phase 2.1.2 requirements

// Base GitHub Types (preserved from existing)
export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  type?: 'User' | 'Bot'; // Added for GitHub App support
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  default_branch: string;
  owner?: GitHubUser; // Added for API operations
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  merged: boolean;
  draft: boolean;
  html_url: string;
  head: {
    ref: string;
    sha: string;
    repo?: GitHubRepository; // Added for cross-repo PRs
  };
  base: {
    ref: string;
    sha: string;
    repo?: GitHubRepository; // Added for cross-repo PRs
  };
  user: GitHubUser;
  labels?: GitHubLabel[]; // Added for PR labeling
  created_at: string;
  updated_at: string;
  merged_at?: string;
}

export interface GitHubCommit {
  id: string;
  message: string;
  author: {
    name: string;
    email: string;
    username?: string; // Added for GitHub user linking
  };
  url: string;
  added: string[];
  removed: string[];
  modified: string[];
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required' | 'stale' | null;
  html_url: string;
  created_at: string;
  updated_at: string;
  head_branch: string;
  head_sha: string;
  pull_requests?: GitHubPullRequest[]; // Added for PR association
}

export interface GitHubCheckRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required' | 'stale' | null;
  html_url: string;
  started_at: string;
  completed_at?: string;
  pull_requests?: GitHubPullRequest[]; // Added for PR association
}

// Webhook Event Types (preserved and enhanced)
export interface GitHubWebhookEvent {
  action: string;
  repository: GitHubRepository;
  sender: GitHubUser;
  installation?: GitHubInstallation; // Added for GitHub App events
}

export interface PullRequestEvent extends GitHubWebhookEvent {
  action: 'opened' | 'closed' | 'reopened' | 'synchronize' | 'ready_for_review' | 'converted_to_draft';
  pull_request: GitHubPullRequest;
}

export interface PushEvent extends GitHubWebhookEvent {
  action: 'push';
  ref: string;
  before: string;
  after: string;
  commits: GitHubCommit[];
  head_commit: GitHubCommit;
  pusher: {
    name: string;
    email: string;
  };
}

export interface WorkflowRunEvent extends GitHubWebhookEvent {
  action: 'requested' | 'in_progress' | 'completed';
  workflow_run: GitHubWorkflowRun;
}

export interface CheckRunEvent extends GitHubWebhookEvent {
  action: 'created' | 'completed' | 'rerequested' | 'requested_action';
  check_run: GitHubCheckRun;
}

// Database types (preserved from existing)
export interface GitHubEventLog {
  id: string;
  event_type: 'pull_request' | 'push' | 'workflow_run' | 'check_run';
  action: string;
  repository_id: number;
  repository_name: string;
  pr_number?: number;
  branch_name?: string;
  commit_sha?: string;
  workflow_name?: string;
  check_name?: string;
  status?: string;
  conclusion?: string;
  event_data: Record<string, any>;
  created_at: string;
}

// API Response types (preserved with enhancement)
export interface GitHubAPIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
}

export interface PRCreationResult {
  pr: GitHubPullRequest;
  branch: string;
  commits: string[];
}

// Work Order Integration (preserved from existing - core Mission Control feature)
export interface WorkOrderGitHubIntegration {
  work_order_id: string;
  branch_name?: string;
  pr_number?: number;
  pr_url?: string;
  commits: string[];
  status: 'branch_created' | 'files_committed' | 'pr_created' | 'pr_merged' | 'failed';
  github_events: GitHubEventLog[];
  created_at: string;
  updated_at: string;
}

// NEW ADDITIONS for Phase 2.1.2 Requirements

// GitHub App Support (needed for Phase 2.1.2)
export interface GitHubInstallation {
  id: number;
  account: GitHubUser;
  target_type: string;
  permissions: Record<string, string>;
}

// Labels for PR management
export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string;
}

// File operations (needed for contract validation)
export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  download_url: string;
  type: 'file' | 'dir';
  content?: string; // base64 encoded
  encoding?: string;
}

// API Request types for creating resources
export interface GitHubCreatePRRequest {
  title: string;
  body: string;
  head: string; // branch name
  base: string; // target branch
  draft?: boolean;
}

export interface GitHubCreateBranchRequest {
  ref: string; // refs/heads/branch-name
  sha: string; // commit SHA to branch from
}

export interface GitHubWriteFileRequest {
  message: string;
  content: string; // base64 encoded
  sha?: string; // required for updates
  branch?: string;
  committer?: {
    name: string;
    email: string;
  };
}

// Integration Status Monitoring (needed for Mission Control)
export interface GitHubIntegrationStatus {
  app_installed: boolean;
  webhook_configured: boolean;
  rate_limit_status: {
    limit: number;
    remaining: number;
    reset_at: string;
  };
  last_webhook_received?: string;
  repositories_accessible: number;
  permissions: string[];
}

// Contract Validation Types (Phase 2.1.2 specific)
export interface GitHubContractValidation {
  work_order_id: string;
  repository: string;
  files_analyzed: string[];
  breaking_changes_detected: boolean;
  validation_results: {
    file_path: string;
    change_type: 'addition' | 'modification' | 'deletion';
    risk_level: 'low' | 'medium' | 'high';
    breaking_change: boolean;
    reason?: string;
  }[];
  confidence_score: number;
  created_at: string;
}

// Unified webhook payload type for event processing
export type GitHubWebhookPayload = 
  | PullRequestEvent 
  | PushEvent 
  | WorkflowRunEvent 
  | CheckRunEvent 
  | (GitHubWebhookEvent & { zen?: string }); // For ping events

// Repository scanning results (for Phase 2.1.2)
export interface GitHubRepositoryScan {
  repository: string;
  scan_type: 'contract_validation' | 'dependency_check' | 'security_scan';
  files_scanned: number;
  issues_found: number;
  scan_results: Record<string, any>;
  created_at: string;
}