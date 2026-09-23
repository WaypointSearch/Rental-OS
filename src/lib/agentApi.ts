import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AssignmentType, Lead } from '@/types/lead'
import { notifyAgentOfAssignment, NotifyResult } from '@/lib/notifyAssignment'

/**
 * Shared pieces of the AI dispatch API (/api/agent/*). An AI agent (Muse, Grok,
 * a GAS script…) authenticates with `Authorization: Bearer <AI_AGENT_API_KEY>`.
 */

export const AI_ASSIGNER = 'Sun Ocean AI Dispatch'

/** Returns an error response when the request isn't authorized, otherwise null. */
export function requireAgentKey(req: NextRequest): NextResponse | null {
  const expected = process.env.AI_AGENT_API_KEY
  if (!expected || expected.length < 24) {
    return NextResponse.json({ error: 'AI API is disabled: set AI_AGENT_API_KEY (24+ characters) on the server.' }, { status: 503 })
  }
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }
  return null
}

export function parseAssignmentType(value: unknown): AssignmentType | null | 'invalid' {
  if (value === undefined || value === null || value === '') return null
  if (value === 'full' || value === 'showing') return value
  return 'invalid'
}

export interface AssignOutcome {
  lead?: Lead
  notified?: NotifyResult
  warning?: string
  error?: string
  status?: number
}

/** Assigns a lead to an agent (by email), saves the type, and notifies the agent. */
export async function assignLead(
  admin: SupabaseClient,
  leadId: string,
  agentEmail: string,
  assignmentType: AssignmentType | null,
  assignedBy: string,
): Promise<AssignOutcome> {
  const email = agentEmail.trim().toLowerCase()
  const { data: agent } = await admin
    .from('agent_profiles').select('email').ilike('email', email).maybeSingle()
  if (!agent) return { error: `No agent with email ${agentEmail}. GET /api/agent/agents lists valid agents.`, status: 404 }

  let warning: string | undefined
  let { data, error } = await admin
    .from('leads')
    .update({ assigned_agent: agent.email, assignment_type: assignmentType })
    .eq('id', leadId).select().maybeSingle()

  if (error && /assignment_type/i.test(error.message)) {
    warning = 'Lead assigned, but assignment_type was not saved: run supabase-lead-assignment-type.sql.'
    ;({ data, error } = await admin
      .from('leads').update({ assigned_agent: agent.email })
      .eq('id', leadId).select().maybeSingle())
  }
  if (error) return { error: error.message, status: 500 }
  if (!data) return { error: `No lead with id ${leadId}`, status: 404 }

  const notified = await notifyAgentOfAssignment({
    supabase: admin, lead: data as Lead, agentEmail: agent.email, assignmentType, assignedBy,
  })
  return { lead: data as Lead, notified, warning }
}
