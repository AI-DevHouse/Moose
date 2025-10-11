-- Production Database Schema for Moose Mission Control
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/veofqiywppjsjqfqztft/sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: work_orders
-- ============================================================================
CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  risk_level TEXT NOT NULL DEFAULT 'medium',
  proposer_id UUID,
  estimated_cost DECIMAL(10, 2) DEFAULT 0,
  actual_cost DECIMAL(10, 2),
  pattern_confidence DECIMAL(5, 2) DEFAULT 0.5,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  github_pr_number INTEGER,
  github_pr_url TEXT,
  github_branch TEXT,
  acceptance_criteria JSONB DEFAULT '[]'::jsonb,
  files_in_scope JSONB DEFAULT '[]'::jsonb,
  context_budget_estimate INTEGER DEFAULT 2000,
  decomposition_doc TEXT,
  architect_version TEXT DEFAULT 'v1',
  complexity_score DECIMAL(5, 2),
  project_id UUID
);

-- ============================================================================
-- TABLE: proposer_configs
-- ============================================================================
CREATE TABLE IF NOT EXISTS proposer_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  complexity_threshold DECIMAL(5, 2) NOT NULL DEFAULT 0.5,
  cost_profile JSONB NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: outcome_vectors
-- ============================================================================
CREATE TABLE IF NOT EXISTS outcome_vectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  cost DECIMAL(10, 4) NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  model_used TEXT NOT NULL,
  diff_size_lines INTEGER,
  failure_classes JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  route_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: escalations
-- ============================================================================
CREATE TABLE IF NOT EXISTS escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  context JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  resolution_type TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: cost_tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS cost_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_name TEXT NOT NULL,
  cost DECIMAL(10, 4) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: contracts
-- ============================================================================
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  version TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  specification JSONB NOT NULL,
  validation_rules JSONB NOT NULL,
  breaking_changes JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: decision_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS decision_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_type TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  input_context JSONB NOT NULL,
  decision_output JSONB NOT NULL,
  confidence DECIMAL(5, 2),
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: github_events
-- ============================================================================
CREATE TABLE IF NOT EXISTS github_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  workflow_name TEXT,
  status TEXT,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: pattern_confidence_scores
-- ============================================================================
CREATE TABLE IF NOT EXISTS pattern_confidence_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_type TEXT NOT NULL,
  pattern_signature TEXT NOT NULL,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  avg_cost DECIMAL(10, 4),
  avg_execution_time_ms INTEGER,
  confidence_score DECIMAL(5, 2),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pattern_type, pattern_signature)
);

-- ============================================================================
-- TABLE: playbook_memory
-- ============================================================================
CREATE TABLE IF NOT EXISTS playbook_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trigger_pattern TEXT NOT NULL,
  solution_type TEXT NOT NULL,
  solution_steps JSONB NOT NULL,
  success_rate DECIMAL(5, 2),
  usage_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: escalation_scripts
