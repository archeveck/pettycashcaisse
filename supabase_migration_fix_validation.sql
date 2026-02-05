-- Migration: Fix Validation Workflow - Add UPDATE policies for cash_requests
-- This allows controllers and CFOs to approve/reject requests

-- Controller can update requests (approve to pending_cfo or reject)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cash_requests' AND policyname = 'Controller can update requests'
  ) THEN
    CREATE POLICY "Controller can update requests" ON public.cash_requests FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'controller')
    );
  END IF;
END $$;

-- CFO can update requests (approve or reject)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cash_requests' AND policyname = 'CFO can update requests'
  ) THEN
    CREATE POLICY "CFO can update requests" ON public.cash_requests FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'cfo')
    );
  END IF;
END $$;

-- Cashier can update requests (mark as disbursed)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cash_requests' AND policyname = 'Cashier can update requests'
  ) THEN
    CREATE POLICY "Cashier can update requests" ON public.cash_requests FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'cashier')
    );
  END IF;
END $$;

-- Admin can update requests
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cash_requests' AND policyname = 'Admin can update requests'
  ) THEN
    CREATE POLICY "Admin can update requests" ON public.cash_requests FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- Cashier and Admin can insert transactions
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cash_transactions' AND policyname = 'Cashier can insert transactions'
  ) THEN
    CREATE POLICY "Cashier can insert transactions" ON public.cash_transactions FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('cashier', 'admin'))
    );
  END IF;
END $$;

-- Verify policies were created
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('cash_requests', 'cash_transactions')
  AND cmd = 'UPDATE' OR (tablename = 'cash_transactions' AND cmd = 'INSERT')
ORDER BY tablename, policyname;
