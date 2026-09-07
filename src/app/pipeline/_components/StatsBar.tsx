'use client'

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileSignature,
  Layers3,
  UserRoundPlus,
} from 'lucide-react'
import { Lead } from '@/types/lead'

export type FocusKey =
  | 'all'
  | 'ready'
  | 'active'
  | 'showings'
  | 'applications'
  | 'closing'
  | 'stale'
  | 'closed'

interface StatsBarProps {
  leads: Lead[]
  isAdmin?: boolean
  focus: FocusKey
  onFocus: (focus: FocusKey) => void
}

function createdToday(lead: Lead) {
  const d = new Date(lead.created_at)
  const n = new Date()
  return d.getFullYear() === n.getFullYear()
    && d.getMonth() === n.getMonth()
    && d.getDate() === n.getDate()
}

function isStale(lead: Lead) {
  if (lead.stage === 'Move in / Deposit') return false
  const age = (Date.now() - new Date(lead.created_at).getTime()) / 86_400_000
  return age > 10
}

function isUnassigned(lead: Lead) {
  return !lead.assigned_agent || lead.assigned_agent === 'Unassigned'
}

export function StatsBar({ leads, isAdmin = false, focus, onFocus }: StatsBarProps) {
  const total = leads.length
  const newToday = leads.filter(createdToday).length
  const ready = leads.filter(l => l.stage === 'Waiting for contact' && (isAdmin ? isUnassigned(l) : true)).length
  const active = leads.filter(l => !['Waiting for contact', 'Move in / Deposit'].includes(l.stage)).length
  const showings = leads.filter(l => ['Set showings', 'Showings complete'].includes(l.stage)).length
  const applications = leads.filter(l => ['Completed Rentspree', 'Offer Sent'].includes(l.stage)).length
  const closing = leads.filter(l => ['Offer Sent', 'Offer Approved', 'HOA Approved'].includes(l.stage)).length
  const stale = leads.filter(isStale).length
  const closedMo = leads.filter(l => {
    if (l.stage !== 'Move in / Deposit') return false
    const d = new Date(l.created_at)
    const n = new Date()
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth()
  }).length

  const items = isAdmin
    ? [
        { key: 'all' as FocusKey, label: 'All leads', value: total, sub: `${newToday} new today`, accent: 'var(--ros-text)', icon: Layers3 },
        { key: 'ready' as FocusKey, label: 'Ready to assign', value: ready, sub: 'Qualified & unassigned', accent: 'var(--ros-brand)', icon: UserRoundPlus },
        { key: 'active' as FocusKey, label: 'Active', value: active, sub: 'Being worked', accent: 'var(--ros-blue)', icon: Activity },
        { key: 'closing' as FocusKey, label: 'Closing', value: closing, sub: 'Offer / approval', accent: 'var(--ros-green)', icon: FileSignature },
        { key: 'stale' as FocusKey, label: 'Needs attention', value: stale, sub: '10+ days open', accent: 'var(--ros-red)', icon: AlertTriangle },
        { key: 'closed' as FocusKey, label: 'Closed this mo.', value: closedMo, sub: 'Move in / deposit', accent: 'var(--ros-green)', icon: CheckCircle2 },
      ]
    : [
        { key: 'all' as FocusKey, label: 'My leads', value: total, sub: `${newToday} new today`, accent: 'var(--ros-text)', icon: Layers3 },
        { key: 'ready' as FocusKey, label: 'Need contact', value: ready, sub: 'Call these first', accent: 'var(--ros-brand)', icon: UserRoundPlus },
        { key: 'showings' as FocusKey, label: 'Showings', value: showings, sub: 'Booked / completed', accent: 'var(--ros-purple)', icon: ClipboardCheck },
        { key: 'applications' as FocusKey, label: 'Applications', value: applications, sub: 'Rentspree / offer', accent: 'var(--ros-yellow)', icon: FileSignature },
        { key: 'closing' as FocusKey, label: 'Closing', value: closing, sub: 'Offer / approval', accent: 'var(--ros-green)', icon: Activity },
        { key: 'closed' as FocusKey, label: 'Closed this mo.', value: closedMo, sub: 'Move in / deposit', accent: 'var(--ros-green)', icon: CheckCircle2 },
      ]

  return (
    <div className="ros-stats" aria-label="Lead work queues">
      {items.map(item => {
        const Icon = item.icon
        return (
          <button
            key={item.key}
            type="button"
            className={`ros-stat ${focus === item.key ? 'is-active' : ''}`}
            onClick={() => onFocus(item.key)}
            style={{ '--stat-accent': item.accent } as React.CSSProperties}
          >
            <div className="ros-stat-label"><Icon size={12} strokeWidth={2} />{item.label}</div>
            <div className="ros-stat-value">{item.value}</div>
            <div className="ros-stat-sub">{item.sub}</div>
          </button>
        )
      })}
    </div>
  )
}
