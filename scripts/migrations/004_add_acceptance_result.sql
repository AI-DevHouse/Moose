-- Migration 004: Add acceptance_result to work_orders
-- Ref: docs/Self_Reinforcement_Architecture.md §4.3

-- Add acceptance_result JSONB column to work_orders table
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS acceptance_result JSONB;

-- Create index for querying by acceptance score
CREATE INDEX IF NOT EXISTS idx_work_orders_acceptance_score
ON work_orders (((acceptance_result->>'acceptance_score')::numeric))
WHERE acceptance_result IS NOT NULL;

-- Create index for querying low-scoring work orders (needs review)
CREATE INDEX IF NOT EXISTS idx_work_orders_needs_review
ON work_orders (status, ((acceptance_result->>'acceptance_score')::numeric))
WHERE status = 'needs_review' AND acceptance_result IS NOT NULL;

-- Add comments
COMMENT ON COLUMN work_orders.acceptance_result IS 'Phase 4: Multi-dimensional quality score after PR creation. Structure: {dimension_scores: {architecture, readability, completeness, test_coverage, build_success}, acceptance_score: number, build_passed: bool, tests_passed: bool, lint_errors: number, todo_count: number, test_coverage_percent: number, timestamp: string}';

-- Verify the column was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'acceptance_result'
  ) THEN
    RAISE NOTICE '✅ Migration 004 complete: acceptance_result column added to work_orders';
  ELSE
    RAISE EXCEPTION '❌ Migration 004 failed: acceptance_result column not found';
  END IF;
END $$;
