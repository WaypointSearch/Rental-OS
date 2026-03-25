-- ============================================================
-- Sun Ocean Realty — Schema v6 (Run AFTER v5)
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add alert_preference to agent_profiles
alter table agent_profiles
  add column if not exists alert_preference text not null default 'email';

-- 2. Add bathrooms column (if not already from v5)
alter table leads add column if not exists bathrooms text;

-- 3. Add documents column (if not already from v5)
alter table leads add column if not exists documents jsonb not null default '[]'::jsonb;

-- 4. Storage policies for lead documents
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Agents upload lead docs') then
    create policy "Agents upload lead docs"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and name like 'lead-docs/%');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'Agents read lead docs') then
    create policy "Agents read lead docs"
      on storage.objects for select to authenticated
      using (bucket_id = 'avatars' and name like 'lead-docs/%');
  end if;
end $$;

-- 5. Allow agents to insert leads (for manual lead creation)
-- Drop and recreate to be safe
drop policy if exists "Lead insert access" on leads;
create policy "Lead insert access"
  on leads for insert to authenticated
  with check (is_admin());

-- 6. Verify realtime is enabled
alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table agent_profiles;
