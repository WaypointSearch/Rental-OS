'use client'

import { useEffect, useRef } from 'react'
import { getSupabase } from '@/lib/supabase'
import { Lead } from '@/types/lead'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface UseLeadsRealtimeOptions {
  onInsert: (lead: Lead) => void
  onUpdate: (lead: Lead) => void
  onDelete: (id: string) => void
}

/**
 * Keeps the broker's full pipeline live while keeping an agent's rendered view
 * limited to leads currently assigned to that agent. If a broker reassigns a
 * lead away, the update removes it from the agent's board immediately.
 */
export function useLeadsRealtime({
  onInsert,
  onUpdate,
  onDelete,
}: UseLeadsRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const supabase = getSupabase()
    let cancelled = false

    async function subscribe() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) return

      const email = user.email ?? ''
      const { data: profile } = await supabase
        .from('agent_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) return
      const isAdmin = profile?.is_admin === true
      const canSee = (lead: Lead) => isAdmin || lead.assigned_agent === email

      channelRef.current = supabase
        .channel(`leads-realtime-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'leads' },
          payload => {
            const lead = payload.new as Lead
            if (canSee(lead)) onInsert(lead)
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'leads' },
          payload => {
            const lead = payload.new as Lead
            if (canSee(lead)) onUpdate(lead)
            else onDelete(lead.id)
          },
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'leads' },
          payload => {
            const id = (payload.old as { id?: string }).id
            if (id) onDelete(id)
          },
        )
        .subscribe()
    }

    void subscribe()

    return () => {
      cancelled = true
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [onInsert, onUpdate, onDelete])
}
