-- ============================================================
-- Sun Ocean Realty — Lead assignment type (full lead vs showing only)
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- 'full'    = agent works the lead start to finish (60% commission)
-- 'showing' = agent only shows the property ($250 per closed showing)
-- NULL      = assigned before this option existed
alter table leads
  add column if not exists assignment_type text
  check (assignment_type is null or assignment_type in ('full', 'showing'));
