-- Migration: Add Settings Management and Proof Tracking Features
-- This script adds only the new RLS policies and storage configuration
-- Run this if you already have the base schema installed

-- ============================================
-- RLS POLICIES FOR SETTINGS MANAGEMENT
-- ============================================

-- Admin policies for managing projects
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'projects' AND policyname = 'Admin can insert projects'
  ) THEN
    CREATE POLICY "Admin can insert projects" ON public.projects FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'projects' AND policyname = 'Admin can update projects'
  ) THEN
    CREATE POLICY "Admin can update projects" ON public.projects FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'projects' AND policyname = 'Admin can delete projects'
  ) THEN
    CREATE POLICY "Admin can delete projects" ON public.projects FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- Admin policies for managing analytical accounts
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'analytical_accounts' AND policyname = 'Admin can insert analytical accounts'
  ) THEN
    CREATE POLICY "Admin can insert analytical accounts" ON public.analytical_accounts FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'analytical_accounts' AND policyname = 'Admin can update analytical accounts'
  ) THEN
    CREATE POLICY "Admin can update analytical accounts" ON public.analytical_accounts FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'analytical_accounts' AND policyname = 'Admin can delete analytical accounts'
  ) THEN
    CREATE POLICY "Admin can delete analytical accounts" ON public.analytical_accounts FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- Admin policies for app settings
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_settings' AND policyname = 'Admin can view app settings'
  ) THEN
    CREATE POLICY "Admin can view app settings" ON public.app_settings FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_settings' AND policyname = 'Admin can update app settings'
  ) THEN
    CREATE POLICY "Admin can update app settings" ON public.app_settings FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'app_settings' AND policyname = 'Admin can insert app settings'
  ) THEN
    CREATE POLICY "Admin can insert app settings" ON public.app_settings FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- Admin can update user roles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'Admin can update user roles'
  ) THEN
    CREATE POLICY "Admin can update user roles" ON public.profiles FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ============================================
-- STORAGE FOR PROOF DOCUMENTS
-- ============================================

-- Create storage bucket for proof documents (if not exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('proof-documents', 'proof-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can view proof documents'
  ) THEN
    CREATE POLICY "Authenticated users can view proof documents"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'proof-documents' AND auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Cashiers can upload proof documents'
  ) THEN
    CREATE POLICY "Cashiers can upload proof documents"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'proof-documents' AND
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('cashier', 'admin'))
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Cashiers can update proof documents'
  ) THEN
    CREATE POLICY "Cashiers can update proof documents"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'proof-documents' AND
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('cashier', 'admin'))
    );
  END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE tablename IN ('projects', 'analytical_accounts', 'app_settings', 'profiles', 'objects')
ORDER BY tablename, policyname;

-- Verify storage bucket
SELECT id, name, public FROM storage.buckets WHERE id = 'proof-documents';
