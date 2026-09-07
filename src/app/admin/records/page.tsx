import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { RecordsDashboard } from './RecordsDashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminRecordsPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('agent_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) redirect('/pipeline')

  const [{ data: transactions }, { data: commissions }] = await Promise.all([
    supabase.from('transactions').select('*').order('created_at', { ascending: false }),
    supabase.from('commission_requests').select('*').order('created_at', { ascending: false }),
  ])

  return <RecordsDashboard transactions={transactions ?? []} commissions={commissions ?? []} />
}
