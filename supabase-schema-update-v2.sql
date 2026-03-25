-- ============================================================
-- Rental OS — Schema Update v2
-- Run in Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── 1. New columns on leads table ───────────────────────────
alter table leads
  add column if not exists criminal_eviction_status text,
  add column if not exists specific_cities          text[],
  add column if not exists notes_crm                text;

-- ── 2. agent_profiles table ─────────────────────────────────
create table if not exists agent_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text unique not null,
  full_name    text,
  avatar_url   text,
  alert_phone  text,
  is_admin     boolean not null default false,
  availability jsonb   not null default '{
    "monday":    {"active":false,"start":"09:00","end":"17:00"},
    "tuesday":   {"active":false,"start":"09:00","end":"17:00"},
    "wednesday": {"active":false,"start":"09:00","end":"17:00"},
    "thursday":  {"active":false,"start":"09:00","end":"17:00"},
    "friday":    {"active":false,"start":"09:00","end":"17:00"},
    "saturday":  {"active":false,"start":"09:00","end":"17:00"},
    "sunday":    {"active":false,"start":"09:00","end":"17:00"}
  }'::jsonb,
  created_at   timestamptz default now()
);

-- ── 3. Auto-create agent profile on signup ──────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into agent_profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── 4. Helper: is current user admin? ───────────────────────
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select is_admin from agent_profiles where id = auth.uid()),
    false
  );
$$;

-- ── 5. RLS on leads ─────────────────────────────────────────
alter table leads enable row level security;

drop policy if exists "Agents see assigned leads"     on leads;
drop policy if exists "Admins see all leads"          on leads;
drop policy if exists "Agents can read leads"         on leads;
drop policy if exists "Agents can update leads"       on leads;

-- SELECT: admin sees all; agent sees only their assigned leads
create policy "Lead read access"
  on leads for select to authenticated
  using (
    is_admin()
    or assigned_agent = (select email from agent_profiles where id = auth.uid())
  );

-- UPDATE: same rule
create policy "Lead update access"
  on leads for update to authenticated
  using (
    is_admin()
    or assigned_agent = (select email from agent_profiles where id = auth.uid())
  )
  with check (
    is_admin()
    or assigned_agent = (select email from agent_profiles where id = auth.uid())
  );

-- INSERT: admin only (agents receive leads via GAS bots)
create policy "Lead insert access"
  on leads for insert to authenticated
  with check (is_admin());

-- DELETE: admin only
create policy "Lead delete access"
  on leads for delete to authenticated
  using (is_admin());

-- ── 6. RLS on agent_profiles ────────────────────────────────
alter table agent_profiles enable row level security;

drop policy if exists "Agents read own profile"       on agent_profiles;
drop policy if exists "Agents update own profile"     on agent_profiles;
drop policy if exists "Admins read all profiles"      on agent_profiles;

-- Everyone can read all profiles (needed for avatar map on cards)
create policy "Authenticated users read profiles"
  on agent_profiles for select to authenticated
  using (true);

-- Agents update only their own profile
create policy "Agents update own profile"
  on agent_profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ── 7. Storage: avatars bucket ──────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Agents upload own avatar"  on storage.objects;
drop policy if exists "Public can read avatars"   on storage.objects;
drop policy if exists "Agents update own avatar"  on storage.objects;

create policy "Agents upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name = 'avatars/' || auth.uid() || '.jpg');

create policy "Public can read avatars"
  on storage.objects for select to public
  using (bucket_id = 'avatars');

create policy "Agents update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name = 'avatars/' || auth.uid() || '.jpg');

-- ── 8. Realtime ─────────────────────────────────────────────
alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table agent_profiles;

-- ── 9. Make yourself admin ───────────────────────────────────
-- After signing up, run this once with your email:
-- update agent_profiles set is_admin = true where email = 'your@email.com';
