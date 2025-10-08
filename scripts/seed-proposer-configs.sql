-- Seed Proposer Configs for Moose Mission Control
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/veofqiywppjsjqfqztft/sql

-- Claude Sonnet 4.5 (Primary - High complexity tasks)
-- Note: model field uses Aider's model identifier
INSERT INTO proposer_configs (
  id,
  name,
  model,
  provider,
  complexity_threshold,
  cost_profile,
  active
) VALUES (
  'a40c5caf-b0fb-4a8b-a544-ca82bb2ab939'::uuid,
  'Claude Sonnet 4.5',
  'claude-sonnet-4-20250514',
  'anthropic',
  0.7,
  '{"input_cost_per_token": 0.000003, "output_cost_per_token": 0.000015, "currency": "USD"}'::jsonb,
  true
) ON CONFLICT (id) DO UPDATE SET
  model = EXCLUDED.model,
  complexity_threshold = EXCLUDED.complexity_threshold,
  cost_profile = EXCLUDED.cost_profile,
  active = EXCLUDED.active;

-- GPT-4o-mini (Secondary - Low/medium complexity, cost-effective)
INSERT INTO proposer_configs (
  id,
  name,
  model,
  provider,
  complexity_threshold,
  cost_profile,
  active
) VALUES (
  'b50d6dbf-c1fc-4b9c-b655-db93cc3bc940'::uuid,
  'GPT-4o-mini',
  'gpt-4o-mini',
  'openai',
  0.5,
  '{"input_cost_per_token": 0.00000015, "output_cost_per_token": 0.0000006, "currency": "USD"}'::jsonb,
  true
) ON CONFLICT (id) DO UPDATE SET
  model = EXCLUDED.model,
  complexity_threshold = EXCLUDED.complexity_threshold,
  cost_profile = EXCLUDED.cost_profile,
  active = EXCLUDED.active;

-- Verify insertion
SELECT id, name, model, provider, complexity_threshold, active
FROM proposer_configs
ORDER BY complexity_threshold DESC;
