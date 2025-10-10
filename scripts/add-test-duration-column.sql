-- Add missing columns to outcome_vectors table
-- These columns support Phase 2B.2 failure classification

ALTER TABLE outcome_vectors
DROP COLUMN IF EXISTS failure_classes,
ADD COLUMN IF NOT EXISTS failure_class TEXT,
ADD COLUMN IF NOT EXISTS error_context JSONB,
ADD COLUMN IF NOT EXISTS test_duration_ms INTEGER;

COMMENT ON COLUMN outcome_vectors.failure_class IS 'Classified failure type (SYNTAX_ERROR, CONFIG_ISSUE, etc)';
COMMENT ON COLUMN outcome_vectors.error_context IS 'Structured error details for analysis';
COMMENT ON COLUMN outcome_vectors.test_duration_ms IS 'Duration in milliseconds of test execution';
