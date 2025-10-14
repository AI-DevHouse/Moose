-- Migration 003: Proposer Learning System Infrastructure
-- Creates 6 tables to support meta-AI learning loop and prompt enhancement
-- Ref: docs/Discussion - Proposer_Code_Improvement(2).txt

-- ============================================================================
-- TABLE 1: proposer_failures
-- Purpose: Log residual errors after refinement for analysis
-- Sampling: 100% failures, 10% successes
-- ============================================================================
CREATE TABLE IF NOT EXISTS proposer_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Work order context
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  proposer_name TEXT NOT NULL,

  -- Complexity context
  complexity_score DECIMAL(4,3),
  complexity_band TEXT, -- e.g., "0.3-0.4", "0.4-0.5"

  -- Refinement metadata
  initial_errors INTEGER NOT NULL DEFAULT 0,
  final_errors INTEGER NOT NULL DEFAULT 0,
  refinement_count INTEGER NOT NULL DEFAULT 0,
  refinement_success BOOLEAN NOT NULL DEFAULT FALSE,

  -- Error details
  error_codes TEXT[], -- Array of TS error codes like ["TS1443", "TS2304"]
  error_samples JSONB, -- First 5 error messages with line numbers

  -- Sanitizer telemetry
  sanitizer_changes TEXT[], -- What the sanitizer auto-fixed
  sanitizer_functions_triggered INTEGER DEFAULT 0,

  -- Success/failure classification
  is_success BOOLEAN NOT NULL DEFAULT FALSE, -- For 10% success sampling
  failure_category TEXT, -- NULL for successes, category for failures

  -- Indexes for learning queries
  CONSTRAINT valid_complexity_score CHECK (complexity_score BETWEEN 0 AND 1)
);

CREATE INDEX idx_proposer_failures_proposer ON proposer_failures(proposer_name);
CREATE INDEX idx_proposer_failures_complexity_band ON proposer_failures(complexity_band);
CREATE INDEX idx_proposer_failures_error_codes ON proposer_failures USING GIN(error_codes);
CREATE INDEX idx_proposer_failures_created_at ON proposer_failures(created_at DESC);
CREATE INDEX idx_proposer_failures_final_errors ON proposer_failures(final_errors) WHERE final_errors > 0;

COMMENT ON TABLE proposer_failures IS 'Logs proposer refinement outcomes for learning loop analysis';
COMMENT ON COLUMN proposer_failures.error_samples IS 'JSON array of first 5 errors: [{code, message, line, column}]';
COMMENT ON COLUMN proposer_failures.sanitizer_changes IS 'Array of descriptions from code-sanitizer.ts fixes';
COMMENT ON COLUMN proposer_failures.is_success IS 'TRUE for 10% sampled successes, FALSE for all failures';

-- ============================================================================
-- TABLE 2: prompt_enhancements
-- Purpose: Store error-specific prompt improvements
-- Updated by: Meta-AI learning loop (Component 10)
-- ============================================================================
CREATE TABLE IF NOT EXISTS prompt_enhancements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Error pattern this enhancement addresses
  error_code TEXT NOT NULL, -- e.g., "TS1443", "TS2304"
  error_pattern TEXT, -- Optional regex pattern for message matching

  -- Enhancement content
  enhancement_text TEXT NOT NULL, -- Prompt text to inject
  enhancement_version INTEGER NOT NULL DEFAULT 1,

  -- Effectiveness tracking
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  applications_count INTEGER NOT NULL DEFAULT 0, -- How many times used
  success_count INTEGER NOT NULL DEFAULT 0, -- Successes when applied
  failure_count INTEGER NOT NULL DEFAULT 0, -- Failures when applied
  reduction_rate DECIMAL(4,3), -- Error reduction rate (0-1)

  -- Meta-AI improvement tracking
  parent_enhancement_id UUID REFERENCES prompt_enhancements(id), -- If rewritten by AI
  improvement_reason TEXT, -- Why this enhancement was created/improved
  last_effectiveness_check TIMESTAMPTZ,

  -- Targeting (optional filters)
  target_proposer_names TEXT[], -- If NULL, applies to all proposers
  target_complexity_min DECIMAL(4,3),
  target_complexity_max DECIMAL(4,3),

  CONSTRAINT valid_reduction_rate CHECK (reduction_rate IS NULL OR (reduction_rate >= 0 AND reduction_rate <= 1))
);

CREATE INDEX idx_prompt_enhancements_error_code ON prompt_enhancements(error_code) WHERE is_active = TRUE;
CREATE INDEX idx_prompt_enhancements_active ON prompt_enhancements(is_active, created_at DESC);
CREATE INDEX idx_prompt_enhancements_effectiveness ON prompt_enhancements(reduction_rate DESC NULLS LAST) WHERE is_active = TRUE;

