import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client with service_role key.
 * Bypasses RLS — use exclusively in API routes, never in components.
 * Requires SUPABASE_SERVICE_ROLE_KEY in server env (no NEXT_PUBLIC_ prefix).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
