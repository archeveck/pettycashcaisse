-- Add change_amount column to cash_transactions
ALTER TABLE public.cash_transactions
ADD COLUMN change_amount DECIMAL(12, 2) DEFAULT 0;

-- Comment on column
COMMENT ON COLUMN public.cash_transactions.change_amount IS 'Amount of change returned by the requester for an outflow transaction';

-- Update RLS policies if necessary (usually ALTER TABLE doesn't break them if they use SELECT * or specific columns, but good to check)
-- Existing policies should still work as they likely cover the whole table.
