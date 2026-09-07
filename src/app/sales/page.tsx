import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { AgentProfile } from '@/types/agent'
import { SalesBoard } from './SalesBoard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SalesPage() {
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

  let query = supabase.from('sales_leads').select('*').order('created_at', { ascending: false })
  if (!isAdmin) query = query.eq('agent_email', agentEmail)
  const { data: leads } = await query

  let agents: Array<Pick<AgentProfile, 'id' | 'email' | 'full_name' | 'avatar_url'>> = []
  if (isAdmin) {
    const { data } = await supabase
      .from('agent_profiles')
      .select('id,email,full_name,avatar_url')
      .order('full_name')
    agents = (data ?? []) as typeof agents
  }

  return (
    <SalesBoard
      initialLeads={leads ?? []}
      agentEmail={agentEmail}
      agentId={user.id}
      isAdmin={isAdmin}
      agents={agents}
    />
  )
}
