-- ============================================================
-- Rental OS — Supabase setup SQL
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Enable Row Level Security on leads
alter table leads enable row level security;

-- 2. Authenticated agents can read all leads
create policy "Agents can read leads"
  on leads for select
  to authenticated
  using (true);

-- 3. Authenticated agents can update leads (notes, stage, assigned_agent)
create policy "Agents can update leads"
  on leads for update
  to authenticated
  using (true)
  with check (true);

-- 4. Service role (Google Apps Script) can insert new leads.
--    The service_role key bypasses RLS automatically — no extra policy needed.
--    If you want to allow agents to manually create leads from the UI, add:
-- create policy "Agents can insert leads"
--   on leads for insert
--   to authenticated
--   with check (true);

-- ============================================================
-- AVATARS BUCKET (Supabase Storage)
-- ============================================================

-- 5. Create the avatars storage bucket (public reads)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 6. Agents can upload their own avatar
create policy "Agents upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name = 'avatars/' || auth.uid() || '.jpg'
  );

-- 7. Anyone can read avatars (public bucket)
create policy "Public can read avatars"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- 8. Agents can overwrite their own avatar
create policy "Agents update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and name = 'avatars/' || auth.uid() || '.jpg'
  );

-- ============================================================
-- REALTIME
-- Lets the KanbanBoard receive live changes without polling.
-- After running this, also go to:
--   Supabase Dashboard → Database → Replication
--   → supabase_realtime → enable the "leads" table toggle
-- ============================================================

-- 9. Add leads to the realtime publication
alter publication supabase_realtime add table leads;
