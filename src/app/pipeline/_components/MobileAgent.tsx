'use client'

import Link from 'next/link'
import { formatDistanceToNowStrict } from 'date-fns'
import { ArrowRight, FileUp, HandCoins, LayoutList, MessageSquare, Phone, Plus, Search, UserRound } from 'lucide-react'
import { Lead, STAGES, STAGE_COLORS } from '@/types/lead'
import styles from './mobile.module.css'

export function nextStage(stage: string): string | null {
  const index = STAGES.indexOf(stage as (typeof STAGES)[number])
  return index >= 0 && index < STAGES.length - 1 ? STAGES[index + 1] : null
}

function digits(phone: string | null) {
  return (phone ?? '').replace(/[^\d+]/g, '')
}

export function MobileLeadsHeader({
  total, visible, query, stage, leads, onQuery, onStage,
}: {
  total: number
  visible: number
  query: string
  stage: string
  leads: Lead[]
  onQuery: (value: string) => void
  onStage: (value: string) => void
}) {
  const counts = STAGES.map(s => [s, leads.filter(l => l.stage === s).length] as const)
  return (
    <>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>My Leads</h1>
          <span className={styles.count} aria-live="polite">{visible === total ? `${total} total` : `${visible} of ${total}`}</span>
        </div>
        <label className={styles.search}>
          <span className="sr-only">Search leads</span>
          <Search size={17} aria-hidden="true"/>
          <input type="search" value={query} onChange={e => onQuery(e.target.value)} placeholder="Search name, phone, area, MLS…" aria-label="Search leads" enterKeyHint="search"/>
        </label>
      </div>
      <div className={styles.chips} role="group" aria-label="Filter leads by stage">
        <button type="button" className={styles.chip} aria-pressed={stage === 'all'} onClick={() => onStage('all')}>All <b>{leads.length}</b></button>
        {counts.map(([s, n]) => (
          <button type="button" key={s} className={styles.chip} aria-pressed={stage === s} onClick={() => onStage(stage === s ? 'all' : s)}>
            {s} <b>{n}</b>
          </button>
        ))}
      </div>
    </>
  )
}

export function MobileLeadList({
  leads, onOpen, onAdvance, emptyText, ...rest
}: {
  [attribute: string]: unknown
  leads: Lead[]
  onOpen: (lead: Lead) => void
  onAdvance: (lead: Lead, stage: string) => void
  emptyText: string
}) {
  return (
    <div className={styles.list} role="list" aria-label="Leads" {...rest}>
      {leads.map(lead => {
        const accent = STAGE_COLORS[lead.stage] ?? '#6e7681'
        const next = nextStage(lead.stage)
        const tel = digits(lead.phone)
        const name = lead.name ?? 'Unnamed lead'
        return (
          <article
            key={lead.id}
            role="listitem"
            className={styles.card}
            style={{ '--accent': accent } as React.CSSProperties}
            data-lead-id={lead.id}
            data-stage={lead.stage}
            aria-label={`${name}, stage ${lead.stage}`}
          >
            <button type="button" className={styles.open} onClick={() => onOpen(lead)} aria-label={`Open lead ${name}`}>
              <div className={styles.nameRow}>
                <span className={styles.name}>{name}</span>
                <span className={styles.age}>{formatDistanceToNowStrict(new Date(lead.created_at), { addSuffix: true })}</span>
              </div>
              <div className={styles.stage}>{lead.stage}</div>
              <div className={styles.facts}>
                {lead.budget && <span>{lead.budget}</span>}
                {lead.bedrooms && <span>{lead.bedrooms} bd{lead.bathrooms ? ` / ${lead.bathrooms} ba` : ''}</span>}
                {lead.move_in && <span>Move-in {lead.move_in}</span>}
                {lead.pets && <span>{lead.pets}</span>}
              </div>
              {lead.area && <div className={styles.area}>{lead.area}</div>}
            </button>
            <div className={styles.actions}>
              {tel
                ? <a className={styles.action} href={`tel:${tel}`} aria-label={`Call ${name}`}><Phone size={16} aria-hidden="true"/> Call</a>
                : <span className={styles.action} aria-disabled="true"><Phone size={16} aria-hidden="true"/> Call</span>}
              {tel
                ? <a className={styles.action} href={`sms:${tel}`} aria-label={`Text ${name}`}><MessageSquare size={16} aria-hidden="true"/> Text</a>
                : <span className={styles.action} aria-disabled="true"><MessageSquare size={16} aria-hidden="true"/> Text</span>}
              <button
                type="button"
                className={`${styles.action} ${styles.next}`}
                disabled={!next}
                onClick={() => next && onAdvance(lead, next)}
                aria-label={next ? `Move ${name} to ${next}` : `${name} is at the final stage`}
                title={next ? `Move to ${next}` : 'Final stage'}
              >
                {next ? <>Next <ArrowRight size={15} aria-hidden="true"/></> : 'Done'}
              </button>
            </div>
          </article>
        )
      })}
      {leads.length === 0 && <div className={styles.empty}>{emptyText}</div>}
    </div>
  )
}

export function MobileTabBar({ onNewLead }: { onNewLead: () => void }) {
  return (
    <nav className={styles.tabbar} aria-label="Agent menu">
      <Link href="/pipeline" className={styles.tab} aria-current="page"><LayoutList size={21} aria-hidden="true"/><span>Leads</span></Link>
      <Link href="/transactions" className={styles.tab}><FileUp size={21} aria-hidden="true"/><span>Docs</span></Link>
      <button type="button" className={`${styles.tab} ${styles.tabNew}`} onClick={onNewLead} aria-label="Add a new lead"><span><Plus size={20} aria-hidden="true"/></span><span>New</span></button>
      <Link href="/commission" className={styles.tab}><HandCoins size={21} aria-hidden="true"/><span>Commission</span></Link>
      <Link href="/profile" className={styles.tab}><UserRound size={21} aria-hidden="true"/><span>Profile</span></Link>
    </nav>
  )
}