-- ============================================================================
CREATE TABLE IF NOT EXISTS escalation_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escalation_type TEXT NOT NULL,
  resolution_options JSONB NOT NULL,
  usage_patterns JSONB DEFAULT '{}'::jsonb,
  effectiveness_score DECIMAL(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: system_config
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: complexity_learning_samples
-- ============================================================================
CREATE TABLE IF NOT EXISTS complexity_learning_samples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,

  -- Inputs (what was predicted)
  predicted_complexity DECIMAL(5, 2) NOT NULL,
  complexity_factors JSONB NOT NULL,
  complexity_weights JSONB NOT NULL,
  selected_model TEXT NOT NULL,

  -- Outcomes (what actually happened) - Multi-dimensional
  code_writing_success BOOLEAN,
  code_writing_errors INTEGER,
  code_writing_failure_class TEXT,

  tests_success BOOLEAN,
  tests_passed INTEGER,
  tests_failed INTEGER,
  tests_execution_time_ms INTEGER,

  build_success BOOLEAN,
  build_time_ms INTEGER,
  build_error_count INTEGER,

  pr_merged BOOLEAN,
  pr_review_comments INTEGER,
  pr_merge_time_hours DECIMAL(10, 2),
  ci_checks_passed INTEGER,
  ci_checks_failed INTEGER,

  production_errors_24h INTEGER,

  -- Derived metrics
  overall_success BOOLEAN,
  success_dimensions JSONB,

  -- Learning metadata
  model_performance_score DECIMAL(5, 2),
  was_correctly_routed BOOLEAN,
  routing_error_magnitude DECIMAL(5, 2),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: complexity_weight_history
-- ============================================================================
CREATE TABLE IF NOT EXISTS complexity_weight_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Weights snapshot
  weights JSONB NOT NULL,

  -- Adjustment metadata
  adjustment_reason TEXT NOT NULL,
  triggered_by TEXT,

  -- Performance before adjustment
  performance_before JSONB,

  -- Expected impact
  expected_improvement TEXT,

  -- Actual impact (filled after next calibration)
  performance_after JSONB,
  actual_improvement DECIMAL(5, 2),

  approved_by TEXT,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: proposer_threshold_history
-- ============================================================================
CREATE TABLE IF NOT EXISTS proposer_threshold_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposer_id UUID NOT NULL REFERENCES proposer_configs(id) ON DELETE CASCADE,

  old_threshold DECIMAL(5, 2) NOT NULL,
  new_threshold DECIMAL(5, 2) NOT NULL,

  adjustment_reason TEXT NOT NULL,
  performance_metrics JSONB,

  approved_by TEXT,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_created_at ON work_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_work_orders_proposer_id ON work_orders(proposer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_complexity_score ON work_orders(complexity_score) WHERE complexity_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_orders_project_id ON work_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_outcome_vectors_work_order_id ON outcome_vectors(work_order_id);
CREATE INDEX IF NOT EXISTS idx_outcome_vectors_created_at ON outcome_vectors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);
CREATE INDEX IF NOT EXISTS idx_escalations_work_order_id ON escalations(work_order_id);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_created_at ON cost_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_github_events_work_order_id ON github_events(work_order_id);
CREATE INDEX IF NOT EXISTS idx_learning_samples_wo ON complexity_learning_samples(work_order_id);
CREATE INDEX IF NOT EXISTS idx_learning_samples_complexity ON complexity_learning_samples(predicted_complexity);
CREATE INDEX IF NOT EXISTS idx_learning_samples_model ON complexity_learning_samples(selected_model);
CREATE INDEX IF NOT EXISTS idx_learning_samples_routing ON complexity_learning_samples(was_correctly_routed);
CREATE INDEX IF NOT EXISTS idx_learning_samples_created_at ON complexity_learning_samples(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weight_history_applied ON complexity_weight_history(applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_threshold_history_proposer ON proposer_threshold_history(proposer_id);
CREATE INDEX IF NOT EXISTS idx_threshold_history_applied ON proposer_threshold_history(applied_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE work_orders IS 'Work orders decomposed by Architect agent';
COMMENT ON TABLE proposer_configs IS 'Configuration for LLM proposer agents';
COMMENT ON TABLE outcome_vectors IS 'Execution results for learning and pattern analysis';
COMMENT ON TABLE escalations IS 'Escalations to human operators via Client Manager';
COMMENT ON TABLE cost_tracking IS 'LLM API cost tracking for budget management';
COMMENT ON TABLE contracts IS 'API contracts for validation and breaking change detection';
COMMENT ON TABLE decision_logs IS 'Agent decision history for audit and learning';
COMMENT ON TABLE github_events IS 'GitHub webhook events for Sentinel quality gates';
COMMENT ON TABLE pattern_confidence_scores IS 'Pattern success tracking for routing confidence';
COMMENT ON TABLE playbook_memory IS 'Automated solution playbooks learned from escalations';
COMMENT ON TABLE escalation_scripts IS 'Client Manager resolution templates';
COMMENT ON TABLE system_config IS 'System-wide configuration (budget limits, thresholds)';
COMMENT ON TABLE complexity_learning_samples IS 'Multi-dimensional outcome tracking for complexity scoring calibration';
COMMENT ON TABLE complexity_weight_history IS 'History of complexity weight adjustments and their impacts';
COMMENT ON TABLE proposer_threshold_history IS 'History of proposer complexity threshold adjustments';

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Database schema created successfully!';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run create-budget-reservation-function.sql';
  RAISE NOTICE '2. Run create-performance-indexes.sql (optional, already included above)';
  RAISE NOTICE '3. Seed initial configuration data';
END $$;
