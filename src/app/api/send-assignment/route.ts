import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { notifyAgentOfAssignment } from '@/lib/notifyAssignment'
import { AssignmentType, Lead } from '@/types/lead'

/**
 * POST /api/send-assignment
 * Body: { leadId, agentEmail, assignmentType? }
 * Called by the broker's Assign screen after the lead row is updated. Sends the
 * agent a branded email and a text (see lib/notifyAssignment.ts).
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('agent_profiles').select('is_admin, full_name').eq('id', user.id).single()
  if (!adminProfile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { leadId, agentEmail } = body
  if (!agentEmail || !leadId) return NextResponse.json({ error: 'agentEmail and leadId required' }, { status: 400 })
  const assignmentType: AssignmentType | null =
    body.assignmentType === 'full' || body.assignmentType === 'showing' ? body.assignmentType : null

  // Read the lead fresh so the notification reflects what was actually saved
  const admin = createAdminClient()
  const { data: lead, error } = await admin.from('leads').select('*').eq('id', leadId).single()
  if (error || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const result = await notifyAgentOfAssignment({
    supabase: admin,
    lead: lead as Lead,
    agentEmail,
    assignmentType,
    assignedBy: adminProfile.full_name ?? user.email?.split('@')[0] ?? 'Your broker',
  })
  return NextResponse.json(result)
}
