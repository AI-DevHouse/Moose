-- Check if proposer configs exist
SELECT id, name, provider, is_active
FROM proposer_configs
WHERE is_active = true;
