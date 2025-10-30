-- DB_CONTRACT.sql — Canonical Supabase Schema
-- Version: v138
-- Purpose: Stable reference for database structure
-- Load when: Editing queries, modifying DB logic, or verifying schema

-- ============================================================================
-- CORE ENTITIES
-- ============================================================================

-- Projects: Top-level organizational unit
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  repo_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'archived' | 'on_hold'
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work Orders: Atomic units of work
CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'in_progress' | 'completed' | 'failed' | 'blocked'
  risk_level TEXT NOT NULL DEFAULT 'medium', -- 'low' | 'medium' | 'high'

  -- Decomposition metadata
  decomposition_doc TEXT,
  technical_requirements JSONB,
  acceptance_criteria JSONB,
  files_in_scope JSONB,

  -- Execution metadata
  proposer_id TEXT,
  architect_version TEXT,
  complexity_score NUMERIC,
  pattern_confidence NUMERIC,
  context_budget_estimate INTEGER,

  -- Cost tracking
  estimated_cost NUMERIC,
  actual_cost NUMERIC,

  -- Results
  github_branch TEXT,
  github_pr_number INTEGER,
  github_pr_url TEXT,
  acceptance_result JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  metadata JSONB
);

-- Work Order Dependencies: Directed edges (blocking → dependent)
CREATE TABLE work_order_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocking_work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  dependent_work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'hard', -- 'hard' | 'soft'
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(blocking_work_order_id, dependent_work_order_id),
  CHECK(blocking_work_order_id != dependent_work_order_id)
);

-- ============================================================================
-- DECOMPOSITION & BOOTSTRAP
-- ============================================================================

-- Decomposition Metadata: Links decompositions to WOs
CREATE TABLE decomposition_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decomposition_id TEXT UNIQUE NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id),
  work_order_ids TEXT[] NOT NULL,

  -- Conflict resolution
  has_conflicts BOOLEAN NOT NULL DEFAULT false,
  conflict_report JSONB,
  conflicts_resolved_at TIMESTAMPTZ,
  resolved_by TEXT,

  -- Bootstrap tracking
  bootstrap_needed BOOLEAN NOT NULL DEFAULT false,
  bootstrap_executed BOOLEAN DEFAULT false,
  bootstrap_commit_hash TEXT,
  bootstrap_result JSONB,
  aggregated_requirements JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bootstrap Events: Audit log for bootstrap attempts
CREATE TABLE bootstrap_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  decomposition_id TEXT REFERENCES decomposition_metadata(decomposition_id),
  status TEXT NOT NULL, -- 'pending' | 'in_progress' | 'completed' | 'failed'

  requirements_summary JSONB,
  files_created TEXT[],
  branch_name TEXT,
  commit_hash TEXT,

  validation_errors TEXT[],
  error_message TEXT,
  execution_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Technical Requirements: Aggregated package/config needs
CREATE TABLE technical_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  decomposition_id TEXT REFERENCES decomposition_metadata(decomposition_id),

  requirement_type TEXT NOT NULL, -- 'package' | 'config' | 'infra'
  requirement_key TEXT NOT NULL,
  requirement_value JSONB NOT NULL,

  source_work_order_ids TEXT[],
  priority INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, decomposition_id, requirement_type, requirement_key)
);

-- ============================================================================
-- PROJECT MATURITY
-- ============================================================================

-- Project Maturity Level: Lifecycle stage tracking
CREATE TABLE project_maturity_level (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),

  current_level TEXT NOT NULL DEFAULT 'bootstrap', -- 'bootstrap' | 'mvp' | 'beta' | 'stable'

  criteria_met JSONB NOT NULL DEFAULT '{}',
  criteria_pending JSONB NOT NULL DEFAULT '{}',

  bootstrap_completed BOOLEAN DEFAULT false,
  mvp_features_completed INTEGER DEFAULT 0,
  mvp_features_total INTEGER DEFAULT 0,

  last_evaluated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id)
);

-- ============================================================================
-- EXECUTION & RESULTS
-- ============================================================================

-- Decision Logs: Manager routing decisions
CREATE TABLE decision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES work_orders(id),

  decision_type TEXT NOT NULL, -- 'routing' | 'escalation' | 'retry'
  agent_type TEXT NOT NULL, -- 'proposer_claude' | 'proposer_gpt' | 'manager'

  input_context JSONB NOT NULL,
  decision_output JSONB NOT NULL,

  confidence NUMERIC,
  execution_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Acceptance Results: 5-dimension quality scoring
CREATE TABLE acceptance_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id),

  -- 5 dimensions (0-100 each)
  unit_tests_score INTEGER NOT NULL,
  integration_tests_score INTEGER NOT NULL,
  type_safety_score INTEGER NOT NULL,
  linting_score INTEGER NOT NULL,
  edge_cases_score INTEGER NOT NULL,

  overall_score NUMERIC NOT NULL, -- Weighted average

  passed BOOLEAN NOT NULL, -- true if overall_score >= 70

  details JSONB, -- Detailed breakdown

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Escalations: Human-review queue
CREATE TABLE escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES work_orders(id),

  trigger_type TEXT NOT NULL, -- 'validation_failure' | 'execution_error' | 'low_acceptance'
  failure_class TEXT, -- 'transient' | 'deterministic' | 'configuration' | 'logic'

  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'in_review' | 'resolved' | 'dismissed'

  context JSONB NOT NULL,

  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_type TEXT, -- 'retry' | 'manual_fix' | 'requirement_clarification'
  resolution_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SUPPORTING TABLES
-- ============================================================================

-- Cost Tracking: API usage costs
CREATE TABLE cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL, -- 'anthropic' | 'openai' | 'github'
  cost NUMERIC NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contracts: API/schema contracts (future use)
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  contract_type TEXT NOT NULL, -- 'api' | 'schema' | 'interface'

  specification JSONB NOT NULL,
  validation_rules JSONB NOT NULL,
  breaking_changes JSONB,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Escalation Scripts: Resolution playbooks (future use)
CREATE TABLE escalation_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escalation_type TEXT NOT NULL,
  resolution_options JSONB NOT NULL,

  effectiveness_score NUMERIC,
  usage_patterns JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES (Key Performance Paths)
-- ============================================================================

CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_project_id ON work_orders(project_id);
CREATE INDEX idx_work_order_dependencies_blocking ON work_order_dependencies(blocking_work_order_id);
CREATE INDEX idx_work_order_dependencies_dependent ON work_order_dependencies(dependent_work_order_id);
CREATE INDEX idx_decomposition_metadata_project_id ON decomposition_metadata(project_id);
CREATE INDEX idx_bootstrap_events_project_id ON bootstrap_events(project_id);
CREATE INDEX idx_escalations_status ON escalations(status);

-- ============================================================================
-- Token count: ~900 tokens
-- ============================================================================
