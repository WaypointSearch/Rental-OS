'use client'

import {
  AlarmClock, CalendarPlus, CheckCircle2, Eye, Flame, Handshake, Inbox, LucideIcon, Layers, UserX,
} from 'lucide-react'
import { ASSIGNMENT_TYPES, Lead } from '@/types/lead'
import styles from './board.module.css'
import { useI18n } from '@/lib/i18n'

interface StatsBarProps {
  leads: Lead[]
  isAdmin?: boolean
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = '#8b949e',
  highlight = false,
}: {
  label: string
  value: string | number
  icon: LucideIcon
  tone?: string
  /** Color the number too (used when the value needs attention) */
  highlight?: boolean
}) {
  return (
    <div className={styles.stat} style={{ '--tone': tone } as React.CSSProperties}>
      <span className={styles.statIcon} aria-hidden="true"><Icon size={15} /></span>
      <span className={`${styles.statValue} ${highlight ? styles.toned : ''}`}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

export function StatsBar({ leads, isAdmin = false }: StatsBarProps) {
  const { t } = useI18n()
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

  const full = leads.filter((l) => l.assignment_type === 'full').length
  const showing = leads.filter((l) => l.assignment_type === 'showing').length

  return (
    <div className={styles.stats} role="group" aria-label="Pipeline summary">
      <StatCard label={t('stats.total')}  value={total}     icon={Layers} />
      <StatCard label={t('stats.newToday')}    value={newToday}  icon={CalendarPlus} tone="#3fb950" highlight={newToday > 0} />
      <StatCard label={t('stats.active')}       value={active}    icon={Flame}        tone="#58a6ff" highlight />
      <StatCard label={t('stats.stale')}   value={stale}     icon={AlarmClock}   tone="#f85149" highlight={stale > 0} />
      <StatCard label={t('stats.closing')}      value={highValue} icon={Inbox}        tone="#f0883e" highlight={highValue > 0} />
      <StatCard label={t('stats.closedMonth')} value={closedMo} icon={CheckCircle2} tone="#3fb950" highlight={closedMo > 0} />

      {isAdmin && unassigned > 0 && (
        <StatCard label={t('stats.unassigned')} value={unassigned} icon={UserX} tone="#e3b341" highlight />
      )}

      {isAdmin && (
        <>
          <span className={styles.divider} aria-hidden="true" />
          <StatCard label={t('stats.full')} value={full} icon={Handshake} tone={ASSIGNMENT_TYPES.full.color} highlight={full > 0} />
          <StatCard label={t('stats.showing')} value={showing} icon={Eye} tone={ASSIGNMENT_TYPES.showing.color} highlight={showing > 0} />
          <span className={styles.divider} aria-hidden="true" />
          <StatCard label="Facebook" value={fb} icon={Inbox} tone="#1877f2" />
          <StatCard label="Google Voice" value={gv} icon={Inbox} tone="#34a853" />
        </>
      )}
    </div>
  )
}
