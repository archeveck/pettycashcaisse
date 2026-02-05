-- Migration pour l'intégration Odoo
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS odoo_id integer UNIQUE;
ALTER TABLE public.analytical_accounts ADD COLUMN IF NOT EXISTS odoo_id integer UNIQUE;

-- Autoriser la lecture/écriture des paramètres Odoo pour l'admin
-- Les paramètres seront stockés dans app_settings avec les clés:
-- 'odoo_url', 'odoo_db', 'odoo_username', 'odoo_password'
