-- ============================================================
-- Supabase Storage Bucket for Trip Places & Itinerary Photos
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- 1. Create the 'trip-places' bucket (if not already existing)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-places',
  'trip-places',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Clean up any existing policies on 'trip-places' to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access to trip-places" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload to trip-places" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update trip-places" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete trip-places" ON storage.objects;
DROP POLICY IF EXISTS "Allow anon upload to trip-places" ON storage.objects;

-- 3. Policy: Public Read Access (Anyone can view place & itinerary photos)
CREATE POLICY "Allow public read access to trip-places"
ON storage.objects FOR SELECT
USING (bucket_id = 'trip-places');

-- 4. Policy: Upload / Insert (Authenticated & anon users can upload photos)
CREATE POLICY "Allow authenticated users to upload to trip-places"
ON storage.objects FOR INSERT
TO authenticated, anon
WITH CHECK (bucket_id = 'trip-places');

-- 5. Policy: Update (Allow updating photos in trip-places)
CREATE POLICY "Allow authenticated users to update trip-places"
ON storage.objects FOR UPDATE
TO authenticated, anon
USING (bucket_id = 'trip-places');

-- 6. Policy: Delete (Allow deleting photos in trip-places)
CREATE POLICY "Allow authenticated users to delete trip-places"
ON storage.objects FOR DELETE
TO authenticated, anon
USING (bucket_id = 'trip-places');
