-- Set all budget limits to "unlimited" (very high values)
-- Run this in Supabase SQL Editor

-- 1. Update existing budget_limits to unlimited
UPDATE system_config
SET value = '{
  "daily_soft_cap": 999999,
  "daily_hard_cap": 999999,
  "emergency_kill": 999999,
  "monthly_target": 999999,
  "monthly_hard_cap": 999999
}'::text,
updated_at = NOW()
WHERE key = 'budget_limits';

-- 2. Insert budget_thresholds (used by client-manager-service)
INSERT INTO system_config (key, value, description, created_at, updated_at)
VALUES (
  'budget_thresholds',
  '{
    "soft_cap": 999999,
    "hard_cap": 999999,
    "emergency_kill": 999999
  }'::text,
  'Budget thresholds for Client Manager escalations - set to unlimited',
  NOW(),
  NOW()
)
ON CONFLICT (key)
DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- 3. Verify the changes
SELECT key, value, description, updated_at
FROM system_config
WHERE key IN ('budget_limits', 'budget_thresholds')
ORDER BY key;
