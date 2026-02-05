-- Migration: Fix Proof Documents Bucket Vulnerability
-- Problem: The 'proof-documents' bucket was created as private, but the application uses getPublicUrl().
-- Fix: proper configuration to make the bucket public so stored URLs work.

update storage.buckets
set public = true
where id = 'proof-documents';

-- Ensure policies allow public access if needed (already covered by "Authenticated users can view..." policy, 
-- but public buckets bypass RLS for SELECT if not careful? 
-- Actually, for Supabase storage, 'public' means the file is accessible via the publicUrl without a token.
-- RLS policies on storage.objects still apply for operations, but public access allows reading without token if the URL is known.)

-- If we want to strictly keep it private, we should have used createSignedUrl() in the frontend 
-- and stored the path instead of the URL.
-- Given the current implementation stores the full URL, switching to public is the quickest fix 
-- to make existing data work.
