-- Seed System Config for Moose Mission Control
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/veofqiywppjsjqfqztft/sql

-- Budget Limits Configuration
INSERT INTO system_config (key, value, description)
VALUES (
  'budget_limits',
  '{"daily_soft_cap": 50, "daily_hard_cap": 100, "emergency_kill": 200, "monthly_target": 500, "monthly_hard_cap": 1000}',
  'Budget limits and thresholds for cost management'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Routing Configuration
INSERT INTO system_config (key, value, description)
VALUES (
  'routing_config',
  '{"enable_hard_stops": false, "enable_parallel_mode": false}',
  'Routing configuration for Manager service'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Verify insertion
SELECT key, value, description, updated_at
FROM system_config
ORDER BY key;
