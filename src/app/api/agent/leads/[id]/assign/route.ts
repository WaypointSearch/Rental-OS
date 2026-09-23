import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { AI_ASSIGNER, assignLead, parseAssignmentType, requireAgentKey } from '@/lib/agentApi'

/**
 * POST /api/agent/leads/{id}/assign
 * Body: { "agentEmail": "jane@…", "type": "full" | "showing" }
 * Assigns (or reassigns) the lead and emails + texts the agent.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAgentKey(req)
  if (denied) return denied

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  if (!body.agentEmail) return NextResponse.json({ error: 'agentEmail required' }, { status: 400 })
  const type = parseAssignmentType(body.type)
  if (type === 'invalid') return NextResponse.json({ error: 'type must be "full" or "showing"' }, { status: 400 })

  const outcome = await assignLead(createAdminClient(), decodeURIComponent(id), String(body.agentEmail), type, AI_ASSIGNER)
  if (outcome.error) return NextResponse.json({ error: outcome.error }, { status: outcome.status ?? 500 })
  return NextResponse.json({ lead: outcome.lead, notified: outcome.notified, warning: outcome.warning })
}
