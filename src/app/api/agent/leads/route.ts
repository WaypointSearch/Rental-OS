import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { AI_ASSIGNER, assignLead, parseAssignmentType, requireAgentKey } from '@/lib/agentApi'
import { STAGES } from '@/types/lead'

const LEAD_FIELDS = [
  'name', 'phone', 'source', 'area', 'specific_cities', 'bedrooms', 'bathrooms', 'budget',
  'move_in', 'pets', 'credit', 'income', 'mls_codes', 'urls', 'cl_url',
  'criminal_eviction_status', 'notes_crm', 'cosigner_info', 'stage',
] as const

/**
 * GET /api/agent/leads?status=unassigned|all&limit=50
 * Lists leads, newest first (default: unassigned only).
 */
export async function GET(req: NextRequest) {
  const denied = requireAgentKey(req)
  if (denied) return denied

  const status = req.nextUrl.searchParams.get('status') ?? 'unassigned'
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 50, 1), 200)
  const admin = createAdminClient()
  let query = admin.from('leads').select('*').order('created_at', { ascending: false }).limit(limit)
  if (status === 'unassigned') query = query.or('assigned_agent.is.null,assigned_agent.eq.Unassigned')
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leads: data ?? [] })
}

/**
 * POST /api/agent/leads
 * Body: lead fields (name, phone, budget, …) and optionally
 *   "assign": { "agentEmail": "jane@…", "type": "full" | "showing" }
 * Creates the lead (or updates it if the id/phone already exists). With
 * "assign", also assigns it and emails + texts the agent.
 */
export async function POST(req: NextRequest) {
  const denied = requireAgentKey(req)
  if (denied) return denied

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'JSON body required' }, { status: 400 })

  // Leads are keyed by phone number digits (same convention as the Google Voice bot)
  const id = String(body.id ?? String(body.phone ?? '').replace(/\D/g, '')).trim()
  if (!id) return NextResponse.json({ error: 'Provide "phone" (or "id") so the lead has a unique id' }, { status: 400 })
  if (!body.name && !body.phone) return NextResponse.json({ error: 'Provide at least "name" or "phone"' }, { status: 400 })

  const record: Record<string, unknown> = { id }
  for (const field of LEAD_FIELDS) {
    if (body[field] !== undefined) record[field] = body[field]
  }
  record.source = record.source ?? 'AI Agent'
  if (record.stage && !STAGES.includes(record.stage as (typeof STAGES)[number])) {
    return NextResponse.json({ error: `stage must be one of: ${STAGES.join(', ')}` }, { status: 400 })
  }

  const type = parseAssignmentType(body.assign?.type)
  if (type === 'invalid') return NextResponse.json({ error: 'assign.type must be "full" or "showing"' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin.from('leads').select('id').eq('id', id).maybeSingle()
  if (!existing) {
    record.stage = record.stage ?? 'Waiting for contact'
    record.assigned_agent = 'Unassigned'
    record.notes = []
    record.documents = []
  }
  const { data: lead, error } = await admin.from('leads').upsert(record, { onConflict: 'id' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!body.assign?.agentEmail) {
    return NextResponse.json({ lead, created: !existing }, { status: existing ? 200 : 201 })
  }

  const outcome = await assignLead(admin, id, String(body.assign.agentEmail), type, AI_ASSIGNER)
  if (outcome.error) {
    return NextResponse.json({ lead, created: !existing, error: `Lead saved but not assigned: ${outcome.error}` }, { status: outcome.status ?? 500 })
  }
  return NextResponse.json({ lead: outcome.lead, created: !existing, notified: outcome.notified, warning: outcome.warning }, { status: existing ? 200 : 201 })
}
