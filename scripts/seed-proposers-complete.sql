-- Seed Proposer Configs (Complete with all required fields)
-- Run in Supabase SQL Editor

-- Claude Sonnet 4.5 (Primary - High complexity tasks)
INSERT INTO proposer_configs (
  id,
  name,
  provider,
  endpoint,
  context_limit,
  complexity_threshold,
  cost_profile,
  strengths,
  is_active
) VALUES (
  'a40c5caf-b0fb-4a8b-a544-ca82bb2ab939'::uuid,
  'claude-sonnet-4-20250514',
  'anthropic',
  'https://api.anthropic.com/v1/messages',
  200000,
  0.7,
  '{"input_cost_per_token": 0.000003, "output_cost_per_token": 0.000015, "currency": "USD"}'::jsonb,
  ARRAY['complex-logic', 'architecture', 'refactoring']::text[],
  true
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  provider = EXCLUDED.provider,
  endpoint = EXCLUDED.endpoint,
  context_limit = EXCLUDED.context_limit,
  complexity_threshold = EXCLUDED.complexity_threshold,
  cost_profile = EXCLUDED.cost_profile,
  strengths = EXCLUDED.strengths,
  is_active = EXCLUDED.is_active;

-- GPT-4o-mini (Secondary - Low/medium complexity, cost-effective)
INSERT INTO proposer_configs (
  id,
  name,
  provider,
  endpoint,
  context_limit,
  complexity_threshold,
  cost_profile,
  strengths,
  is_active
) VALUES (
  'b50d6dbf-c1fc-4b9c-b655-db93cc3bc940'::uuid,
  'gpt-4o-mini',
  'openai',
  'https://api.openai.com/v1/chat/completions',
  128000,
  0.5,
  '{"input_cost_per_token": 0.00000015, "output_cost_per_token": 0.0000006, "currency": "USD"}'::jsonb,
  ARRAY['simple-tasks', 'cost-effective', 'fast']::text[],
  true
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  provider = EXCLUDED.provider,
  endpoint = EXCLUDED.endpoint,
  context_limit = EXCLUDED.context_limit,
  complexity_threshold = EXCLUDED.complexity_threshold,
  cost_profile = EXCLUDED.cost_profile,
  strengths = EXCLUDED.strengths,
  is_active = EXCLUDED.is_active;

-- Verify insertion
SELECT id, name, provider, complexity_threshold, is_active
FROM proposer_configs
ORDER BY complexity_threshold DESC;
