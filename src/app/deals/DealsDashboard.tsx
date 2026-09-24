'use client'

import Link from 'next/link'
import { ArrowLeft, Building2, FileUp, HandCoins, Home } from 'lucide-react'
import { LanguageToggle, useI18n } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n/dictionary'
import styles from './deals.module.css'

type Doc = { name?: string; url?: string }
type Transaction = { id: number; type: string; property_address: string; city?: string; documents?: Doc[] | null; status?: string | null; created_at: string }
type Commission = { id: number; type: string; client_name: string; property_address: string; city?: string; net_commission: number | string; status?: string | null; created_at: string }
type Rental = { id: string; name: string | null; stage: string; budget: string | null; created_at: string }
type Sale = { id: number; client_name: string; client_type: string; stage: string; created_at: string }

const STATUS_TONE: Record<string, string> = {
  submitted: '#58a6ff', pending: '#e3b341', received: '#58a6ff', approved: '#3fb950', paid: '#3fb950', rejected: '#f85149',
}

function money(value: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0))
}

export function DealsDashboard({ transactions, commissions, rentals, sales }: {
  transactions: Transaction[]; commissions: Commission[]; rentals: Rental[]; sales: Sale[]
}) {
  const { t, lang, stage: stageName } = useI18n()
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const statusLabel = (status: string | null | undefined, fallback: string) => {
    const key = `deals.status.${(status || fallback).toLowerCase()}` as TranslationKey
    const label = t(key)
    return label === key ? (status || fallback) : label
  }
  const dealType = (type: string) => t(type === 'sale' ? 'deals.sale' : 'deals.rental')

  const actions = [
    { href: '/pipeline?new=1', icon: Home, tone: '#3fb950', title: t('deals.addRental'), hint: t('deals.addRentalHint') },
    { href: '/sales', icon: Building2, tone: '#a371f7', title: t('deals.addSale'), hint: t('deals.addSaleHint') },
    { href: '/transactions', icon: FileUp, tone: '#58a6ff', title: t('deals.submitDocs'), hint: t('deals.submitDocsHint') },
    { href: '/commission', icon: HandCoins, tone: '#f5a623', title: t('deals.requestCommission'), hint: t('deals.requestCommissionHint') },
  ]

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Link href="/pipeline"><ArrowLeft size={15}/> {t('nav.backToPipeline')}</Link>
        <LanguageToggle compact />
      </nav>

      <div className={styles.shell}>
        <header className={styles.head}>
          <h1>{t('deals.title')}</h1>
          <p>{t('deals.subtitle')}</p>
        </header>

        <div className={styles.actions}>
          {actions.map(({ href, icon: Icon, tone, title, hint }) => (
            <Link key={href} href={href} className={styles.action} style={{ '--tone': tone } as React.CSSProperties}>
              <span className={styles.actionIcon} aria-hidden="true"><Icon size={19}/></span>
              <span><strong>{title}</strong><span>{hint}</span></span>
            </Link>
          ))}
        </div>

        <div className={styles.grid}>
          <Panel title={t('deals.commissions')} count={commissions.length} empty={t('deals.none')}>
            {commissions.map(row => (
              <li key={row.id} className={styles.row}>
                <span className={styles.rowTitle}>{row.client_name} · {money(row.net_commission)}</span>
                <span className={styles.rowMeta}><span>{dealType(row.type)}</span><span>{row.property_address}</span><span>{date(row.created_at)}</span></span>
                <Status tone={STATUS_TONE[(row.status || 'pending').toLowerCase()]} label={statusLabel(row.status, 'pending')} />
              </li>
            ))}
          </Panel>

          <Panel title={t('deals.submissions')} count={transactions.length} empty={t('deals.none')}>
            {transactions.map(row => (
              <li key={row.id} className={styles.row}>
                <span className={styles.rowTitle}>{row.property_address}{row.city ? `, ${row.city}` : ''}</span>
                <span className={styles.rowMeta}>
                  <span>{dealType(row.type)}</span>
                  <span>{date(row.created_at)}</span>
                  {(row.documents ?? []).length > 0 && <span>{t('deals.docs', { n: (row.documents ?? []).length })}</span>}
                </span>
                <Status tone={STATUS_TONE[(row.status || 'submitted').toLowerCase()]} label={statusLabel(row.status, 'submitted')} />
              </li>
            ))}
          </Panel>

          <Panel title={`${t('deals.myRentals')} (${t('deals.selfGenerated')})`} count={rentals.length} empty={t('deals.none')}>
            {rentals.map(row => (
              <li key={row.id} className={styles.row}>
                <span className={styles.rowTitle}>{row.name ?? row.id}</span>
                <span className={styles.rowMeta}>{row.budget && <span>{row.budget}</span>}<span>{date(row.created_at)}</span><Link href="/pipeline">{t('deals.open')}</Link></span>
                <Status tone="#58a6ff" label={stageName(row.stage)} />
              </li>
            ))}
          </Panel>

          <Panel title={t('deals.mySales')} count={sales.length} empty={t('deals.none')}>
            {sales.map(row => (
              <li key={row.id} className={styles.row}>
                <span className={styles.rowTitle}>{row.client_name}</span>
                <span className={styles.rowMeta}><span style={{ textTransform: 'capitalize' }}>{row.client_type}</span><span>{date(row.created_at)}</span><Link href="/sales">{t('deals.open')}</Link></span>
                <Status tone="#a371f7" label={row.stage} />
              </li>
            ))}
          </Panel>
        </div>
      </div>
    </main>
  )
}

function Panel({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}><h2>{title}</h2><b>{count}</b></header>
      {count > 0 ? <ul className={styles.rows}>{children}</ul> : <div className={styles.empty}>{empty}</div>}
    </section>
  )
}

function Status({ tone = '#8b949e', label }: { tone?: string; label: string }) {
  return <span className={styles.status} style={{ '--tone': tone } as React.CSSProperties}>{label}</span>
}
