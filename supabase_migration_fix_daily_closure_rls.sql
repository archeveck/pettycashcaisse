-- Fix RLS policies for daily_closures

-- Safely drop policies if they exist to avoid conflicts
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Authenticated can view daily closures" ON public.daily_closures;
    DROP POLICY IF EXISTS "Cashiers and Admins can create daily closures" ON public.daily_closures;
    DROP POLICY IF EXISTS "Admins can update daily closures" ON public.daily_closures;
END $$;

-- Allow authenticated users to view closures (Used in DailyClosure.tsx and ClosureHistory.tsx)
create policy "Authenticated can view daily closures"
  on public.daily_closures for select
  using (auth.role() = 'authenticated');

-- Allow cashiers, admins, and controllers to create closures
create policy "Cashiers and Admins can create daily closures"
  on public.daily_closures for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('cashier', 'admin', 'controller'))
  );

-- Allow admins to update closures if needed
create policy "Admins can update daily closures"
  on public.daily_closures for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
