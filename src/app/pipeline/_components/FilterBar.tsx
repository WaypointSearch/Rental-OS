'use client'

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

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#e6edf3',
  borderRadius: 7,
  padding: '6px 10px',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
  height: 32,
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
    <div
      style={{
        background: 'rgba(13,16,28,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '7px 0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      {/* Search */}
      <div style={{ position: 'relative', flex: '1 1 180px', maxWidth: 280 }}>
        <svg
          width="13" height="13" viewBox="0 0 16 16" fill="none"
          style={{
            position: 'absolute', left: 9, top: '50%',
            transform: 'translateY(-50%)',
            color: '#6e7681', pointerEvents: 'none',
          }}
        >
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          placeholder="Search leads…"
          value={filter.query}
          onChange={(e) => onUpdate({ query: e.target.value })}
          style={{ ...inputStyle, width: '100%', paddingLeft: 28 }}
        />
      </div>

      {/* Source */}
      <select
        value={filter.source}
        onChange={(e) => onUpdate({ source: e.target.value as SourceFilter })}
        style={{ ...inputStyle, cursor: 'pointer' }}
      >
        <option value="all"          style={{ background: '#161b22' }}>All sources</option>
        <option value="facebook"     style={{ background: '#161b22' }}>Facebook</option>
        <option value="google_voice" style={{ background: '#161b22' }}>Google Voice</option>
      </select>

      {/* Agent */}
      {agents.length > 2 && (
        <select
          value={filter.agent}
          onChange={(e) => onUpdate({ agent: e.target.value })}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          {agents.map((a) => (
            <option key={a} value={a} style={{ background: '#161b22' }}>
              {a === 'all' ? 'All agents' : a.split('@')[0]}
            </option>
          ))}
        </select>
      )}

      {/* Sort */}
      <select
        value={filter.sort}
        onChange={(e) => onUpdate({ sort: e.target.value as SortKey })}
        style={{ ...inputStyle, cursor: 'pointer' }}
      >
        <option value="newest"  style={{ background: '#161b22' }}>Newest first</option>
        <option value="oldest"  style={{ background: '#161b22' }}>Oldest first</option>
        <option value="name"    style={{ background: '#161b22' }}>Name A–Z</option>
        <option value="budget"  style={{ background: '#161b22' }}>Budget high–low</option>
      </select>

      {/* Count + clear */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {isFiltered && (
          <>
            <span style={{ fontSize: 12, color: '#6e7681' }}>
              {totalVisible} of {totalAll}
            </span>
            <button
              onClick={onReset}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#8b949e',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Clear
            </button>
          </>
        )}
      </div>
    </div>
  )
}
