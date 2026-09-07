'use client'

import { useState, useEffect } from 'react'
import { Lead, STAGE_COLORS } from '@/types/lead'
import { formatDistanceToNowStrict } from 'date-fns'

interface ListViewProps {
  leads: Lead[]
  agentAvatarMap: Record<string, string | null>
  isAdmin: boolean
  onLeadClick: (lead: Lead) => void
  onDeleteLead?: (id: string) => void
}

type SortKey = 'name' | 'stage' | 'budget' | 'move_in' | 'created_at' | 'assigned_agent'

function agentInitials(email: string) {
  return email.split('@')[0].split(/[._-]/).map((p) => p[0]?.toUpperCase() ?? '').slice(0, 2).join('')
}

const COL_STYLE: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 180,
}

export function ListView({
  leads,
  agentAvatarMap,
  isAdmin,
  onLeadClick,
  onDeleteLead,
}: ListViewProps) {
  const [sortKey, setSortKey]     = useState<SortKey>('created_at')
  const [sortDir, setSortDir]     = useState<'asc' | 'desc'>('desc')
  const [delConfirm, setDelConfirm] = useState<string | null>(null)
  const [isMobile, setIsMobile]   = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...leads].sort((a, b) => {
    let av: string = ''
    let bv: string = ''
    if (sortKey === 'created_at') {
      av = a.created_at; bv = b.created_at
    } else if (sortKey === 'budget') {
      const toN = (s: string | null) => parseInt((s ?? '0').replace(/\D/g, ''), 10) || 0
      const diff = toN(a.budget) - toN(b.budget)
      return sortDir === 'asc' ? diff : -diff
    } else {
      av = (a[sortKey] ?? '') as string
      bv = (b[sortKey] ?? '') as string
    }
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  })

  function SortHeader({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col
    return (
      <th
        onClick={() => toggleSort(col)}
        style={{
          ...COL_STYLE,
          cursor: 'pointer',
          color: active ? '#e6edf3' : '#6e7681',
          fontWeight: active ? 600 : 500,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          userSelect: 'none',
        }}
      >
        {label}
        {active && (
          <span style={{ marginLeft: 4, opacity: 0.7 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </th>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        overflowX: isMobile ? 'hidden' : 'auto',
        overflowY: 'auto',
        padding: isMobile ? '8px' : '12px 16px',
      }}
    >
      {/* Mobile card layout */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map((lead) => {
            const accent = STAGE_COLORS[lead.stage] ?? '#6e7681'
            const age = formatDistanceToNowStrict(new Date(lead.created_at))
            return (
              <div
                key={lead.id}
                onClick={() => onLeadClick(lead)}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  borderLeft: `3px solid ${accent}`,
                }}
              >
                {/* Name — full width */}
                <div style={{ fontSize: 16, fontWeight: 600, color: '#f0f6fc', marginBottom: 3 }}>
                  {lead.name ?? '—'}
                </div>

                {/* Phone — clickable, full width */}
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
                    style={{ fontSize: 14, color: '#388bfd', textDecoration: 'none', display: 'block', marginBottom: 8, fontWeight: 500 }}>
                    {lead.phone}
                  </a>
                )}

                {/* Stage pill + age */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 10, background: `${accent}18`, color: accent,
                    borderRadius: 6, padding: '3px 8px', fontWeight: 600,
                    border: `0.5px solid ${accent}40`,
                  }}>
                    {lead.stage}
                  </span>
                  <span style={{ fontSize: 11, color: '#6e7681', marginLeft: 'auto' }}>{age}</span>
                </div>

                {/* Details row */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: '#8b949e' }}>
                  {lead.budget && <span style={{ color: '#c9d1d9', fontWeight: 500 }}>{lead.budget}</span>}
                  {lead.bedrooms && <span>{lead.bedrooms}BR</span>}
                  {lead.move_in && <span>Move: {lead.move_in}</span>}
                </div>

                {/* Area — full width wrap */}
                {lead.area && (
                  <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4, lineHeight: 1.4 }}>{lead.area}</div>
                )}
              </div>
            )
          })}
          {sorted.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
              No leads match your filters
            </div>
          )}
        </div>
      ) : (
      /* Desktop table layout */
      <>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
          minWidth: 700,
        }}
      >
        <thead>
          <tr>
            <SortHeader col="name"           label="Name" />
            <SortHeader col="stage"          label="Stage" />
            <SortHeader col="budget"         label="Budget" />
            <SortHeader col="move_in"        label="Move-in" />
            <SortHeader col="assigned_agent" label="Agent" />
            <SortHeader col="created_at"     label="Age" />
            {isAdmin && <th style={{ ...COL_STYLE, fontSize: 11, color: '#6e7681', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}></th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((lead, i) => {
            const accent   = STAGE_COLORS[lead.stage] ?? '#6e7681'
            const avatarUrl = agentAvatarMap[lead.assigned_agent] ?? null
            const age       = formatDistanceToNowStrict(new Date(lead.created_at))
            const ageDays   = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86_400_000)
            const ageColor  = ageDays <= 3 ? '#3fb950' : ageDays <= 10 ? '#e3b341' : '#e24b4a'

            return (
              <tr
                key={lead.id}
                onClick={() => onLeadClick(lead)}
                style={{
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background .1s',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLTableRowElement).style.background =
                    'rgba(255,255,255,0.05)')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLTableRowElement).style.background =
                    i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent')
                }
              >
                {/* Name */}
                <td style={{ ...COL_STYLE, color: '#f0f6fc', fontWeight: 600 }}>
                  {lead.name ?? '—'}
                </td>

                {/* Stage */}
                <td style={COL_STYLE}>
                  <span
                    style={{
                      fontSize: 11,
                      background: `${accent}18`,
                      color: accent,
                      borderRadius: 6,
                      padding: '3px 8px',
                      fontWeight: 600,
                      border: `0.5px solid ${accent}40`,
                    }}
                  >
                    {lead.stage}
                  </span>
                </td>

                {/* Budget */}
                <td style={{ ...COL_STYLE, color: '#c9d1d9', fontWeight: 500 }}>
                  {lead.budget ?? '—'}
                </td>

                {/* Move-in */}
                <td style={{ ...COL_STYLE, color: '#8b949e' }}>
                  {lead.move_in ?? '—'}
                </td>

                {/* Agent */}
                <td style={COL_STYLE}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: avatarUrl ? 'transparent' : 'rgba(56,139,253,0.2)',
                        border: '1px solid rgba(56,139,253,0.3)',
                        overflow: 'hidden',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        fontWeight: 600,
                        color: '#388bfd',
                      }}
                    >
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        agentInitials(lead.assigned_agent ?? '')
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: '#8b949e' }}>
                      {(lead.assigned_agent ?? 'Unassigned').split('@')[0]}
                    </span>
                  </div>
                </td>

                {/* Age */}
                <td style={{ ...COL_STYLE, color: ageColor, fontWeight: 500 }}>
                  {age}
                </td>

                {/* Admin delete */}
                {isAdmin && (
                  <td style={{ ...COL_STYLE, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    {delConfirm === lead.id ? (
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button
                          onClick={() => setDelConfirm(null)}
                          style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: '#8b949e', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => { onDeleteLead?.(lead.id); setDelConfirm(null) }}
                          style={{ background: 'rgba(226,75,74,0.8)', border: 'none', color: '#fff', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDelConfirm(lead.id)}
                        style={{ background: 'none', border: 'none', color: 'rgba(226,75,74,0.5)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: '2px 6px' }}
                        title="Delete lead"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      {sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
          No leads match your filters
        </div>
      )}
      </>
      )}
    </div>
  )
}
