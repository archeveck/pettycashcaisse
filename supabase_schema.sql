-- Enable Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto" with schema extensions;

-- 1. PROFILES (Extends auth.users)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'controller', 'cfo', 'cashier', 'requester', 'accountant');
EXCEPTION
    WHEN duplicate_object THEN 
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'accountant';
END $$;

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  role user_role default 'requester',
  avatar_url text,
  updated_at timestamptz
);

-- 2. PROJECTS
create table if not exists public.projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  code text not null unique,
  description text,
  active boolean default true,
  odoo_id integer unique,
  created_at timestamptz default now()
);

-- 3. ANALYTICAL ACCOUNTS
create table if not exists public.analytical_accounts (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null,
  code text not null,
  created_at timestamptz default now(),
  active boolean default true,
  odoo_id integer unique,
  unique(project_id, code)
);

-- 4. ACCOUNTING ACCOUNTS (Standard Odoo account.account)
create table if not exists public.accounting_accounts (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  code text not null unique,
  active boolean default true,
  odoo_id integer unique,
  created_at timestamptz default now()
);

-- 4. CASH REQUESTS
DO $$ BEGIN
    CREATE TYPE request_status AS ENUM ('pending_controller', 'pending_cfo', 'approved', 'rejected', 'disbursed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

create table if not exists public.cash_requests (
  id uuid default uuid_generate_v4() primary key,
  requester_id uuid references public.profiles(id) not null,
  amount numeric not null check (amount > 0),
  description text not null,
  analytical_account_id uuid references public.analytical_accounts(id) not null,
  status request_status default 'pending_controller',
  
  controller_approval_at timestamptz,
  cfo_approval_at timestamptz,
  rejection_reason text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. CASH TRANSACTIONS
DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('inflow', 'outflow');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

create table if not exists public.cash_transactions (
  id uuid default uuid_generate_v4() primary key,
  type transaction_type not null,
  amount numeric not null check (amount > 0),
  description text not null,
  date timestamptz default now(),
  
  created_by uuid references public.profiles(id) not null,
  analytical_account_id uuid references public.analytical_accounts(id), -- Nullable for inflows
  request_id uuid references public.cash_requests(id), -- Nullable for inflows or direct outflows (if allowed)
  accounting_account_id uuid references public.accounting_accounts(id),
  
  proof_document_url text,
  proof_submitted_at timestamptz,
  is_validated boolean default false,
  
  created_at timestamptz default now()
);

-- 6. DAILY CLOSURES
DO $$ BEGIN
    CREATE TYPE closure_status AS ENUM ('open', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

create table if not exists public.daily_closures (
  id uuid default uuid_generate_v4() primary key,
  date date not null unique,
  opening_balance numeric not null,
  closing_balance numeric,
  
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  status closure_status default 'open',
  
  created_at timestamptz default now()
);

-- 7. APP SETTINGS
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null
);

-- RLS POLICIES (Basic Setup - Needs refinement based on strict security requirements)
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.analytical_accounts enable row level security;
alter table public.accounting_accounts enable row level security;
alter table public.cash_requests enable row level security;
alter table public.cash_transactions enable row level security;
alter table public.daily_closures enable row level security;
alter table public.app_settings enable row level security;

-- Helper to safely drop policies
DO $$ 
BEGIN
    -- Profiles
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
    DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
    
    -- Projects/Accounts
    DROP POLICY IF EXISTS "Projects viewable by authenticated" ON public.projects;
    DROP POLICY IF EXISTS "Analytical Accounts viewable by authenticated" ON public.analytical_accounts;
    
    -- Requests
    DROP POLICY IF EXISTS "Requester see own requests" ON public.cash_requests;
    DROP POLICY IF EXISTS "Staff see all requests" ON public.cash_requests;
    DROP POLICY IF EXISTS "Requester can insert requests" ON public.cash_requests;
    
    -- Transactions
    DROP POLICY IF EXISTS "Transactions viewable by authenticated" ON public.cash_transactions;
    
    -- Admin Policies - Projects
    DROP POLICY IF EXISTS "Admin can insert projects" ON public.projects;
    DROP POLICY IF EXISTS "Admin can update projects" ON public.projects;
    DROP POLICY IF EXISTS "Admin can delete projects" ON public.projects;
    
    -- Admin Policies - Analytical Accounts
    DROP POLICY IF EXISTS "Admin can insert analytical accounts" ON public.analytical_accounts;
    DROP POLICY IF EXISTS "Admin can update analytical accounts" ON public.analytical_accounts;
    DROP POLICY IF EXISTS "Admin can delete analytical accounts" ON public.analytical_accounts;
    
    -- Admin Policies - Accounting Accounts
    DROP POLICY IF EXISTS "Accounting Accounts viewable by authenticated" ON public.accounting_accounts;
    DROP POLICY IF EXISTS "Admin can insert accounting accounts" ON public.accounting_accounts;
    DROP POLICY IF EXISTS "Admin can update accounting accounts" ON public.accounting_accounts;
    DROP POLICY IF EXISTS "Admin can delete accounting accounts" ON public.accounting_accounts;
    
    -- Admin Policies - App Settings
    DROP POLICY IF EXISTS "Admin can view app settings" ON public.app_settings;
    DROP POLICY IF EXISTS "Admin can update app settings" ON public.app_settings;
    DROP POLICY IF EXISTS "Admin can insert app settings" ON public.app_settings;
    
    -- Admin Policies - User Roles
    DROP POLICY IF EXISTS "Admin can update user roles" ON public.profiles;
END $$;

-- Profiles: Everyone can read profiles. Users can update their own.
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- Projects/Accounts: Readable by authenticated users. Only Admin can manage.
create policy "Projects viewable by authenticated" on public.projects for select using (auth.role() = 'authenticated');
create policy "Analytical Accounts viewable by authenticated" on public.analytical_accounts for select using (auth.role() = 'authenticated');
create policy "Accounting Accounts viewable by authenticated" on public.accounting_accounts for select using (auth.role() = 'authenticated');

-- Requests:
-- Requester can see own.
-- Controller/CFO/Cashier/Admin can see all.
create policy "Requester see own requests" on public.cash_requests for select using (auth.uid() = requester_id);
create policy "Staff see all requests" on public.cash_requests for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'controller', 'cfo', 'cashier', 'accountant'))
);
create policy "Requester can insert requests" on public.cash_requests for insert with check (auth.uid() = requester_id);

