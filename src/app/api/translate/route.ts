import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

/**
 * POST /api/translate  { texts: string[], target: 'en' | 'es' }
 * Translates CRM notes / summaries for the signed-in agent. Requires
 * ANTHROPIC_API_KEY on the server; returns 503 without it so the UI can hide
 * the Translate button.
 */

const LANGUAGE_NAMES = { en: 'English', es: 'Spanish' } as const
const MAX_TEXTS = 40
const MAX_CHARS = 20_000

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!client) return NextResponse.json({ error: 'Translation is not configured (ANTHROPIC_API_KEY).' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const target = body.target === 'es' || body.target === 'en' ? body.target as keyof typeof LANGUAGE_NAMES : null
  const texts: string[] = Array.isArray(body.texts) ? body.texts.filter((t: unknown) => typeof t === 'string').slice(0, MAX_TEXTS) : []
  if (!target || texts.length === 0) return NextResponse.json({ error: 'texts[] and target ("en" | "es") required' }, { status: 400 })
  if (texts.join('').length > MAX_CHARS) return NextResponse.json({ error: 'Too much text to translate at once' }, { status: 413 })

  const language = LANGUAGE_NAMES[target]
  try {
    const params = {
      model: 'claude-opus-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: { translations: { type: 'array', items: { type: 'string' } } },
            required: ['translations'],
            additionalProperties: false,
          },
        },
      },
      system:
        `You translate notes inside a Florida real-estate rental CRM into ${language}. ` +
        'Keep names, phone numbers, addresses, dollar amounts, dates, MLS numbers and URLs exactly as written. ' +
        'Keep the tone and brevity of the original. If a text is already in the target language, return it unchanged. ' +
        'Return one translation per input, in the same order.',
      messages: [{ role: 'user', content: JSON.stringify({ texts }) }],
    }
    // fallbacks: "default" is newer than some SDK typings, hence the cast
    const response = await client.beta.messages.create(params as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming)

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'The translation service declined this text.' }, { status: 422 })
    }
    const text = response.content.find(block => block.type === 'text')
    const parsed = text && text.type === 'text' ? JSON.parse(text.text) as { translations?: unknown } : null
    const translations = Array.isArray(parsed?.translations) ? parsed.translations.map(String) : []
    if (translations.length !== texts.length) {
      return NextResponse.json({ error: 'Translation came back incomplete, please try again.' }, { status: 502 })
    }
    return NextResponse.json({ translations })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: 'Translation is busy, try again in a moment.' }, { status: 429 })
    }
    if (error instanceof Anthropic.APIError) {
      console.error('translate API error', error.status, error.message)
      return NextResponse.json({ error: 'Translation failed.' }, { status: 502 })
    }
    throw error
  }
}
