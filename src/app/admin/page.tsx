import Link from 'next/link'
import { FileText } from 'lucide-react'
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

  const { data: profile } = await supabase
    .from('agent_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/pipeline')

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: agents } = await supabase
    .from('agent_profiles')
    .select('*')
    .order('created_at', { ascending: true })

  return (
    <>
      <AdminDashboard
        leads={(leads ?? []) as Lead[]}
        agents={(agents ?? []) as AgentProfile[]}
        adminEmail={user.email ?? ''}
        adminId={user.id}
      />
      <Link
        href="/admin/records"
        style={{
          position: 'fixed', right: 14, bottom: 14, zIndex: 70,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 11px', borderRadius: 8,
          color: '#e3b341', background: 'rgba(13,16,28,.94)',
          border: '1px solid rgba(227,179,65,.28)',
          boxShadow: '0 8px 24px rgba(0,0,0,.3)',
          textDecoration: 'none', fontSize: 11, fontWeight: 700,
        }}
      >
        <FileText size={14}/> Records
      </Link>
    </>
  )
}
