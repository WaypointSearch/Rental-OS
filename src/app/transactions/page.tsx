import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { TransactionForm } from './TransactionForm'

export const dynamic = 'force-dynamic'

export default async function TransactionsPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <TransactionForm userId={user.id} userEmail={user.email ?? ''} />
}
