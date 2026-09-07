'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import {
  BedDouble,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  Trash2,
} from 'lucide-react'
import { Lead, STAGE_COLORS } from '@/types/lead'

interface ListViewProps {
  leads: Lead[]
  agentAvatarMap: Record<string, string | null>
  isAdmin: boolean
  onLeadClick: (lead: Lead) => void
  onDeleteLead?: (id: string) => void
}

type SortKey = 'name' | 'stage' | 'budget' | 'move_in' | 'created_at' | 'assigned_agent'

function agentInitials(email: string) {
  return email
    .split('@')[0]
    .split(/[._-]/)
    .map(part => part[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')
}

function moneyValue(value: string | null) {
  return parseInt((value ?? '0').replace(/\D/g, ''), 10) || 0
}

export function ListView({ leads, agentAvatarMap, isAdmin, onLeadClick, onDeleteLead }: ListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(current => current === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDir(key === 'created_at' || key === 'budget' ? 'desc' : 'asc')
    }
  }

  const sorted = useMemo(() => [...leads].sort((a, b) => {
    if (sortKey === 'budget') {
      const diff = moneyValue(a.budget) - moneyValue(b.budget)
      return sortDir === 'asc' ? diff : -diff
    }

    const aValue = String(a[sortKey] ?? '')
    const bValue = String(b[sortKey] ?? '')
    return sortDir === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
  }), [leads, sortKey, sortDir])

  function SortHeader({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col
    return (
      <th
        onClick={() => toggleSort(col)}
        style={{
          padding: '11px 13px',
          textAlign: 'left',
          color: active ? 'var(--ros-text-2)' : 'var(--ros-muted-2)',
          fontSize: 9,
          fontWeight: 760,
          letterSpacing: '.09em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: '1px solid var(--ros-line)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {label}
          {active && (sortDir === 'asc' ? <ChevronUp size={11}/> : <ChevronDown size={11}/>)}
        </span>
      </th>
    )
  }

  if (isMobile) {
    return (
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 10px 80px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {sorted.map(lead => {
            const accent = STAGE_COLORS[lead.stage] ?? '#6e7681'
            const age = formatDistanceToNowStrict(new Date(lead.created_at), { addSuffix: true })
            return (
              <article
                key={lead.id}
                onClick={() => onLeadClick(lead)}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  padding: '15px',
                  borderRadius: 16,
                  border: '1px solid var(--ros-line)',
                  background: 'color-mix(in srgb, var(--ros-panel-strong) 64%, transparent)',
                  boxShadow: 'var(--ros-shadow-soft)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: '0 3px 3px 0', background: accent }} />

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 760, color: 'var(--ros-text)', letterSpacing: '-.025em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lead.name || 'Unnamed lead'}
                    </div>
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone.replace(/\D/g, '')}`}
                        onClick={event => event.stopPropagation()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, color: 'var(--ros-blue)', fontSize: 12, fontWeight: 680, textDecoration: 'none' }}
                      >
                        <Phone size={12}/> {lead.phone}
                      </a>
                    )}
                  </div>
                  <div style={{ color: 'var(--ros-muted-2)', fontSize: 9, whiteSpace: 'nowrap' }}>{age}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
                  <span style={{ padding: '4px 8px', borderRadius: 999, color: accent, background: `color-mix(in srgb, ${accent} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 20%, transparent)`, fontSize: 9, fontWeight: 760 }}>
                    {lead.stage}
                  </span>
                  {lead.budget && <strong style={{ marginLeft: 'auto', color: 'var(--ros-text)', fontSize: 14 }}>{lead.budget}</strong>}
                </div>

                <div style={{ display: 'grid', gap: 6, marginTop: 11, color: 'var(--ros-muted)', fontSize: 10 }}>
                  {lead.area && <div style={{ display: 'flex', gap: 7 }}><MapPin size={12}/><span>{lead.area}</span></div>}
                  {(lead.bedrooms || lead.bathrooms) && <div style={{ display: 'flex', gap: 7 }}><BedDouble size={12}/><span>{lead.bedrooms ?? '?'} bd · {lead.bathrooms ?? '?'} ba</span></div>}
                  {lead.move_in && <div style={{ display: 'flex', gap: 7 }}><CalendarDays size={12}/><span>Move: {lead.move_in}</span></div>}
                </div>
              </article>
            )
          })}
        </div>

        {sorted.length === 0 && (
          <div style={{ padding: '52px 20px', textAlign: 'center', color: 'var(--ros-muted-2)', fontSize: 12 }}>
            No leads match this view.
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', padding: '14px' }}>
      <div style={{ minWidth: 820, border: '1px solid var(--ros-line)', borderRadius: 16, overflow: 'hidden', background: 'color-mix(in srgb, var(--ros-panel) 62%, transparent)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: 'color-mix(in srgb, var(--ros-panel-strong) 62%, transparent)' }}>
            <tr>
              <SortHeader col="name" label="Lead" />
              <SortHeader col="stage" label="Stage" />
              <SortHeader col="budget" label="Budget" />
              <SortHeader col="move_in" label="Move-in" />
              <SortHeader col="assigned_agent" label="Agent" />
              <SortHeader col="created_at" label="Age" />
              {isAdmin && <th style={{ width: 62, borderBottom: '1px solid var(--ros-line)' }} />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((lead, index) => {
              const accent = STAGE_COLORS[lead.stage] ?? '#6e7681'
              const avatarUrl = agentAvatarMap[lead.assigned_agent] ?? null
              const age = formatDistanceToNowStrict(new Date(lead.created_at), { addSuffix: true })
              const ageDays = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86_400_000)
              const ageColor = ageDays <= 3 ? 'var(--ros-green)' : ageDays <= 10 ? 'var(--ros-yellow)' : 'var(--ros-red)'

              return (
                <tr
                  key={lead.id}
                  onClick={() => onLeadClick(lead)}
                  style={{
                    cursor: 'pointer',
                    background: index % 2 === 0 ? 'color-mix(in srgb, var(--ros-card) 40%, transparent)' : 'transparent',
                    borderBottom: '1px solid var(--ros-line)',
                  }}
                >
                  <td style={{ padding: '12px 13px', maxWidth: 210 }}>
                    <div style={{ color: 'var(--ros-text)', fontWeight: 730, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name || 'Unnamed lead'}</div>
                    {lead.area && <div style={{ marginTop: 3, color: 'var(--ros-muted-2)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.area}</div>}
                  </td>
                  <td style={{ padding: '12px 13px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: 999, color: accent, background: `color-mix(in srgb, ${accent} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 20%, transparent)`, fontSize: 9, fontWeight: 740, whiteSpace: 'nowrap' }}>{lead.stage}</span>
                  </td>
                  <td style={{ padding: '12px 13px', color: 'var(--ros-text-2)', fontWeight: 690 }}>{lead.budget || '—'}</td>
                  <td style={{ padding: '12px 13px', color: 'var(--ros-muted)' }}>{lead.move_in || '—'}</td>
                  <td style={{ padding: '12px 13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--ros-muted)' }}>
                      <span style={{ width: 24, height: 24, flex: '0 0 24px', display: 'grid', placeItems: 'center', borderRadius: 8, overflow: 'hidden', color: 'var(--ros-blue)', background: 'color-mix(in srgb, var(--ros-blue) 11%, transparent)', border: '1px solid color-mix(in srgb, var(--ros-blue) 22%, transparent)', fontSize: 8, fontWeight: 760 }}>
                        {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : agentInitials(lead.assigned_agent ?? '') || '—'}
                      </span>
                      <span>{(lead.assigned_agent || 'Unassigned').split('@')[0]}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 13px', color: ageColor, fontWeight: 660, whiteSpace: 'nowrap' }}>{age}</td>
                  {isAdmin && (
                    <td style={{ padding: '8px 10px' }} onClick={event => event.stopPropagation()}>
                      {deleteConfirm === lead.id ? (
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button className="ros-btn" style={{ height: 29, padding: '0 8px' }} onClick={() => setDeleteConfirm(null)}>No</button>
                          <button className="ros-btn" style={{ height: 29, padding: '0 8px', color: 'var(--ros-red)' }} onClick={() => { onDeleteLead?.(lead.id); setDeleteConfirm(null) }}>Yes</button>
                        </div>
                      ) : (
                        <button className="ros-btn ros-icon-btn" style={{ width: 30, height: 30, color: 'var(--ros-muted-2)' }} onClick={() => setDeleteConfirm(lead.id)} title="Delete lead">
                          <Trash2 size={13}/>
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--ros-muted-2)', fontSize: 12 }}>
          No leads match this view.
        </div>
      )}
    </div>
  )
}
