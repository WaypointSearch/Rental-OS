-- ============================================================
-- Sun Ocean Realty — App settings (API keys managed in God Mode)
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

create table if not exists app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- Row level security with NO policies: browsers (anon/authenticated keys) can
-- never read or write these secrets. Only the server's service-role client can.
alter table app_settings enable row level security;
