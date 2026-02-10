ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS odoo_id integer UNIQUE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE public.analytical_accounts ADD COLUMN IF NOT EXISTS odoo_id integer UNIQUE;
ALTER TABLE public.analytical_accounts ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- Table pour les comptes comptables
CREATE TABLE IF NOT EXISTS public.accounting_accounts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  active boolean DEFAULT true,
  odoo_id integer UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Autoriser la lecture/écriture des paramètres Odoo pour l'admin
-- Les paramètres seront stockés dans app_settings avec les clés:
-- 'odoo_url', 'odoo_db', 'odoo_username', 'odoo_password'
