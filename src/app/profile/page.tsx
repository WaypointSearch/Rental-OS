import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { AgentProfileForm } from './_components/AgentProfileForm'
import { AgentProfile } from '@/types/agent'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('agent_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <AgentProfileForm
      profile={profile as AgentProfile | null}
      userId={user.id}
      userEmail={user.email ?? ''}
    />
  )
}
