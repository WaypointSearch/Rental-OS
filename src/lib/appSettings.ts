import { createAdminClient } from '@/lib/supabase-admin'

/**
 * Secrets and switches the broker manages in God Mode → Settings, stored in the
 * `app_settings` table (service-role only; see supabase-app-settings.sql).
 * A value saved in God Mode wins; otherwise the matching env var is used.
 */
export const SETTINGS = {
  openai_api_key: { env: 'OPENAI_API_KEY' },
  openai_model: { env: 'OPENAI_MODEL', fallback: 'gpt-4o-mini' },
  ai_agent_api_key: { env: 'AI_AGENT_API_KEY' },
} as const

export type SettingName = keyof typeof SETTINGS

const TTL_MS = 30_000
let cache: { at: number; values: Record<string, string> } | null = null

async function loadStored(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.values
  const values: Record<string, string> = {}
  try {
    const { data } = await createAdminClient().from('app_settings').select('key, value')
    for (const row of data ?? []) values[row.key] = row.value
  } catch {
    // No service key or table yet: env vars still work
  }
  cache = { at: Date.now(), values }
  return values
}

export async function getSetting(name: SettingName): Promise<{ value: string | null; source: 'god_mode' | 'env' | 'default' | null }> {
  const stored = (await loadStored())[name]
  if (stored) return { value: stored, source: 'god_mode' }
  const def = SETTINGS[name]
  const env = process.env[def.env]
  if (env) return { value: env, source: 'env' }
  if ('fallback' in def) return { value: def.fallback, source: 'default' }
  return { value: null, source: null }
}

export async function saveSetting(name: SettingName, value: string, updatedBy: string) {
  const admin = createAdminClient()
  const { error } = value
    ? await admin.from('app_settings').upsert({ key: name, value, updated_at: new Date().toISOString(), updated_by: updatedBy })
    : await admin.from('app_settings').delete().eq('key', name)
  cache = null
  if (error) throw new Error(/app_settings/.test(error.message)
    ? 'Settings table missing: run supabase-app-settings.sql in Supabase first.'
    : error.message)
}
