-- Migration: Deprecate Proposer-Related Tables
-- Created: 2025-10-30
-- Purpose: Mark proposer_* tables as deprecated following architectural change to direct Aider execution
--
-- Context: Session v148 proved that dual-inference architecture (Proposer + Aider) causes
--          1,300% error increase via code sanitizer. New architecture uses direct Aider execution
--          with compilation gate and Claude review escalation.
--
-- Impact: Tables remain in database for historical data analysis but are no longer written to
--         by the orchestrator service. Phase 3 will introduce claude_reviews table as replacement.
--
-- Affected tables:
--   - proposer_failures: No longer written (no Proposer refinement loop)
--   - proposer_attempts: No longer written (no Proposer attempts)
--   - proposer_success_metrics: No longer written (metrics now track Aider + compilation gate)
--   - proposer_configs: Still read for Aider model selection (maps proposer name → model)
--
-- Historical data: All existing records preserved for analysis and learning
--
-- Future cleanup: Consider dropping these tables after exporting historical data (post-Phase 3)

-- Add deprecation comment to each table
COMMENT ON TABLE proposer_failures IS
  '[DEPRECATED v149] Replaced by direct Aider architecture with compilation gate.
   Historical data preserved for analysis. See claude_reviews table (Phase 3) for new review system.';

COMMENT ON TABLE proposer_attempts IS
  '[DEPRECATED v149] Replaced by direct Aider architecture. No longer tracks Proposer attempts.
   Historical data preserved for analysis.';

COMMENT ON TABLE proposer_success_metrics IS
  '[DEPRECATED v149] Replaced by direct Aider metrics with compilation gate results.
   Historical data preserved for analysis.';

-- proposer_configs table still in use (maps proposer name → Aider model)
COMMENT ON TABLE proposer_configs IS
  'Active table: Maps proposer names to Aider model identifiers.
   Used by manager-coordinator for model selection in direct Aider execution.';

-- Create index for historical data queries (performance optimization)
CREATE INDEX IF NOT EXISTS idx_proposer_failures_created_at ON proposer_failures(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposer_attempts_created_at ON proposer_attempts(created_at DESC);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Proposer tables marked as deprecated (v149). Historical data preserved.';
  RAISE NOTICE 'New architecture: Direct Aider execution → Compilation gate → Claude review (Phase 3)';
END $$;
