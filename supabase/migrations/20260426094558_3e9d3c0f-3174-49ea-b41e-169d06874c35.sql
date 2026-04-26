
-- Replace the broad "public read all" policy with a more specific one
DROP POLICY IF EXISTS "Company logos are publicly readable" ON storage.objects;

-- Make the bucket non-public so listing is blocked, but logos are still served via signed URLs / direct id access for owners
UPDATE storage.buckets SET public = false WHERE id = 'company-logos';

-- Owners can read their own logos
CREATE POLICY "Users read own logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
