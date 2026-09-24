'use client'

import Link from 'next/link'
import { formatDistanceToNowStrict } from 'date-fns'
import { es as esLocale } from 'date-fns/locale'
import { ArrowRight, BriefcaseBusiness, Building2, LayoutList, MessageSquare, Phone, Plus, Search, UserRound } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { Lead, STAGES, STAGE_COLORS } from '@/types/lead'
import styles from './mobile.module.css'
import { AssignmentTypeBadge } from './AssignmentTypeBadge'

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
  const { t, stage: stageName } = useI18n()
  const counts = STAGES.map(s => [s, leads.filter(l => l.stage === s).length] as const)
  return (
    <>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{t('m.myLeads')}</h1>
          <span className={styles.count} aria-live="polite">{visible === total ? t('m.total', { n: total }) : t('m.ofTotal', { visible, total })}</span>
        </div>
        <label className={styles.search}>
          <span className="sr-only">{t('m.searchLabel')}</span>
          <Search size={17} aria-hidden="true"/>
          <input type="search" value={query} onChange={e => onQuery(e.target.value)} placeholder={t('m.search')} aria-label={t('m.searchLabel')} enterKeyHint="search"/>
        </label>
      </div>
      <div className={styles.chips} role="group" aria-label={t('m.filterByStage')}>
        <button type="button" className={styles.chip} aria-pressed={stage === 'all'} onClick={() => onStage('all')}>{t('m.all')} <b>{leads.length}</b></button>
        {counts.map(([s, n]) => (
          <button type="button" key={s} className={styles.chip} aria-pressed={stage === s} onClick={() => onStage(stage === s ? 'all' : s)}>
            {stageName(s)} <b>{n}</b>
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
  const { t, lang, stage: stageName, option } = useI18n()
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
                <span className={styles.age}>{formatDistanceToNowStrict(new Date(lead.created_at), { addSuffix: true, locale: lang === 'es' ? esLocale : undefined })}</span>
              </div>
              <div className={styles.stageRow}>
                <span className={styles.stage}>{stageName(lead.stage)}</span>
                <AssignmentTypeBadge type={lead.assignment_type} long />
              </div>
              <div className={styles.facts}>
                {lead.budget && <span>{lead.budget}</span>}
                {lead.bedrooms && <span>{lead.bedrooms} bd{lead.bathrooms ? ` / ${lead.bathrooms} ba` : ''}</span>}
                {lead.move_in && <span>{t('m.moveIn', { date: lead.move_in })}</span>}
                {lead.pets && <span>{option(lead.pets)}</span>}
              </div>
              {lead.area && <div className={styles.area}>{lead.area}</div>}
            </button>
            <div className={styles.actions}>
              {tel
                ? <a className={styles.action} href={`tel:${tel}`} aria-label={`Call ${name}`}><Phone size={16} aria-hidden="true"/> {t('m.call')}</a>
                : <span className={styles.action} aria-disabled="true"><Phone size={16} aria-hidden="true"/> {t('m.call')}</span>}
              {tel
                ? <a className={styles.action} href={`sms:${tel}`} aria-label={`Text ${name}`}><MessageSquare size={16} aria-hidden="true"/> {t('m.text')}</a>
                : <span className={styles.action} aria-disabled="true"><MessageSquare size={16} aria-hidden="true"/> {t('m.text')}</span>}
              <button
                type="button"
                className={`${styles.action} ${styles.next}`}
                disabled={!next}
                onClick={() => next && onAdvance(lead, next)}
                aria-label={next ? `Move ${name} to ${next}` : `${name} is at the final stage`}
                title={next ? `Move to ${next}` : 'Final stage'}
              >
                {next ? <>{t('m.next')} <ArrowRight size={15} aria-hidden="true"/></> : t('m.done')}
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
  const { t } = useI18n()
  return (
    <nav className={styles.tabbar} aria-label={t('tab.menu')}>
      <Link href="/pipeline" className={styles.tab} aria-current="page"><LayoutList size={21} aria-hidden="true"/><span>{t('tab.leads')}</span></Link>
      <Link href="/sales" className={styles.tab}><Building2 size={21} aria-hidden="true"/><span>{t('nav.sales')}</span></Link>
      <button type="button" className={`${styles.tab} ${styles.tabNew}`} onClick={onNewLead} aria-label={t('tab.addLead')}><span><Plus size={20} aria-hidden="true"/></span><span>{t('tab.new')}</span></button>
      <Link href="/deals" className={styles.tab}><BriefcaseBusiness size={21} aria-hidden="true"/><span>{t('tab.deals')}</span></Link>
      <Link href="/profile" className={styles.tab}><UserRound size={21} aria-hidden="true"/><span>{t('tab.profile')}</span></Link>
    </nav>
  )
}
