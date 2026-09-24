import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { getSetting, saveSetting } from '@/lib/appSettings'
import { OpenAIError, openaiJson } from '@/lib/openai'

/**
 * God Mode → Settings. Broker-only. Secrets are write-only: GET returns whether
 * each one is set and its last 4 characters, never the value itself. The one
 * exception is a freshly generated AI agent key, returned once so it can be copied.
 */

async function requireBroker() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('agent_profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { email: user.email ?? 'broker' }
}

const last4 = (value: string | null) => (value ? value.slice(-4) : null)

async function status() {
  const [openai, model, agentKey] = await Promise.all([
    getSetting('openai_api_key'), getSetting('openai_model'), getSetting('ai_agent_api_key'),
  ])
  return {
    openai: { set: Boolean(openai.value), last4: last4(openai.value), source: openai.source },
    openaiModel: { value: model.value, source: model.source },
    aiAgentKey: { set: Boolean(agentKey.value), last4: last4(agentKey.value), source: agentKey.source },
    email: { configured: Boolean(process.env.RESEND_API_KEY) },
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
  }
}

export async function GET() {
  const broker = await requireBroker()
  if (broker.error) return broker.error
  return NextResponse.json(await status())
}

export async function POST(req: NextRequest) {
  const broker = await requireBroker()
  if (broker.error) return broker.error
  const body = await req.json().catch(() => ({}))
  const value = typeof body.value === 'string' ? body.value.trim() : ''

  try {
    switch (body.action) {
      case 'save_openai_key':
        if (!/^sk-[A-Za-z0-9_\-]{20,}$/.test(value)) {
          return NextResponse.json({ error: 'That doesn’t look like an OpenAI API key (it starts with "sk-").' }, { status: 400 })
        }
        await saveSetting('openai_api_key', value, broker.email)
        break
      case 'save_openai_model':
        if (!/^[A-Za-z0-9._:\-]{2,64}$/.test(value)) return NextResponse.json({ error: 'Enter a model name, e.g. gpt-4o-mini.' }, { status: 400 })
        await saveSetting('openai_model', value, broker.email)
        break
      case 'save_agent_key':
        if (value.length < 24) return NextResponse.json({ error: 'The AI agent key must be at least 24 characters.' }, { status: 400 })
        await saveSetting('ai_agent_api_key', value, broker.email)
        break
      case 'generate_agent_key': {
        const key = `sor_ai_${randomBytes(24).toString('base64url')}`
        await saveSetting('ai_agent_api_key', key, broker.email)
        return NextResponse.json({ ...(await status()), generatedKey: key })
      }
      case 'clear':
        if (!['openai_api_key', 'openai_model', 'ai_agent_api_key'].includes(body.name)) {
          return NextResponse.json({ error: 'Unknown setting' }, { status: 400 })
        }
        await saveSetting(body.name, '', broker.email)
        break
      case 'test_openai': {
        const result = await openaiJson<{ english: string }>({
          system: 'Translate the Spanish text into English.',
          user: '¿Puedo ver el apartamento mañana a las 5?',
          schemaName: 'test',
          schema: { type: 'object', properties: { english: { type: 'string' } }, required: ['english'], additionalProperties: false },
        })
        return NextResponse.json({ ...(await status()), test: { ok: true, sample: result.english } })
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof OpenAIError) return NextResponse.json({ ...(await status()), test: { ok: false, error: error.message } })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save' }, { status: 500 })
  }
  return NextResponse.json(await status())
}
