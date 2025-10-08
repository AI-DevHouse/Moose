-- Fix Proposer Configs - Remove duplicates and update to Aider model identifiers
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/veofqiywppjsjqfqztft/sql

-- Delete the incorrect duplicate entries I just created
DELETE FROM proposer_configs
WHERE id IN (
  'a40c5caf-b0fb-4a8b-a544-ca82bb2ab939'::uuid,  -- Claude Sonnet 4.5 (wrong threshold 0.70)
  'b50d6dbf-c1fc-4b9c-b655-db93cc3bc940'::uuid   -- GPT-4o-mini (wrong threshold 0.50)
);

-- Update the CORRECT entries to use Aider model identifiers
-- Claude Sonnet 4.5: claude-sonnet-4-5-20250929 (API) → claude-sonnet-4-20250514 (Aider)
UPDATE proposer_configs
SET
  model = 'claude-sonnet-4-20250514',
  updated_at = NOW()
WHERE id = '4d602359-6efc-41f5-9fc2-4a5d6b50d208'::uuid;

-- GPT-4o-mini already has correct model identifier (gpt-4o-mini works for both)
-- No update needed for: 0a78af6a-bfce-4897-8565-0f8700fb06eb

-- Verify the final state
SELECT
  id,
  name,
  model,
  provider,
  complexity_threshold,
  active
FROM proposer_configs
WHERE active = true
ORDER BY complexity_threshold ASC;
