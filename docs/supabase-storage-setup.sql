-- Supabase Storage Setup for Wireframe Generation
-- Run these commands in Supabase SQL Editor
-- URL: https://qclxdnbvoruvqnhsshjr.supabase.co/project/_/sql

-- Step 1: Create storage bucket for moose artifacts
INSERT INTO storage.buckets (id, name, public)
VALUES ('moose-artifacts', 'moose-artifacts', true)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Allow authenticated uploads to moose-artifacts bucket
CREATE POLICY IF NOT EXISTS "Allow authenticated uploads to moose-artifacts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'moose-artifacts');

-- Step 3: Allow service role full access (for API operations)
CREATE POLICY IF NOT EXISTS "Allow service role all operations"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'moose-artifacts');

-- Step 4: Allow public reads (so wireframes can be viewed)
CREATE POLICY IF NOT EXISTS "Allow public reads from moose-artifacts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'moose-artifacts');

-- Step 5: Allow updates (for upsert operations)
CREATE POLICY IF NOT EXISTS "Allow authenticated updates to moose-artifacts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'moose-artifacts');

-- Verify the bucket was created
SELECT * FROM storage.buckets WHERE id = 'moose-artifacts';

-- View existing policies
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
