-- ============================================================
-- Sun Ocean Realty — Agent languages
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- Languages an agent can work with clients in (shown on the profile
-- page and in the broker's dispatch view).
alter table agent_profiles
  add column if not exists languages text[] not null default '{}'::text[];
