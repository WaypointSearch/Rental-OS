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
 * Subscribes to real-time INSERT / UPDATE / DELETE events on the `leads` table.
 * When your Google Apps Script upserts a lead, it will appear/update live
 * in every connected agent's browser without a page refresh.
 */
export function useLeadsRealtime({
  onInsert,
  onUpdate,
  onDelete,
}: UseLeadsRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const supabase = getSupabase()

    channelRef.current = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          onInsert(payload.new as Lead)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads' },
        (payload) => {
          onUpdate(payload.new as Lead)
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'leads' },
        (payload) => {
          onDelete((payload.old as { id: string }).id)
        }
      )
      .subscribe()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [onInsert, onUpdate, onDelete])
}
