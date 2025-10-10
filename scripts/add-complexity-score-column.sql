-- Add complexity_score column to work_orders table
-- This allows direct querying without JSONB extraction
-- Run in Supabase SQL Editor after current iteration completes

-- Add the column
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS complexity_score DECIMAL(5, 2);

-- Add index for filtering by complexity
CREATE INDEX IF NOT EXISTS idx_work_orders_complexity_score
ON work_orders(complexity_score)
WHERE complexity_score IS NOT NULL;

-- Add comment
COMMENT ON COLUMN work_orders.complexity_score IS
'Complexity score (0-1) from Manager routing decision. Also stored in metadata.routing_decision.routing_metadata.complexity_score for backwards compatibility.';

-- Backfill existing records (extract from metadata)
-- This will populate complexity_score for all existing work orders
UPDATE work_orders
SET complexity_score = CAST(
  metadata->'routing_decision'->'routing_metadata'->>'complexity_score' AS DECIMAL(5, 2)
)
WHERE metadata->'routing_decision'->'routing_metadata'->>'complexity_score' IS NOT NULL
AND complexity_score IS NULL;

-- Verify the migration
SELECT
  id,
  title,
  complexity_score,
  metadata->'routing_decision'->'routing_metadata'->>'complexity_score' as complexity_from_metadata
FROM work_orders
WHERE complexity_score IS NOT NULL
LIMIT 5;
