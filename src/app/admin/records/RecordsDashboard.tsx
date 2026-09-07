'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Banknote, Download, FileText, Search, Trash2 } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import styles from './records.module.css'

type Doc = { name?: string; url?: string; size?: number }
type Transaction = {
  id: number; agent_email: string; type: string; property_address: string; city: string; state: string; zip: string;
  documents?: Doc[]; status?: string; notes?: string | null; created_at: string
}
type Commission = {
  id: number; agent_email: string; type: string; client_name: string; property_address: string; city: string; state: string; zip: string;
  net_commission: number | string; deposit_made: boolean; deposit_receipt_url?: string | null; no_deposit_reason?: string | null;
  final_documents?: Doc[]; payment_method: string; payment_details?: Record<string, unknown>; status?: string; notes?: string | null; created_at: string
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return
  const headers = Array.from(new Set(rows.flatMap(row => Object.keys(row))))
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const csv = [headers.map(escape).join(','), ...rows.map(row => headers.map(header => escape(row[header])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url)
}

function money(value: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0))
}

export function RecordsDashboard({ transactions: initialTransactions, commissions: initialCommissions }: { transactions: Transaction[]; commissions: Commission[] }) {
  const supabase = useMemo(() => getSupabase(), [])
  const [transactions, setTransactions] = useState(initialTransactions)
  const [commissions, setCommissions] = useState(initialCommissions)
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()

  const filteredTransactions = transactions.filter(row => !needle || [row.agent_email,row.property_address,row.city,row.type].some(v => String(v ?? '').toLowerCase().includes(needle)))
  const filteredCommissions = commissions.filter(row => !needle || [row.agent_email,row.client_name,row.property_address,row.city,row.type,row.status].some(v => String(v ?? '').toLowerCase().includes(needle)))

  async function remove(table: 'transactions' | 'commission_requests', id: number) {
    if (!window.confirm('Delete this record?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) { window.alert(error.message); return }
    if (table === 'transactions') setTransactions(rows => rows.filter(row => row.id !== id))
    else setCommissions(rows => rows.filter(row => row.id !== id))
  }

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <div><span className={styles.logo}>●</span><strong>Broker Records</strong><span className={styles.admin}>ADMIN</span></div>
        <div><Link href="/admin"><ArrowLeft size={14}/> God Mode</Link><Link href="/pipeline">Pipeline</Link></div>
      </nav>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div><p>Sun Ocean Realty · Broker Operations</p><h1>Transaction & Commission Records</h1><span>{transactions.length} transaction submission{transactions.length === 1 ? '' : 's'} · {commissions.length} commission request{commissions.length === 1 ? '' : 's'}</span></div>
          <label className={styles.search}><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search records…"/></label>
        </header>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div><FileText size={17}/><strong>Transaction Documents</strong><span>{filteredTransactions.length}</span></div>
            <button onClick={() => downloadCsv('transactions.csv', filteredTransactions.map(row => ({...row, documents: (row.documents ?? []).map(doc => doc.url).join(' | ')})))}><Download size={14}/> Export</button>
          </div>
          <div className={styles.stack}>
            {filteredTransactions.map(row => (
              <article key={row.id} className={styles.record}>
                <div className={styles.recordTop}><div><strong>{row.agent_email}</strong><span className={styles.type}>{row.type}</span></div><time>{new Date(row.created_at).toLocaleDateString()}</time></div>
                <h2>{row.property_address}</h2><p>{row.city}, {row.state} {row.zip}</p>
                {(row.documents ?? []).length > 0 && <div className={styles.docs}>{(row.documents ?? []).map((doc,index) => doc.url ? <a key={index} href={doc.url} target="_blank" rel="noreferrer">{doc.name || `Document ${index+1}`}</a> : null)}</div>}
                <button className={styles.delete} onClick={() => remove('transactions', row.id)}><Trash2 size={13}/> Delete</button>
              </article>
            ))}
            {!filteredTransactions.length && <div className={styles.empty}>No transaction records match this search.</div>}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div><Banknote size={17}/><strong>Commission Requests</strong><span>{filteredCommissions.length}</span></div>
            <button onClick={() => downloadCsv('commission-requests.csv', filteredCommissions.map(row => ({...row, payment_details: JSON.stringify(row.payment_details ?? {}), final_documents:(row.final_documents ?? []).map(doc => doc.url).join(' | ')})))}><Download size={14}/> Export</button>
          </div>
          <div className={styles.stack}>
            {filteredCommissions.map(row => (
              <article key={row.id} className={`${styles.record} ${styles.commission}`}>
                <div className={styles.recordTop}><div><strong>{row.agent_email}</strong><span className={styles.type}>{row.type}</span><span className={styles.status}>{row.status || 'pending'}</span></div><time>{new Date(row.created_at).toLocaleDateString()}</time></div>
                <h2>{row.client_name}</h2><p>{row.property_address} · {row.city}, {row.state} {row.zip}</p>
                <div className={styles.amount}>{money(row.net_commission)}</div>
                <div className={styles.meta}><span>Payment: <b>{row.payment_method?.replace(/_/g,' ')}</b></span><span>Deposit: <b>{row.deposit_made ? 'Yes' : 'No'}</b></span></div>
                {row.no_deposit_reason && <p className={styles.reason}>Reason: {row.no_deposit_reason}</p>}
                {row.deposit_receipt_url && <a className={styles.receipt} href={row.deposit_receipt_url} target="_blank" rel="noreferrer">View deposit receipt</a>}
                {(row.final_documents ?? []).length > 0 && <div className={styles.docs}>{(row.final_documents ?? []).map((doc,index) => doc.url ? <a key={index} href={doc.url} target="_blank" rel="noreferrer">{doc.name || `Final document ${index+1}`}</a> : null)}</div>}
                <button className={styles.delete} onClick={() => remove('commission_requests', row.id)}><Trash2 size={13}/> Delete</button>
              </article>
            ))}
            {!filteredCommissions.length && <div className={styles.empty}>No commission requests match this search.</div>}
          </div>
        </section>
      </section>
    </main>
  )
}