COMMENT ON TABLE prompt_enhancements IS 'Error-specific prompt improvements, managed by meta-AI learning loop';
COMMENT ON COLUMN prompt_enhancements.enhancement_text IS 'Prompt text injected into proposer requests when error_code is common';
COMMENT ON COLUMN prompt_enhancements.reduction_rate IS 'Measured effectiveness: (errors_without - errors_with) / errors_without';
COMMENT ON COLUMN prompt_enhancements.parent_enhancement_id IS 'If this is a rewrite by Claude Sonnet 4.5, points to original';

-- ============================================================================
-- TABLE 3: proposer_success_metrics
-- Purpose: Track proposer performance by complexity band
-- Aggregated from: proposer_failures table
-- ============================================================================
CREATE TABLE IF NOT EXISTS proposer_success_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Proposer and complexity context
  proposer_name TEXT NOT NULL,
  complexity_band TEXT NOT NULL, -- e.g., "0.3-0.4"

  -- Time window (for rolling metrics)
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,

  -- Performance metrics
  total_attempts INTEGER NOT NULL DEFAULT 0,
  successful_attempts INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  success_rate DECIMAL(4,3), -- successful / total

  -- Error statistics
  avg_initial_errors DECIMAL(6,2),
  avg_final_errors DECIMAL(6,2),
  avg_improvement_rate DECIMAL(4,3), -- (initial - final) / initial

  -- Refinement statistics
  avg_refinement_cycles DECIMAL(4,2),
  zero_refinement_success_rate DECIMAL(4,3), -- % that passed without refinement

  -- Most common errors
  top_error_codes JSONB, -- [{code: "TS1443", count: 15, rate: 0.45}, ...]

  CONSTRAINT unique_proposer_band_window UNIQUE(proposer_name, complexity_band, window_start),
  CONSTRAINT valid_success_rate CHECK (success_rate IS NULL OR (success_rate >= 0 AND success_rate <= 1))
);

CREATE INDEX idx_proposer_metrics_proposer ON proposer_success_metrics(proposer_name);
CREATE INDEX idx_proposer_metrics_band ON proposer_success_metrics(complexity_band);
CREATE INDEX idx_proposer_metrics_success_rate ON proposer_success_metrics(success_rate DESC NULLS LAST);
CREATE INDEX idx_proposer_metrics_window ON proposer_success_metrics(window_end DESC);

COMMENT ON TABLE proposer_success_metrics IS 'Aggregated performance metrics by proposer and complexity band';
COMMENT ON COLUMN proposer_success_metrics.top_error_codes IS 'Top 10 error codes with counts: [{code, count, rate}]';

-- ============================================================================
-- TABLE 4: proposer_attempts
-- Purpose: Rolling window of recent attempts (50 per complexity band)
-- Component: #6 from doc (prevents early bad performance from hurting metrics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS proposer_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Context
  proposer_name TEXT NOT NULL,
  complexity_band TEXT NOT NULL,
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,

  -- Outcome
  was_success BOOLEAN NOT NULL,
  final_errors INTEGER NOT NULL DEFAULT 0,
  refinement_count INTEGER NOT NULL DEFAULT 0,

  -- For rolling window cleanup (keep only latest 50 per band)
  sequence_num BIGSERIAL,

  CONSTRAINT idx_unique_attempt UNIQUE(proposer_name, complexity_band, sequence_num)
);

CREATE INDEX idx_proposer_attempts_rolling ON proposer_attempts(proposer_name, complexity_band, sequence_num DESC);
CREATE INDEX idx_proposer_attempts_cleanup ON proposer_attempts(created_at DESC);

COMMENT ON TABLE proposer_attempts IS 'Rolling window (50 records per complexity band) for recent performance tracking';
COMMENT ON COLUMN proposer_attempts.sequence_num IS 'Auto-incrementing sequence for rolling window cleanup';

-- ============================================================================
-- TABLE 5: prompt_versions
-- Purpose: Versioned prompt registry (Component 7)
-- Allows: A/B testing and rollback of system prompts
-- ============================================================================
CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Version identification
  prompt_type TEXT NOT NULL, -- e.g., "base_proposer", "refinement_cycle_1"
  version_number INTEGER NOT NULL,
  version_tag TEXT, -- e.g., "v2.1-improved-imports"

  -- Content
  prompt_template TEXT NOT NULL,
  template_variables JSONB, -- Variables available in template: {task, errors, cycle}

  -- Lifecycle
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,

  -- Tracking
  author TEXT, -- "system" or "meta-ai-loop"
  change_notes TEXT,
  parent_version_id UUID REFERENCES prompt_versions(id),

  -- Performance (updated after usage)
  usage_count INTEGER NOT NULL DEFAULT 0,
  avg_success_rate DECIMAL(4,3),

  CONSTRAINT unique_prompt_version UNIQUE(prompt_type, version_number)
);