-- Transactions:
-- Viewable by authenticated.
-- Insertable by Cashier/Admin.
create policy "Transactions viewable by authenticated" on public.cash_transactions for select using (auth.role() = 'authenticated');

-- Admin policies for managing projects
create policy "Admin can insert projects" on public.projects for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin can update projects" on public.projects for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin can delete projects" on public.projects for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Admin policies for managing analytical accounts
create policy "Admin can insert analytical accounts" on public.analytical_accounts for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin can update analytical accounts" on public.analytical_accounts for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin can delete analytical accounts" on public.analytical_accounts for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Admin policies for managing accounting accounts
create policy "Admin can insert accounting accounts" on public.accounting_accounts for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin can update accounting accounts" on public.accounting_accounts for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin can delete accounting accounts" on public.accounting_accounts for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Admin policies for app settings
create policy "Admin can view app settings" on public.app_settings for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin can update app settings" on public.app_settings for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin can insert app settings" on public.app_settings for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Admin can update user roles
create policy "Admin can update user roles" on public.profiles for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Storage for proof documents
insert into storage.buckets (id, name, public) 
values ('proof-documents', 'proof-documents', false)
on conflict (id) do nothing;

-- Storage policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can view proof documents" ON storage.objects;
    DROP POLICY IF EXISTS "Cashiers can upload proof documents" ON storage.objects;
    DROP POLICY IF EXISTS "Cashiers can update proof documents" ON storage.objects;
END $$;

create policy "Authenticated users can view proof documents"
on storage.objects for select
using (bucket_id = 'proof-documents' and auth.role() = 'authenticated');

create policy "Cashiers can upload proof documents"
on storage.objects for insert
with check (
  bucket_id = 'proof-documents' and
  exists (select 1 from public.profiles where id = auth.uid() and role in ('cashier', 'admin'))
);

create policy "Cashiers can update proof documents"
on storage.objects for update
using (
  bucket_id = 'proof-documents' and
  exists (select 1 from public.profiles where id = auth.uid() and role in ('cashier', 'admin'))
);

-- Functions & Triggers
-- Handle new user signup -> create profile
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'requester')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to allow recreation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Drop function first to allow parameter name changes
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text, user_role);

-- Helper function for admin user creation
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role user_role
) RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  new_user_id := extensions.gen_random_uuid();

  -- 1. Create the auth user
  INSERT INTO auth.users (
    id,
    instance_id, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    raw_app_meta_data, 
    raw_user_meta_data, 
    created_at, 
    updated_at, 
    role, 
    aud,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  )
  VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000', 
    p_email, 
    -- Use extensions schema explicitly for pgcrypto functions
    extensions.crypt(p_password, extensions.gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    jsonb_build_object('full_name', p_full_name), 
    now(), 
    now(), 
    'authenticated', 
    'authenticated',
    '',
    '',
    '',
    ''
  );

  -- 2. Create the identity
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    extensions.gen_random_uuid(),
    new_user_id,
    format('{"sub":"%s","email":"%s"}', new_user_id, p_email)::jsonb,
    'email',
    p_email,
    now(),
    now(),
    now()
  );

  -- 3. Update profile role (profile is created automatically by the trigger)
  UPDATE public.profiles SET role = p_role WHERE id = new_user_id;

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- Seed Initial Settings
insert into public.app_settings (key, value) values 
('max_outflow_limit', '250000'),
('alert_threshold', '50000')
on conflict (key) do nothing;

-- Ensure column exists for existing installations
ALTER TABLE public.cash_transactions 
ADD COLUMN IF NOT EXISTS accounting_account_id uuid REFERENCES public.accounting_accounts(id);
