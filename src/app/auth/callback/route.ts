import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

/**
 * Supabase Auth callback handler.
 *
 * Supabase redirects here after:
 *   - Magic link clicks
 *   - OAuth provider logins (Google, etc.)
 *
 * It exchanges the one-time `code` for a session cookie,
 * then sends the agent to /pipeline.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/pipeline'

  if (code) {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Something went wrong — send back to login with an error hint
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
