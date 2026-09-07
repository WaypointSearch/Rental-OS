import { createServerSupabase } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { CommissionForm } from './CommissionForm'

export const dynamic = 'force-dynamic'

export default async function CommissionPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <CommissionForm userId={user.id} userEmail={user.email ?? ''} />
}
