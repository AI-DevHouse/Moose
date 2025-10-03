-- Performance Optimization Indexes
-- Created: 2025-10-03
-- Purpose: Improve query performance for frequently accessed endpoints

-- Index 1: work_orders status + created_at (for admin health dashboard stuck WOs)
CREATE INDEX IF NOT EXISTS idx_work_orders_status_created
  ON work_orders(status, created_at DESC);

-- Index 2: escalations status + created_at (for escalation list queries)
CREATE INDEX IF NOT EXISTS idx_escalations_status_created
  ON escalations(status, created_at DESC);

-- Index 3: outcome_vectors work_order_id + created_at (for WO history queries)
CREATE INDEX IF NOT EXISTS idx_outcome_vectors_wo_created
  ON outcome_vectors(work_order_id, created_at DESC);

-- Index 4: outcome_vectors success + created_at (for error rate calculation)
CREATE INDEX IF NOT EXISTS idx_outcome_vectors_success_created
  ON outcome_vectors(success, created_at DESC);

-- Index 5: work_orders status only (for count aggregations)
CREATE INDEX IF NOT EXISTS idx_work_orders_status
  ON work_orders(status);

-- Verify indexes were created
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('work_orders', 'escalations', 'outcome_vectors')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
