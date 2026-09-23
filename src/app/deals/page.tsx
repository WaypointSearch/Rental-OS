import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { DealsDashboard } from './DealsDashboard'

export const dynamic = 'force-dynamic'

export default async function DealsPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const email = user.email ?? ''

  // Reads are always filtered to this agent. The service-role client is used so
  // the page works whatever RLS policies exist on the deal tables.
  let db: typeof supabase | ReturnType<typeof createAdminClient> = supabase
  try { db = createAdminClient() } catch { /* fall back to the agent's own session */ }

  const [transactions, commissions, rentals, sales] = await Promise.all([
    db.from('transactions').select('id,type,property_address,city,state,zip,documents,status,created_at').eq('agent_id', user.id).order('created_at', { ascending: false }).limit(50),
    db.from('commission_requests').select('id,type,client_name,property_address,city,net_commission,status,created_at').eq('agent_id', user.id).order('created_at', { ascending: false }).limit(50),
    db.from('leads').select('id,name,stage,budget,created_at').eq('assigned_agent', email).eq('source', 'Self-generated').order('created_at', { ascending: false }).limit(20),
    db.from('sales_leads').select('id,client_name,client_type,stage,created_at').eq('agent_email', email).order('created_at', { ascending: false }).limit(20),
  ])

  return (
    <DealsDashboard
      transactions={transactions.data ?? []}
      commissions={commissions.data ?? []}
      rentals={rentals.data ?? []}
      sales={sales.data ?? []}
    />
  )
}
