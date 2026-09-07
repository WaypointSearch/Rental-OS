'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Banknote, Building2, CheckCircle2, FileText, Home, Loader2, Receipt, UploadCloud } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import styles from './commission.module.css'

type DealType = 'rental' | 'sale'
type PaymentMethod = 'zelle' | 'printable_check' | 'ach' | 'wire'

type UploadedDocument = { name: string; url: string; size: number }

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-140)
}

async function uploadFiles(
  files: File[],
  userId: string,
  prefix: string,
  supabase: ReturnType<typeof getSupabase>,
) {
  const output: UploadedDocument[] = []
  for (const file of files) {
    const path = `commission/${userId}/${prefix}/${Date.now()}_${safeFileName(file.name)}`
    const { error } = await supabase.storage.from('transaction-docs').upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    })
    if (error) throw error
    const { data } = supabase.storage.from('transaction-docs').getPublicUrl(path)
    output.push({ name: file.name, url: data.publicUrl, size: file.size })
  }
  return output
}

export function CommissionForm({ userId, userEmail }: { userId: string; userEmail: string }) {
  const supabase = useMemo(() => getSupabase(), [])
  const [type, setType] = useState<DealType>('rental')
  const [clientName, setClientName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('FL')
  const [zip, setZip] = useState('')
  const [amount, setAmount] = useState('')
  const [depositMade, setDepositMade] = useState<boolean | null>(null)
  const [depositReceipt, setDepositReceipt] = useState<File | null>(null)
  const [noDepositReason, setNoDepositReason] = useState('')
  const [finalDocs, setFinalDocs] = useState<File[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('zelle')
  const [zelleValue, setZelleValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function addFinalDocs(list: FileList | null) {
    if (!list) return
    setFinalDocs(previous => [...previous, ...Array.from(list)].slice(0, 20))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess(false)

    const numericAmount = Number(amount.replace(/[$,\s]/g, ''))
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Enter a valid expected net commission amount.')
      return
    }
    if (depositMade === null) {
      setError('Tell us whether the commission was deposited into the brokerage account.')
      return
    }
    if (!depositMade && !noDepositReason.trim()) {
      setError('Please explain why there is no brokerage deposit yet.')
      return
    }
    if (paymentMethod === 'zelle' && !zelleValue.trim()) {
      setError('Enter the phone number or email you want used for Zelle.')
      return
    }

    setBusy(true)
    try {
      let depositReceiptUrl: string | null = null
      if (depositReceipt) {
        const uploaded = await uploadFiles([depositReceipt], userId, 'deposit', supabase)
        depositReceiptUrl = uploaded[0]?.url ?? null
      }
      const uploadedFinalDocs = await uploadFiles(finalDocs, userId, 'final', supabase)

      const paymentDetails = paymentMethod === 'zelle'
        ? { zelle: zelleValue.trim() }
        : { instructions: 'Broker will coordinate secure banking/payment details directly.' }

      const { error: insertError } = await supabase.from('commission_requests').insert({
        agent_id: userId,
        agent_email: userEmail,
        type,
        client_name: clientName.trim(),
        property_address: address.trim(),
        city: city.trim(),
        state: state.trim() || 'FL',
        zip: zip.trim(),
        net_commission: numericAmount,
        deposit_made: depositMade,
        deposit_receipt_url: depositReceiptUrl,
        no_deposit_reason: depositMade ? null : noDepositReason.trim(),
        final_documents: uploadedFinalDocs,
        payment_method: paymentMethod,
        payment_details: paymentDetails,
        status: 'pending',
      })
      if (insertError) throw insertError

      setSuccess(true)
      setClientName('')
      setAddress('')
      setCity('')
      setState('FL')
      setZip('')
      setAmount('')
      setDepositMade(null)
      setDepositReceipt(null)
      setNoDepositReason('')
      setFinalDocs([])
      setZelleValue('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not submit your commission request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <Link href="/pipeline" className={styles.back}><ArrowLeft size={16}/> Pipeline</Link>
          <div>
            <p className={styles.eyebrow}>Sun Ocean Realty · Agent Operations</p>
            <h1>Request Commission</h1>
            <p>Submit the transaction details and choose how you want to be paid.</p>
          </div>
        </header>

        {success && (
          <div className={styles.success}>
            <CheckCircle2 size={21}/>
            <div><strong>Commission request submitted.</strong><span>It is now visible in the broker Records center.</span></div>
          </div>
        )}

        <form onSubmit={submit} className={styles.form}>
          <section className={styles.card}>
            <div className={styles.segmentLabel}>Transaction type</div>
            <div className={styles.segment}>
              <button type="button" className={type === 'rental' ? styles.active : ''} onClick={() => setType('rental')}><Home size={16}/> Rental</button>
              <button type="button" className={type === 'sale' ? styles.active : ''} onClick={() => setType('sale')}><Building2 size={16}/> Sale</button>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}><FileText size={17}/> Client & property</div>
            <label>Client name<input required value={clientName} onChange={e => setClientName(e.target.value)} placeholder="John Smith"/></label>
            <label>Property address<input required value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St"/></label>
            <div className={styles.row3}>
              <label>City<input required value={city} onChange={e => setCity(e.target.value)}/></label>
              <label>State<input required value={state} onChange={e => setState(e.target.value.toUpperCase())} maxLength={2}/></label>
              <label>ZIP<input required value={zip} onChange={e => setZip(e.target.value)} inputMode="numeric"/></label>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}><Banknote size={17}/> Expected net commission</div>
            <label>Amount<input required value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="$ 0.00"/></label>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}><Receipt size={17}/> Brokerage deposit</div>
            <p className={styles.hint}>Did you deposit or deliver the commission into the Sun Ocean Realty account?</p>
            <div className={styles.segment}>
              <button type="button" className={depositMade === true ? styles.activeGreen : ''} onClick={() => setDepositMade(true)}>Yes</button>
              <button type="button" className={depositMade === false ? styles.activeDanger : ''} onClick={() => setDepositMade(false)}>No</button>
            </div>
            {depositMade === true && (
              <label className={styles.uploadMini}><UploadCloud size={18}/><span>{depositReceipt ? depositReceipt.name : 'Upload deposit receipt (optional)'}</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e => setDepositReceipt(e.target.files?.[0] ?? null)}/></label>
            )}
            {depositMade === false && (
              <label>Reason<textarea required value={noDepositReason} onChange={e => setNoDepositReason(e.target.value)} placeholder="Example: listing brokerage is mailing the check directly to the office."/></label>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}><UploadCloud size={17}/> Final documents <span>optional</span></div>
            <label className={styles.dropzone}>
              <UploadCloud size={25}/><strong>Tap to upload final documents</strong><small>Executed lease/contract, addenda, receipts, closing docs</small>
              <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" onChange={e => addFinalDocs(e.target.files)}/>
            </label>
            {finalDocs.length > 0 && <div className={styles.fileCount}>{finalDocs.length} file{finalDocs.length === 1 ? '' : 's'} ready to upload</div>}
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}><Banknote size={17}/> How would you like to get paid?</div>
            <div className={styles.paymentGrid}>
              {([
                ['zelle', 'Zelle', '$2,500 max'],
                ['printable_check', 'Email Printable Check', 'Print or mobile deposit'],
                ['ach', 'ACH Direct Deposit', 'Broker coordinates securely'],
                ['wire', 'Bank Wire', '$35 fee'],
              ] as const).map(([value, label, caption]) => (
                <button key={value} type="button" className={paymentMethod === value ? styles.paymentActive : ''} onClick={() => setPaymentMethod(value)}>
                  <strong>{label}</strong><small>{caption}</small>
                </button>
              ))}
            </div>
            {paymentMethod === 'zelle' ? (
              <label>Zelle phone or email<input value={zelleValue} onChange={e => setZelleValue(e.target.value)} placeholder="9545551212 or agent@email.com"/></label>
            ) : (
              <div className={styles.secureNote}>For security, bank account or routing numbers are not stored here. The broker will coordinate those details directly after approval.</div>
            )}
          </section>

          {error && <div className={styles.error}>{error}</div>}
          <button className={styles.submit} disabled={busy}>{busy ? <><Loader2 size={17} className={styles.spin}/> Submitting…</> : 'Request Commission'}</button>
        </form>
      </section>
    </main>
  )
}