CREATE INDEX idx_prompt_versions_type_active ON prompt_versions(prompt_type, is_active);
CREATE INDEX idx_prompt_versions_performance ON prompt_versions(avg_success_rate DESC NULLS LAST);

COMMENT ON TABLE prompt_versions IS 'Versioned registry of system prompts for A/B testing and rollback';
COMMENT ON COLUMN prompt_versions.prompt_template IS 'Template with {{variable}} placeholders';
COMMENT ON COLUMN prompt_versions.is_active IS 'Only one version per prompt_type should be active';

-- ============================================================================
-- TABLE 6: threshold_experiments
-- Purpose: A/B testing for complexity threshold increases (Component 8)
-- Auto-managed by: adaptive-threshold-experiments.ts (Phase 4)
-- ============================================================================
CREATE TABLE IF NOT EXISTS threshold_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Experiment context
  proposer_name TEXT NOT NULL,
  current_threshold DECIMAL(4,3) NOT NULL,
  experimental_threshold DECIMAL(4,3) NOT NULL,
  complexity_band TEXT NOT NULL, -- Range being tested

  -- Experiment state
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'promoted', 'rejected', 'paused')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Results tracking (30 attempts minimum)
  attempts_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_rate DECIMAL(4,3),

  -- Promotion criteria
  target_success_rate DECIMAL(4,3) NOT NULL DEFAULT 0.70, -- 70% to promote
  min_attempts INTEGER NOT NULL DEFAULT 30,

  -- Metadata
  experiment_notes TEXT,
  promotion_reason TEXT,

  CONSTRAINT valid_thresholds CHECK (experimental_threshold > current_threshold),
  CONSTRAINT valid_experiment_success_rate CHECK (success_rate IS NULL OR (success_rate >= 0 AND success_rate <= 1))
);

CREATE INDEX idx_threshold_experiments_proposer ON threshold_experiments(proposer_name, status);
CREATE INDEX idx_threshold_experiments_running ON threshold_experiments(status, created_at DESC) WHERE status = 'running';

COMMENT ON TABLE threshold_experiments IS 'Automatic A/B testing for complexity threshold increases';
COMMENT ON COLUMN threshold_experiments.status IS 'running: collecting data, promoted: threshold increased, rejected: kept old threshold';
COMMENT ON COLUMN threshold_experiments.success_rate IS 'Auto-calculated: success_count / attempts_count';

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_prompt_enhancements_updated_at
  BEFORE UPDATE ON prompt_enhancements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proposer_success_metrics_updated_at
  BEFORE UPDATE ON proposer_success_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_threshold_experiments_updated_at
  BEFORE UPDATE ON threshold_experiments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA: Seed with known error patterns (optional)
-- ============================================================================

-- Add initial enhancement for TS1443 (smart quotes issue - now handled by sanitizer)
INSERT INTO prompt_enhancements (error_code, enhancement_text, improvement_reason, is_active)
VALUES (
  'TS1443',
  'CRITICAL: Always use plain ASCII quotes (" and '') in TypeScript code. Never use curly quotes (" " '' '') or backticks (`) except for template literals.',
  'Initial rule based on historical TS1443 errors (now mostly handled by code-sanitizer.ts)',
  TRUE
) ON CONFLICT DO NOTHING;

-- Add initial enhancement for TS2304 (undefined variable)
INSERT INTO prompt_enhancements (error_code, enhancement_text, improvement_reason, is_active)
VALUES (
  'TS2304',
  'IMPORTANT: Before using any variable, type, or import:
1. Check if it needs to be imported (React, types, utilities)
2. Verify the import path is correct
3. Ensure all type definitions are declared before use',
  'Common pattern for undefined variable errors',
  TRUE
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- MAINTENANCE NOTES
-- ============================================================================

COMMENT ON SCHEMA public IS 'Proposer Learning System - Migration 003
Created: 2025-10-14
Purpose: Enable meta-AI learning loop for automatic prompt improvement
Components: Failure logging, prompt enhancement, metrics, experiments
Maintenance:
  - proposer_attempts: Auto-cleanup keeps 50 records per band (TODO: add cleanup function)
  - proposer_failures: Consider partitioning by created_at after 100K records
  - threshold_experiments: Archive completed experiments after 90 days
';
