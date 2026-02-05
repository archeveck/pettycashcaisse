-- Migration: Add Server-Side Cash Out Limit Validation
-- This script creates triggers to validate cash request and transaction amounts against max_outflow_limit

-- ============================================
-- TRIGGER FUNCTION: Validate Cash Request Amount
-- ============================================

-- Drop existing triggers and functions if they exist (for idempotency)
DROP TRIGGER IF EXISTS check_cash_request_amount ON public.cash_requests;
DROP TRIGGER IF EXISTS check_cash_transaction_amount ON public.cash_transactions;
DROP FUNCTION IF EXISTS public.validate_cash_request_amount();
DROP FUNCTION IF EXISTS public.validate_cash_transaction_amount();

-- Create the validation function for cash requests
CREATE OR REPLACE FUNCTION public.validate_cash_request_amount()
RETURNS TRIGGER AS $$
DECLARE
  max_limit NUMERIC;
BEGIN
  -- Fetch the current max_outflow_limit from app_settings
  -- Use ->> to extract as text, then cast to numeric
  SELECT (value->>0)::NUMERIC INTO max_limit
  FROM public.app_settings
  WHERE key = 'max_outflow_limit';
  
  -- If setting doesn't exist, use a default high value to avoid blocking
  IF max_limit IS NULL THEN
    max_limit := 999999999;
  END IF;
  
  -- Validate the amount
  IF NEW.amount > max_limit THEN
    RAISE EXCEPTION 'Le montant de % FCFA dépasse la limite maximale autorisée de % FCFA', 
      NEW.amount, max_limit
    USING ERRCODE = 'check_violation',
          HINT = 'Veuillez réduire le montant de votre demande ou contactez un administrateur pour augmenter la limite.';
  END IF;
  
  -- If validation passes, allow the insert
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGER FUNCTION: Validate Cash Transaction Amount (Outflows Only)
-- ============================================

-- Create the validation function for cash transactions
CREATE OR REPLACE FUNCTION public.validate_cash_transaction_amount()
RETURNS TRIGGER AS $$
DECLARE
  max_limit NUMERIC;
BEGIN
  -- Only validate outflow transactions
  IF NEW.type = 'outflow' THEN
    -- Fetch the current max_outflow_limit from app_settings
    -- Use ->> to extract as text, then cast to numeric
    SELECT (value->>0)::NUMERIC INTO max_limit
    FROM public.app_settings
    WHERE key = 'max_outflow_limit';
    
    -- If setting doesn't exist, use a default high value to avoid blocking
    IF max_limit IS NULL THEN
      max_limit := 999999999;
    END IF;
    
    -- Validate the amount
    IF NEW.amount > max_limit THEN
      RAISE EXCEPTION 'Le montant de décaissement de % FCFA dépasse la limite maximale autorisée de % FCFA', 
        NEW.amount, max_limit
      USING ERRCODE = 'check_violation',
            HINT = 'Veuillez contacter un administrateur pour augmenter la limite de décaissement.';
    END IF;
  END IF;
  
  -- If validation passes (or it's an inflow), allow the insert
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS: Check Amounts Before Insert
-- ============================================

-- Trigger for cash_requests
CREATE TRIGGER check_cash_request_amount
  BEFORE INSERT ON public.cash_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cash_request_amount();

-- Trigger for cash_transactions (outflows only)
CREATE TRIGGER check_cash_transaction_amount
  BEFORE INSERT ON public.cash_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cash_transaction_amount();

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify the triggers were created
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name IN ('check_cash_request_amount', 'check_cash_transaction_amount')
ORDER BY event_object_table, trigger_name;

-- Display current max_outflow_limit for reference
SELECT key, value FROM public.app_settings WHERE key = 'max_outflow_limit';
