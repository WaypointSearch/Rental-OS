import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { KanbanBoard } from './_components/KanbanBoard'
import { Lead } from '@/types/lead'
import { AgentProfile } from '@/types/agent'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PipelinePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('agent_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const agentProfile = profile as AgentProfile | null
  const isAdmin = agentProfile?.is_admin ?? false
  const agentEmail = user.email ?? agentProfile?.email ?? ''

  // Do not rely on database RLS for the product behavior here. The broker sees
  // the full pipeline; agents receive only rows explicitly assigned to them.
  let leadQuery = supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    leadQuery = leadQuery.eq('assigned_agent', agentEmail)
  }

  const { data: leads } = await leadQuery

  const agentAvatarMap: Record<string, string | null> = {}
  if (isAdmin) {
    const { data: allProfiles } = await supabase
      .from('agent_profiles')
      .select('email, avatar_url')
    if (allProfiles) {
      for (const item of allProfiles) {
        agentAvatarMap[item.email] = item.avatar_url ?? null
      }
    }
  } else if (agentProfile?.email) {
    agentAvatarMap[agentProfile.email] = agentProfile.avatar_url ?? null
  }

  return (
    <KanbanBoard
      initialLeads={(leads ?? []) as Lead[]}
      agentEmail={agentEmail}
      agentId={user.id}
      isAdmin={isAdmin}
      agentProfile={agentProfile}
      agentAvatarMap={agentAvatarMap}
    />
  )
}
