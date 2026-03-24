-- supabase_migration_change_to_inflow.sql
-- Migration: Retroactively create inflow transactions for past returns.

DO $$
DECLARE
  tx RECORD;
BEGIN
  FOR tx IN 
    SELECT * FROM public.cash_transactions 
    WHERE change_amount > 0 AND type = 'outflow'
  LOOP
    -- Vérifier si l'inflow n'a pas déjà été créé (protection idempotente basée sur la description ou request_id)
    IF NOT EXISTS (
      SELECT 1 FROM public.cash_transactions 
      WHERE type = 'inflow' 
        AND amount = tx.change_amount 
        AND description = 'Retour monnaie sur: ' || tx.description
        AND (request_id = tx.request_id OR (request_id IS NULL AND tx.request_id IS NULL))
    ) THEN
      -- Create the corresponding inflow line
      INSERT INTO public.cash_transactions (
        type,
        amount,
        description,
        created_by,
        analytical_account_id,
        request_id,
        accounting_account_id,
        date
      ) VALUES (
        'inflow',
        tx.change_amount,
        'Retour monnaie sur: ' || tx.description,
        tx.created_by,
        tx.analytical_account_id,
        tx.request_id,
        tx.accounting_account_id,
        tx.date
      );
    END IF;
  END LOOP;
END $$;
