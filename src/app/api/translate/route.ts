import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { OpenAIError, openaiJson } from '@/lib/openai'

/**
 * POST /api/translate  { texts: string[], target: 'en' | 'es' }
 * Translates CRM notes / summaries for the signed-in agent with OpenAI
 * (key and model set in God Mode → Settings).
 */

const LANGUAGE_NAMES = { en: 'English', es: 'Spanish' } as const
const MAX_TEXTS = 40
const MAX_CHARS = 20_000

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const target = body.target === 'es' || body.target === 'en' ? body.target as keyof typeof LANGUAGE_NAMES : null
  const texts: string[] = Array.isArray(body.texts) ? body.texts.filter((t: unknown) => typeof t === 'string').slice(0, MAX_TEXTS) : []
  if (!target || texts.length === 0) return NextResponse.json({ error: 'texts[] and target ("en" | "es") required' }, { status: 400 })
  if (texts.join('').length > MAX_CHARS) return NextResponse.json({ error: 'Too much text to translate at once' }, { status: 413 })

  const language = LANGUAGE_NAMES[target]
  try {
    const result = await openaiJson<{ translations: string[] }>({
      system:
        `You translate notes inside a Florida real-estate rental CRM into ${language}. ` +
        'Keep names, phone numbers, addresses, dollar amounts, dates, MLS numbers and URLs exactly as written. ' +
        'Keep the tone and brevity of the original. If a text is already in the target language, return it unchanged. ' +
        'Return one translation per input, in the same order.',
      user: JSON.stringify({ texts }),
      schemaName: 'translations',
      schema: {
        type: 'object',
        properties: { translations: { type: 'array', items: { type: 'string' } } },
        required: ['translations'],
        additionalProperties: false,
      },
    })
    if (!Array.isArray(result.translations) || result.translations.length !== texts.length) {
      return NextResponse.json({ error: 'Translation came back incomplete, please try again.' }, { status: 502 })
    }
    return NextResponse.json({ translations: result.translations.map(String) })
  } catch (error) {
    if (error instanceof OpenAIError) {
      console.error('translate error', error.status, error.message)
      const status = error.status === 503 ? 503 : error.status === 429 ? 429 : 502
      return NextResponse.json({ error: error.message }, { status })
    }
    throw error
  }
}
