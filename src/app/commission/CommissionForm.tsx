'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Banknote, Building2, CheckCircle2, FileText, Home, Loader2, Receipt, UploadCloud } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import styles from './commission.module.css'
import { useI18n } from '@/lib/i18n'

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
  const { t } = useI18n()
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
      setError(t('cm.errAmount'))
      return
    }
    if (depositMade === null) {
      setError(t('cm.errDeposit'))
      return
    }
    if (!depositMade && !noDepositReason.trim()) {
      setError(t('cm.errReason'))
      return
    }
    if (paymentMethod === 'zelle' && !zelleValue.trim()) {
      setError(t('cm.errZelle'))
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
      setError(caught instanceof Error ? caught.message : t('cm.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <Link href="/deals" className={styles.back}><ArrowLeft size={16}/> {t('nav.myDeals')}</Link>
          <div>
            <p className={styles.eyebrow}>{t('tx.eyebrow')}</p>
            <h1>{t('nav.requestCommission')}</h1>
            <p>{t('cm.sub')}</p>
          </div>
        </header>

        {success && (
          <div className={styles.success}>
            <CheckCircle2 size={21}/>
            <div><strong>{t('cm.success')}</strong><span>{t('cm.successHint')}</span></div>
          </div>
        )}

        <form onSubmit={submit} className={styles.form}>
          <section className={styles.card}>
            <div className={styles.segmentLabel}>{t('cm.type')}</div>
            <div className={styles.segment}>
              <button type="button" className={type === 'rental' ? styles.active : ''} onClick={() => setType('rental')}><Home size={16}/> {t('deals.rental')}</button>
              <button type="button" className={type === 'sale' ? styles.active : ''} onClick={() => setType('sale')}><Building2 size={16}/> {t('deals.sale')}</button>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}><FileText size={17}/> {t('cm.clientProperty')}</div>
            <label>{t('cm.clientName')}<input required value={clientName} onChange={e => setClientName(e.target.value)} placeholder="John Smith"/></label>
            <label>{t('tx.address')}<input required value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St"/></label>
            <div className={styles.row3}>
              <label>{t('tx.city')}<input required value={city} onChange={e => setCity(e.target.value)}/></label>
              <label>{t('tx.state')}<input required value={state} onChange={e => setState(e.target.value.toUpperCase())} maxLength={2}/></label>
              <label>{t('tx.zip')}<input required value={zip} onChange={e => setZip(e.target.value)} inputMode="numeric"/></label>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}><Banknote size={17}/> {t('cm.expected')}</div>
            <label>{t('cm.amount')}<input required value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="$ 0.00"/></label>
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}><Receipt size={17}/> {t('cm.deposit')}</div>
            <p className={styles.hint}>{t('cm.depositQ')}</p>
            <div className={styles.segment}>
              <button type="button" className={depositMade === true ? styles.activeGreen : ''} onClick={() => setDepositMade(true)}>{t('cm.yes')}</button>
              <button type="button" className={depositMade === false ? styles.activeDanger : ''} onClick={() => setDepositMade(false)}>{t('cm.no')}</button>
            </div>
            {depositMade === true && (
              <label className={styles.uploadMini}><UploadCloud size={18}/><span>{depositReceipt ? depositReceipt.name : t('cm.receipt')}</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e => setDepositReceipt(e.target.files?.[0] ?? null)}/></label>
            )}
            {depositMade === false && (
              <label>{t('cm.reason')}<textarea required value={noDepositReason} onChange={e => setNoDepositReason(e.target.value)} placeholder={t('cm.reasonPlaceholder')}/></label>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}><UploadCloud size={17}/> {t('cm.finalDocs')} <span>{t('cm.optional')}</span></div>
            <label className={styles.dropzone}>
              <UploadCloud size={25}/><strong>{t('cm.finalDrop')}</strong><small>{t('cm.finalHint')}</small>
              <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" onChange={e => addFinalDocs(e.target.files)}/>
            </label>
            {finalDocs.length > 0 && <div className={styles.fileCount}>{t('cm.ready', { n: finalDocs.length })}</div>}
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitle}><Banknote size={17}/> {t('cm.howPaid')}</div>
            <div className={styles.paymentGrid}>
              {([
                ['zelle', 'Zelle', t('cm.zelleHint')],
                ['printable_check', t('cm.check'), t('cm.checkHint')],
                ['ach', t('cm.ach'), t('cm.achHint')],
                ['wire', t('cm.wire'), t('cm.wireHint')],
              ] as [PaymentMethod, string, string][]).map(([value, label, caption]) => (
                <button key={value} type="button" className={paymentMethod === value ? styles.paymentActive : ''} onClick={() => setPaymentMethod(value)}>
                  <strong>{label}</strong><small>{caption}</small>
                </button>
              ))}
            </div>
            {paymentMethod === 'zelle' ? (
              <label>{t('cm.zelle')}<input value={zelleValue} onChange={e => setZelleValue(e.target.value)} placeholder={t('cm.zellePlaceholder')}/></label>
            ) : (
              <div className={styles.secureNote}>{t('cm.secure')}</div>
            )}
          </section>

          {error && <div className={styles.error}>{error}</div>}
          <button className={styles.submit} disabled={busy}>{busy ? <><Loader2 size={17} className={styles.spin}/> {t('cm.submitting')}</> : t('nav.requestCommission')}</button>
        </form>
      </section>
    </main>
  )
}
