-- Migration 002: Add Project Infrastructure Fields
-- Adds fields to support separate GitHub/Supabase/Vercel environments per project

-- Add new columns to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS github_org TEXT,
ADD COLUMN IF NOT EXISTS supabase_project_url TEXT,
ADD COLUMN IF NOT EXISTS supabase_anon_key TEXT,
ADD COLUMN IF NOT EXISTS vercel_team_id TEXT,
ADD COLUMN IF NOT EXISTS infrastructure_status TEXT DEFAULT 'pending' CHECK (infrastructure_status IN ('pending', 'partial', 'complete')),
ADD COLUMN IF NOT EXISTS setup_notes JSONB DEFAULT '{}'::jsonb;

-- Add comment explaining the fields
COMMENT ON COLUMN projects.github_org IS 'GitHub organization or username where app repos are created';
COMMENT ON COLUMN projects.supabase_project_url IS 'Dedicated Supabase project URL for this app';
COMMENT ON COLUMN projects.supabase_anon_key IS 'Supabase anonymous key for this app';
COMMENT ON COLUMN projects.vercel_team_id IS 'Vercel team ID for deployment';
COMMENT ON COLUMN projects.infrastructure_status IS 'Status of infrastructure setup: pending, partial, or complete';
COMMENT ON COLUMN projects.setup_notes IS 'JSON object containing setup checklist and notes';

-- Update existing projects to have pending status
UPDATE projects
SET infrastructure_status = 'pending'
WHERE infrastructure_status IS NULL;
