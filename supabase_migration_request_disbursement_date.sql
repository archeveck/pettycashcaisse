-- Ajoute la date de décaissement souhaitée (facultative) aux demandes de caisse
alter table public.cash_requests add column if not exists disbursement_date date;
