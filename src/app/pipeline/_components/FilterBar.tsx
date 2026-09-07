'use client'

import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react'
import { FilterState, SortKey, SourceFilter } from '@/lib/useLeadFilter'

interface FilterBarProps {
  filter: FilterState
  agents: string[]
  isFiltered: boolean
  onUpdate: (patch: Partial<FilterState>) => void
  onReset: () => void
  totalVisible: number
  totalAll: number
}

export function FilterBar({
  filter,
  agents,
  isFiltered,
  onUpdate,
  onReset,
  totalVisible,
  totalAll,
}: FilterBarProps) {
  return (
    <div className="ros-filterbar">
      <div className="ros-search-wrap">
        <Search className="ros-search-icon" size={15} strokeWidth={2} />
        <input
          className="ros-input"
          type="search"
          placeholder="Search name, phone, area, agent…"
          value={filter.query}
          onChange={e => onUpdate({ query: e.target.value })}
          aria-label="Search leads"
        />
      </div>

      <select
        className="ros-select"
        value={filter.source}
        onChange={e => onUpdate({ source: e.target.value as SourceFilter })}
        aria-label="Filter by source"
      >
        <option value="all">All sources</option>
        <option value="facebook">Facebook</option>
        <option value="google_voice">Google Voice</option>
      </select>

      {agents.length > 2 && (
        <select
          className="ros-select"
          value={filter.agent}
          onChange={e => onUpdate({ agent: e.target.value })}
          aria-label="Filter by agent"
        >
          {agents.map(agent => (
            <option key={agent} value={agent}>
              {agent === 'all' ? 'All agents' : agent.split('@')[0]}
            </option>
          ))}
        </select>
      )}

      <select
        className="ros-select"
        value={filter.sort}
        onChange={e => onUpdate({ sort: e.target.value as SortKey })}
        aria-label="Sort leads"
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="name">Name A–Z</option>
        <option value="budget">Budget high–low</option>
      </select>

      <div className="ros-filter-meta">
        <SlidersHorizontal size={13} />
        <span>{totalVisible}{isFiltered ? ` of ${totalAll}` : ''}</span>
        {isFiltered && (
          <button type="button" className="ros-btn" onClick={onReset} title="Clear filters">
            <RotateCcw size={13} /> Clear
          </button>
        )}
      </div>
    </div>
  )
}
