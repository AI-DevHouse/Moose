-- Migration: Add Projects Table and Link Work Orders
-- Date: 2025-10-08
-- Purpose: Enable project isolation to prevent Moose from modifying itself

-- ============================================================================
-- STEP 1: Create projects table
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- Filesystem
  local_path TEXT NOT NULL UNIQUE,

  -- Git/GitHub
  git_initialized BOOLEAN DEFAULT FALSE,
  default_branch TEXT DEFAULT 'main',
  github_repo_name TEXT,           -- e.g., "user/todo-app"
  github_repo_url TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'initialized',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN (
    'initialized',  -- Project created, directory exists
    'active',       -- Project is actively being developed
    'archived',     -- Project archived (soft delete)
    'failed'        -- Project creation/setup failed
  ))
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- ============================================================================
-- STEP 2: Add project_id to work_orders table
-- ============================================================================

-- Add column (nullable initially to support existing work orders)
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_work_orders_project_id ON work_orders(project_id);

-- ============================================================================
-- STEP 3: Create updated_at trigger for projects
-- ============================================================================

CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at_trigger
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();

-- ============================================================================
-- VERIFICATION QUERIES (run these to verify migration succeeded)
-- ============================================================================

-- Check projects table exists
-- SELECT EXISTS (
--   SELECT FROM information_schema.tables
--   WHERE table_name = 'projects'
-- );

-- Check project_id column exists on work_orders
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'work_orders' AND column_name = 'project_id';

-- Check indexes exist
-- SELECT indexname FROM pg_indexes WHERE tablename = 'projects';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'work_orders' AND indexname LIKE '%project%';
