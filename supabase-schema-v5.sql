-- ============================================================
-- Rental OS — Schema Update v5
-- Run in Supabase Dashboard → SQL Editor
-- Adds: bathrooms column, documents jsonb column
-- ============================================================

-- 1. Add bathrooms column
alter table leads add column if not exists bathrooms text;

-- 2. Add documents column (jsonb array for file uploads)
alter table leads add column if not exists documents jsonb not null default '[]'::jsonb;

-- 3. Storage policy for lead documents (reuse avatars bucket)
-- Allow authenticated users to upload to lead-docs/ path
create policy "Agents upload lead docs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and name like 'lead-docs/%'
  );

-- Allow authenticated users to read lead docs
create policy "Agents read lead docs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and name like 'lead-docs/%'
  );

-- 4. If you want a dedicated bucket instead (optional, run manually):
-- insert into storage.buckets (id, name, public)
-- values ('lead-docs', 'lead-docs', true)
-- on conflict (id) do nothing;
