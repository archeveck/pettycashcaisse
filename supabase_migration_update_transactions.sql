-- Migration: Add UPDATE policy for cash_transactions
-- This allows cashiers and admins to update transactions (e.g., adding justification documents)

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cash_transactions' AND policyname = 'Cashier can update transactions'
  ) THEN
    CREATE POLICY "Cashier can update transactions" ON public.cash_transactions FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('cashier', 'admin'))
    );
  END IF;
END $$;
