import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

/**
 * POST /api/leads/create
 * Broker: creates or updates any lead.
 * Agent: creates their own self-generated rental lead. It is always assigned
 * to them, and they can't overwrite a lead that belongs to someone else.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('agent_profiles').select('is_admin, email').eq('id', user.id).single()
  const isAdmin = Boolean(profile?.is_admin)
  const agentEmail = user.email ?? profile?.email ?? ''

  const body = await req.json()
  // Lead ids are phone-number digits by convention; fall back to a generated id
  const id = String(body.id ?? '').trim()
    || String(body.phone ?? '').replace(/\D/g, '')
    || `M${Date.now().toString(36).toUpperCase()}`

  // Service-role client bypasses RLS, so every rule is enforced here
  const admin = createAdminClient()
  const record: Record<string, unknown> = { ...body, id, notes: body.notes ?? [] }

  if (!isAdmin) {
    const { data: existing } = await admin.from('leads').select('assigned_agent').eq('id', id).maybeSingle()
    if (existing && existing.assigned_agent !== agentEmail) {
      return NextResponse.json({ error: 'A lead with this phone number already exists and belongs to another agent. Ask your broker.' }, { status: 409 })
    }
    record.assigned_agent = agentEmail
    record.source = 'Self-generated'
    delete record.assignment_type
  }

  const { data, error } = await admin
    .from('leads')
    .upsert(record, { onConflict: 'id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lead: data })
}
