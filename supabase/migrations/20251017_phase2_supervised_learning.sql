-- Phase 2: Supervised Improvement System - Database Schema
-- Creates tables for test iterations and moose improvements tracking
-- Reference: TECHNICAL_PLAN_Learning_System.md lines 1252-1344

-- ============================================================================
-- Table: test_iterations
-- Stores metrics for each iteration (learning data - never delete)
-- ============================================================================

CREATE TABLE IF NOT EXISTS test_iterations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  iteration_number INTEGER NOT NULL,
  project_name TEXT NOT NULL, -- "multi-llm-discussion" or test project name
  moose_version TEXT, -- Git commit hash of Moose at time of iteration

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),

  -- Execution Metrics
  total_work_orders INTEGER,
  work_orders_succeeded INTEGER,
  work_orders_failed INTEGER,
  total_execution_time_seconds INTEGER,
  total_cost_usd DECIMAL(10, 4),

  -- Quality Scores (1-10 scale)
  architecture_score INTEGER CHECK (architecture_score IS NULL OR (architecture_score BETWEEN 1 AND 10)),
  readability_score INTEGER CHECK (readability_score IS NULL OR (readability_score BETWEEN 1 AND 10)),
  completeness_score INTEGER CHECK (completeness_score IS NULL OR (completeness_score BETWEEN 1 AND 10)),
  test_coverage_score INTEGER CHECK (test_coverage_score IS NULL OR (test_coverage_score BETWEEN 1 AND 10)),
  user_experience_score INTEGER CHECK (user_experience_score IS NULL OR (user_experience_score BETWEEN 1 AND 10)),
  overall_score DECIMAL(3, 1), -- Weighted average (e.g., 7.8)

  -- Build/Test Results
  builds_successfully BOOLEAN,
  tests_pass BOOLEAN,
  lint_errors INTEGER,

  -- Isolation Verification (CRITICAL - ensures Moose doesn't modify itself)
  moose_files_modified BOOLEAN, -- Should always be FALSE
  isolation_verified BOOLEAN,

  -- Detailed Analysis (JSON)
  scoring_details JSONB, -- Full rubric evaluation with evidence
  analysis_summary JSONB, -- Root cause analysis: what went wrong and why

  -- Failure Breakdown (uses Phase 1 classification)
  failures_by_class JSONB, -- { compile_error: 2, contract_violation: 1, ... }

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_test_iterations_number ON test_iterations(iteration_number);
CREATE INDEX IF NOT EXISTS idx_test_iterations_score ON test_iterations(overall_score);
CREATE INDEX IF NOT EXISTS idx_test_iterations_status ON test_iterations(status);
CREATE INDEX IF NOT EXISTS idx_test_iterations_project ON test_iterations(project_name);

COMMENT ON TABLE test_iterations IS 'Tracks each supervised learning iteration with quality scores and failure metrics';
COMMENT ON COLUMN test_iterations.moose_version IS 'Git commit hash to track which version of Moose was used';
COMMENT ON COLUMN test_iterations.overall_score IS 'Weighted average of all quality dimensions (1-10 scale)';
COMMENT ON COLUMN test_iterations.isolation_verified IS 'Critical safety check: Moose must not modify its own files during execution';

-- ============================================================================
-- Table: moose_improvements
-- Tracks changes made to Moose between iterations
-- ============================================================================

CREATE TABLE IF NOT EXISTS moose_improvements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_iteration_id UUID REFERENCES test_iterations(id) ON DELETE SET NULL,
  to_iteration_id UUID REFERENCES test_iterations(id) ON DELETE SET NULL,

  improvement_type TEXT CHECK (improvement_type IN (
    'bug_fix',
    'prompt_enhancement',
    'architecture_change',
    'config_change',
    'contract_addition',
    'dependency_fix'
  )),

  description TEXT NOT NULL,
  files_changed TEXT[],
  git_commit_hash TEXT,

  -- Impact tracking
  expected_impact TEXT, -- "Reduce contract_violation failures by 50%"
  actual_impact TEXT,   -- Filled after next iteration completes

  -- Approval tracking
  proposed_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT, -- 'human' or 'autonomous' (for future fully-automated mode)

  proposal_details JSONB, -- Full proposal from Claude: rationale, testing plan, rollback plan

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_moose_improvements_from ON moose_improvements(from_iteration_id);
CREATE INDEX IF NOT EXISTS idx_moose_improvements_to ON moose_improvements(to_iteration_id);
CREATE INDEX IF NOT EXISTS idx_moose_improvements_type ON moose_improvements(improvement_type);
CREATE INDEX IF NOT EXISTS idx_moose_improvements_approved ON moose_improvements(approved_at);

COMMENT ON TABLE moose_improvements IS 'Tracks proposed and approved changes to Moose codebase with impact measurement';
COMMENT ON COLUMN moose_improvements.expected_impact IS 'Prediction of how this change will improve Moose';
COMMENT ON COLUMN moose_improvements.actual_impact IS 'Measured improvement after next iteration (compares scores)';
COMMENT ON COLUMN moose_improvements.proposal_details IS 'Full JSON proposal including code changes, rationale, testing plan, rollback plan';

-- ============================================================================
-- Helper Views
-- ============================================================================

-- View: iteration_progress
-- Shows improvement trend over time
CREATE OR REPLACE VIEW iteration_progress AS
SELECT
  iteration_number,
  project_name,
  overall_score,
  work_orders_succeeded,
  work_orders_failed,
  total_cost_usd,
  builds_successfully,
  tests_pass,
  isolation_verified,
  status,
  completed_at
FROM test_iterations
WHERE status = 'completed'
ORDER BY iteration_number;

COMMENT ON VIEW iteration_progress IS 'Shows quality improvement trend across iterations';

-- View: improvement_impact_report
-- Shows which improvements actually worked
CREATE OR REPLACE VIEW improvement_impact_report AS
SELECT
  mi.improvement_type,
  mi.description,
  mi.expected_impact,
  mi.actual_impact,
  mi.approved_by,
  ti_from.overall_score AS score_before,
  ti_to.overall_score AS score_after,
  (ti_to.overall_score - ti_from.overall_score) AS score_delta,
  mi.approved_at
FROM moose_improvements mi
LEFT JOIN test_iterations ti_from ON mi.from_iteration_id = ti_from.id
LEFT JOIN test_iterations ti_to ON mi.to_iteration_id = ti_to.id
WHERE mi.approved_at IS NOT NULL
ORDER BY mi.approved_at DESC;

COMMENT ON VIEW improvement_impact_report IS 'Measures actual impact of each approved improvement on quality scores';

-- ============================================================================
-- RLS Policies (Row Level Security)
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE test_iterations ENABLE ROW LEVEL SECURITY;
ALTER TABLE moose_improvements ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all iteration data
CREATE POLICY "Allow authenticated read access on test_iterations"
  ON test_iterations FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to write (used by scripts)
CREATE POLICY "Allow service role full access on test_iterations"
  ON test_iterations
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read all improvement data
CREATE POLICY "Allow authenticated read access on moose_improvements"
  ON moose_improvements FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to write (used by scripts)
CREATE POLICY "Allow service role full access on moose_improvements"
  ON moose_improvements
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Sample Query Examples (for documentation)
-- ============================================================================

-- Example 1: Get latest iteration status
-- SELECT * FROM test_iterations ORDER BY iteration_number DESC LIMIT 1;

-- Example 2: Calculate improvement over last 5 iterations
-- SELECT
--   AVG(overall_score) as avg_score,
--   MAX(overall_score) as best_score,
--   MIN(overall_score) as worst_score
-- FROM test_iterations
-- WHERE status = 'completed'
-- ORDER BY iteration_number DESC
-- LIMIT 5;

-- Example 3: Find which improvement types work best
-- SELECT
--   improvement_type,
--   AVG(score_delta) as avg_impact,
--   COUNT(*) as total_improvements
-- FROM improvement_impact_report
-- WHERE score_delta > 0
-- GROUP BY improvement_type
-- ORDER BY avg_impact DESC;

-- Example 4: Get failure breakdown for latest iteration
-- SELECT
--   iteration_number,
--   failures_by_class,
--   overall_score
-- FROM test_iterations
-- WHERE status = 'completed'
-- ORDER BY iteration_number DESC
-- LIMIT 1;
