import { getSetting } from '@/lib/appSettings'

/**
 * Minimal OpenAI Chat Completions client (fetch, no SDK). The key and model come
 * from God Mode → Settings, falling back to OPENAI_API_KEY / OPENAI_MODEL.
 */

export class OpenAIError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export async function openaiConfigured() {
  return Boolean((await getSetting('openai_api_key')).value)
}

/** Sends a system + user prompt and returns the parsed JSON that matches `schema`. */
export async function openaiJson<T>({ system, user, schemaName, schema, apiKey, model }: {
  system: string
  user: string
  schemaName: string
  schema: Record<string, unknown>
  apiKey?: string
  model?: string
}): Promise<T> {
  const key = apiKey ?? (await getSetting('openai_api_key')).value
  if (!key) throw new OpenAIError('OpenAI is not set up: add the API key in God Mode → Settings.', 503)
  const chosenModel = model ?? (await getSetting('openai_model')).value ?? 'gpt-4o-mini'

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: chosenModel,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      response_format: { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema } },
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new OpenAIError(payload?.error?.message ?? `OpenAI request failed (${response.status})`, response.status)
  }
  const message = payload?.choices?.[0]?.message
  if (message?.refusal) throw new OpenAIError('OpenAI declined this request.', 422)
  try {
    return JSON.parse(message?.content ?? '') as T
  } catch {
    throw new OpenAIError('OpenAI returned an unreadable answer.', 502)
  }
}
