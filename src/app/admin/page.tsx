import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { AdminDashboard } from './_components/AdminDashboard'
import { Lead } from '@/types/lead'
import { AgentProfile } from '@/types/agent'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Guard: must be admin
  const { data: profile } = await supabase
    .from('agent_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/pipeline')

  // All leads (RLS allows admin to see everything)
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  // All agent profiles
  const { data: agents } = await supabase
    .from('agent_profiles')
    .select('*')
    .order('created_at', { ascending: true })

  return (
    <AdminDashboard
      leads={(leads ?? []) as Lead[]}
      agents={(agents ?? []) as AgentProfile[]}
      adminEmail={user.email ?? ''}
      adminId={user.id}
    />
  )
}
