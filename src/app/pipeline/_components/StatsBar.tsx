'use client'

import { Lead } from '@/types/lead'

interface StatsBarProps {
  leads: Lead[]
  isAdmin?: boolean
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: string
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8,
        padding: '7px 14px',
        minWidth: 76,
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 4, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: accent ?? '#e6edf3', lineHeight: 1.1, letterSpacing: '-0.5px' }}>
        {value}
      </div>
    </div>
  )
}

export function StatsBar({ leads, isAdmin = false }: StatsBarProps) {
  const total = leads.length

  const newToday = leads.filter((l) => {
    const d = new Date(l.created_at)
    const n = new Date()
    return d.getFullYear() === n.getFullYear() &&
      d.getMonth() === n.getMonth() &&
      d.getDate() === n.getDate()
  }).length

  const active = leads.filter(
    (l) => l.stage !== 'Move in / Deposit' && l.stage !== 'Waiting for contact'
  ).length

  const stale = leads.filter((l) => {
    const days = (Date.now() - new Date(l.created_at).getTime()) / 86_400_000
    return days > 10 && l.stage !== 'Move in / Deposit'
  }).length

  const highValue = leads.filter((l) =>
    ['Offer Sent', 'Offer Approved', 'HOA Approved', 'Move in / Deposit'].includes(l.stage)
  ).length

  const closedMo = leads.filter((l) => {
    if (l.stage !== 'Move in / Deposit') return false
    const d = new Date(l.created_at), n = new Date()
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()
  }).length

  const unassigned = leads.filter(
    (l) => !l.assigned_agent || l.assigned_agent === 'Unassigned'
  ).length

  const fb = leads.filter((l) => l.source?.toLowerCase().includes('facebook')).length
  const gv = total - fb

  return (
    <div
      style={{
        background: 'rgba(13,16,28,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '8px 0.75rem',
        display: 'flex',
        gap: 7,
        overflowX: 'auto',
        flexShrink: 0,
        alignItems: 'stretch',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <StatCard label="Total"       value={total} />
      <StatCard label="New today"   value={newToday}  accent={newToday > 0 ? '#3fb950' : '#e6edf3'} />
      <StatCard label="Active"      value={active}    accent="#388bfd" />
      <StatCard label="Stale 10d+"  value={stale}     accent={stale > 0 ? '#e24b4a' : '#e6edf3'} />
      <StatCard label="Closing"     value={highValue} accent={highValue > 0 ? '#f0883e' : '#e6edf3'} />
      <StatCard label="Closed/mo"   value={closedMo}  accent={closedMo > 0 ? '#3fb950' : '#e6edf3'} />

      {isAdmin && unassigned > 0 && (
        <StatCard label="Unassigned" value={unassigned} accent="#e3b341" />
      )}

      {isAdmin && (
        <>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.07)', margin: '3px 3px', flexShrink: 0 }} />
          <StatCard label="FB"  value={fb} accent="#1877f2" />
          <StatCard label="GV"  value={gv} accent="#34a853" />
        </>
      )}
    </div>
  )
}
