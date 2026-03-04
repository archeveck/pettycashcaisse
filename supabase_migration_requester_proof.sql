-- Migration: Add attachment support for cash requests
-- This script adds proof columns to cash_requests and updates RLS policies

-- 1. Add columns to cash_requests
ALTER TABLE public.cash_requests 
ADD COLUMN IF NOT EXISTS proof_document_url TEXT,
ADD COLUMN IF NOT EXISTS proof_submitted_at TIMESTAMPTZ;

-- 2. Update RLS policies for cash_requests to allow requesters to update their own requests (for attachments)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cash_requests' AND policyname = 'Requester can update own requests'
  ) THEN
    CREATE POLICY "Requester can update own requests" ON public.cash_requests 
    FOR UPDATE 
    USING (auth.uid() = requester_id)
    WITH CHECK (auth.uid() = requester_id);
  END IF;
END $$;

-- 3. Update storage policies for 'proof-documents' bucket
-- Allow requesters to upload documents
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Requesters can upload proof documents'
  ) THEN
    CREATE POLICY "Requesters can upload proof documents"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'proof-documents' AND
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'requester')
    );
  END IF;
END $$;

-- Allow requesters to update their own documents
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Requesters can update proof documents'
  ) THEN
    CREATE POLICY "Requesters can update proof documents"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'proof-documents' AND
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'requester')
    );
  END IF;
END $$;
