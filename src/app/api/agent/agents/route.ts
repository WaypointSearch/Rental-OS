import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { requireAgentKey } from '@/lib/agentApi'

/**
 * GET /api/agent/agents
 * Everything an AI dispatcher needs to pick an agent: coverage, languages,
 * lead preference, MLS and weekly availability. No tax, ID or admin fields.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAgentKey(req)
  if (denied) return denied

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('agent_profiles')
    .select('*')
    .order('full_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const agents = (data ?? []).map(agent => ({
    email: agent.email,
    name: agent.full_name,
    showing_areas: agent.showing_areas ?? null,
    languages: agent.languages ?? [],
    lead_preference: agent.lead_preference ?? 'both',
    mls_affiliation: agent.mls_affiliation ?? null,
    availability: agent.availability ?? null,
    is_broker: Boolean(agent.is_admin),
  }))
  return NextResponse.json({ agents })
}
