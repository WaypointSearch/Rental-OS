'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2, CheckCircle2, FileText, Home, Loader2, UploadCloud } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import styles from './transactions.module.css'

type DealType = 'rental' | 'sale'

type UploadedDocument = {
  name: string
  url: string
  size: number
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-140)
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function TransactionForm({ userId, userEmail }: { userId: string; userEmail: string }) {
  const supabase = useMemo(() => getSupabase(), [])
  const [type, setType] = useState<DealType | null>(null)
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('FL')
  const [zip, setZip] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function addFiles(incoming: FileList | null) {
    if (!incoming) return
    const next = Array.from(incoming)
    setFiles(previous => {
      const seen = new Set(previous.map(file => `${file.name}:${file.size}`))
      return [...previous, ...next.filter(file => !seen.has(`${file.name}:${file.size}`))].slice(0, 20)
    })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!type) return
    setError('')
    setBusy(true)

    try {
      const documents: UploadedDocument[] = []
      for (const file of files) {
        const path = `${userId}/${Date.now()}_${safeFileName(file.name)}`
        const { error: uploadError } = await supabase.storage
          .from('transaction-docs')
          .upload(path, file, { upsert: false, contentType: file.type || undefined })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('transaction-docs').getPublicUrl(path)
        documents.push({ name: file.name, url: data.publicUrl, size: file.size })
      }

      const { error: insertError } = await supabase.from('transactions').insert({
        agent_id: userId,
        agent_email: userEmail,
        type,
        property_address: address.trim(),
        city: city.trim(),
        state: state.trim() || 'FL',
        zip: zip.trim(),
        documents,
        status: 'submitted',
      })
      if (insertError) throw insertError

      setSuccess(true)
      setAddress('')
      setCity('')
      setState('FL')
      setZip('')
      setFiles([])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not submit the transaction.')
    } finally {
      setBusy(false)
    }
  }

  if (!type) {
    return (
      <main className={styles.page}>
        <section className={styles.shell}>
          <header className={styles.header}>
            <Link href="/pipeline" className={styles.back}><ArrowLeft size={16}/> Pipeline</Link>
            <div>
              <p className={styles.eyebrow}>Sun Ocean Realty · Agent Operations</p>
              <h1>Submit Transaction Documents</h1>
              <p className={styles.sub}>Choose the transaction type. Your name and email are attached automatically.</p>
            </div>
          </header>

          <div className={styles.typeGrid}>
            <button onClick={() => setType('rental')} className={styles.typeCard}>
              <span className={styles.typeIcon}><Home size={28}/></span>
              <strong>Rental</strong>
              <small>Lease, addenda, broker documents and final paperwork</small>
            </button>
            <button onClick={() => setType('sale')} className={styles.typeCard}>
              <span className={styles.typeIcon}><Building2 size={28}/></span>
              <strong>Sale</strong>
              <small>Executed contract, disclosures, addenda and closing documents</small>
            </button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <button className={styles.back} onClick={() => setType(null)}><ArrowLeft size={16}/> Change type</button>
          <div>
            <div className={styles.titleRow}>
              <h1>Submit Transaction Documents</h1>
              <span className={styles.badge}>{type}</span>
            </div>
            <p className={styles.sub}>This goes straight into the broker records center.</p>
          </div>
        </header>

        {success && (
          <div className={styles.success}>
            <CheckCircle2 size={20}/>
            <div><strong>Submitted successfully.</strong><span>The broker can now see this transaction in Records.</span></div>
          </div>
        )}

        <form onSubmit={submit} className={styles.form}>
          <section className={styles.card}>
            <div className={styles.cardTitle}><FileText size={17}/> Property</div>
            <label>Property address<input required value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St"/></label>
            <div className={styles.row3}>
              <label>City<input required value={city} onChange={e => setCity(e.target.value)} /></label>
              <label>State<input required value={state} onChange={e => setState(e.target.value.toUpperCase())} maxLength={2}/></label>
              <label>ZIP<input required value={zip} onChange={e => setZip(e.target.value)} inputMode="numeric"/></label>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}><UploadCloud size={17}/> Documents <span>{files.length || 'No'} selected</span></div>
            <label className={styles.dropzone} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(event.dataTransfer.files) }}>
              <UploadCloud size={28}/>
              <strong>Tap to upload or drop files here</strong>
              <small>PDF, Word, Excel and images · up to 20 files</small>
              <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" onChange={event => addFiles(event.target.files)}/>
            </label>

            {files.length > 0 && (
              <div className={styles.fileList}>
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className={styles.fileRow}>
                    <FileText size={15}/><span>{file.name}</span><small>{formatBytes(file.size)}</small>
                    <button type="button" onClick={() => setFiles(previous => previous.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {error && <div className={styles.error}>{error}</div>}
          <button className={styles.submit} disabled={busy}>{busy ? <><Loader2 size={17} className={styles.spin}/> Uploading & submitting…</> : 'Submit Documents'}</button>
          <Link href="/pipeline" className={styles.footerLink}>Back to rental pipeline</Link>
        </form>
      </section>
    </main>
  )
}
