'use client'

import { useState, useMemo } from 'react'
import { Lead } from '@/types/lead'

export type SortKey = 'newest' | 'oldest' | 'name' | 'budget'
export type SourceFilter = 'all' | 'facebook' | 'google_voice'

export interface FilterState {
  query: string
  source: SourceFilter
  sort: SortKey
  agent: string
}

const DEFAULT_FILTER: FilterState = {
  query: '',
  source: 'all',
  sort: 'newest',
  agent: 'all',
}

export function useLeadFilter(leads: Lead[]) {
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER)

  const agents = useMemo(() => {
    const set = new Set(leads.map((l) => l.assigned_agent).filter(Boolean))
    return ['all', ...Array.from(set)] as string[]
  }, [leads])

  const filtered = useMemo(() => {
    let result = [...leads]

    // Text search
    if (filter.query.trim()) {
      const q = filter.query.toLowerCase()
      result = result.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.area?.toLowerCase().includes(q) ||
          l.phone?.includes(q) ||
          l.mls_codes?.toLowerCase().includes(q) ||
          l.budget?.toLowerCase().includes(q) ||
          l.id.toLowerCase().includes(q)
      )
    }

    // Source filter
    if (filter.source === 'facebook') {
      result = result.filter((l) =>
        l.source?.toLowerCase().includes('facebook')
      )
    } else if (filter.source === 'google_voice') {
      result = result.filter(
        (l) => !l.source?.toLowerCase().includes('facebook')
      )
    }

    // Agent filter
    if (filter.agent !== 'all') {
      result = result.filter((l) => l.assigned_agent === filter.agent)
    }

    // Sort
    switch (filter.sort) {
      case 'newest':
        result.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        break
      case 'oldest':
        result.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        break
      case 'name':
        result.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
        break
      case 'budget':
        // Numeric sort on budget — strip non-numeric
        result.sort((a, b) => {
          const toNum = (s: string | null) =>
            parseInt((s ?? '0').replace(/\D/g, ''), 10) || 0
          return toNum(b.budget) - toNum(a.budget)
        })
        break
    }

    return result
  }, [leads, filter])

  function update(patch: Partial<FilterState>) {
    setFilter((prev) => ({ ...prev, ...patch }))
  }

  function reset() {
    setFilter(DEFAULT_FILTER)
  }

  const isFiltered =
    filter.query !== '' ||
    filter.source !== 'all' ||
    filter.sort !== 'newest' ||
    filter.agent !== 'all'

  return { filter, update, reset, filtered, agents, isFiltered }
}
