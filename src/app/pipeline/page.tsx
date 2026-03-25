import { createServerSupabase } from '@/lib/supabase-server'
import { KanbanBoard } from './_components/KanbanBoard'
import { Lead } from '@/types/lead'
import { AgentProfile } from '@/types/agent'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PipelinePage() {
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()

  // Fetch leads — RLS automatically filters by assigned_agent unless admin
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  // Fetch current agent profile
  const { data: profile } = await supabase
    .from('agent_profiles')
    .select('*')
    .eq('id', user?.id ?? '')
    .single()

  const agentProfile = profile as AgentProfile | null
  const isAdmin = agentProfile?.is_admin ?? false

  // Build avatar URL map (agent email → avatar URL) for card display
  let agentAvatarMap: Record<string, string | null> = {}
  if (isAdmin) {
    const { data: allProfiles } = await supabase
      .from('agent_profiles')
      .select('email, avatar_url')
    if (allProfiles) {
      for (const p of allProfiles) {
        agentAvatarMap[p.email] = p.avatar_url ?? null
      }
    }
  } else if (agentProfile?.email) {
    agentAvatarMap[agentProfile.email] = agentProfile.avatar_url ?? null
  }

  return (
    <KanbanBoard
      initialLeads={(leads ?? []) as Lead[]}
      agentEmail={user?.email ?? ''}
      agentId={user?.id ?? ''}
      isAdmin={isAdmin}
      agentProfile={agentProfile}
      agentAvatarMap={agentAvatarMap}
    />
  )
}
