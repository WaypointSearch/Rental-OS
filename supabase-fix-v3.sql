-- ============================================================
-- Rental OS — Schema Fix v3
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add cosigner_info column
alter table leads
  add column if not exists cosigner_info text;

-- 2. Fix insert policy — allow admin to insert leads from the UI
-- (service_role already bypasses RLS, this is for the anon/JWT client)
drop policy if exists "Lead insert access" on leads;

create policy "Lead insert access"
  on leads for insert to authenticated
  with check (
    -- Admin can insert directly
    is_admin()
  );

-- 3. Ensure the is_admin() function exists and works correctly
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select is_admin from agent_profiles where id = auth.uid()),
    false
  );
$$;

-- 4. Reminder: make yourself admin if you haven't already
-- update agent_profiles set is_admin = true where email = 'your@email.com';
