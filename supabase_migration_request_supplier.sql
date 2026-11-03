-- Ajoute le champ fournisseur (facultatif) aux demandes de caisse
alter table public.cash_requests add column if not exists supplier text;
