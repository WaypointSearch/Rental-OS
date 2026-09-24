'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Camera, UserRound } from 'lucide-react'
import {
  AgentProfile,
  Availability,
  DAYS,
  DEFAULT_AVAILABILITY,
  DayKey,
} from '@/types/agent'
import { getSupabase } from '@/lib/supabase'
import { LanguageToggle, useI18n } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n/dictionary'
import styles from '../profile.module.css'


const COMMON_LANGUAGES = [
  'English', 'Spanish', 'Portuguese', 'Haitian Creole', 'French',
  'Russian', 'Italian', 'Hebrew', 'German', 'Mandarin', 'Arabic',
]

function normalizedLanguages(value?: string[] | null): string[] {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()) : []
}

function normalizedAvailability(value?: Availability | null): Availability {
  const source = value ?? DEFAULT_AVAILABILITY
  return DAYS.reduce((next, day) => {
    next[day] = {
      ...DEFAULT_AVAILABILITY[day],
      ...(source?.[day] ?? {}),
    }
    return next
  }, {} as Availability)
}

function initials(name: string, email: string) {
  const source = name.trim() || email.split('@')[0] || 'SO'
  return source.split(/\s+/).map(part => part[0] || '').join('').slice(0, 2).toUpperCase()
}

export function AgentProfileForm({
  profile,
  userId,
  userEmail,
}: {
  profile: AgentProfile | null
  userId: string
  userEmail: string
}) {
  const supabase = useMemo(() => getSupabase(), [])
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [alertPhone, setAlertPhone] = useState(profile?.alert_phone ?? '')
  const [licenseNumber, setLicenseNumber] = useState(profile?.license_number ?? '')
  const [showingAreas, setShowingAreas] = useState(profile?.showing_areas ?? '')
  const [leadPreference, setLeadPreference] = useState(profile?.lead_preference ?? 'both')
  const [mlsAffiliation, setMlsAffiliation] = useState(profile?.mls_affiliation ?? 'no_mls')
  const [languages, setLanguages] = useState<string[]>(() => normalizedLanguages(profile?.languages))
  const [languageDraft, setLanguageDraft] = useState('')
  const [availability, setAvailability] = useState<Availability>(() => normalizedAvailability(profile?.availability))
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  async function uploadAvatar(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setNotice(null)
    try {
      const path = `avatars/${userId}.jpg`
      const { error } = await supabase.storage.from('avatars').upload(path, file, {
        upsert: true,
        contentType: file.type || 'image/jpeg',
      })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const permanentUrl = data.publicUrl
      await supabase.from('agent_profiles').update({ avatar_url: permanentUrl }).eq('id', userId)
      setAvatarUrl(`${permanentUrl}?t=${Date.now()}`)
      setNotice({ kind: 'success', text: t('profile.photoUpdated') })
    } catch (caught) {
      setNotice({ kind: 'error', text: caught instanceof Error ? caught.message : t('profile.photoFailed') })
    } finally {
      setUploading(false)
    }
  }

  function toggleLanguage(language: string) {
    setLanguages(previous => previous.some(item => item.toLowerCase() === language.toLowerCase())
      ? previous.filter(item => item.toLowerCase() !== language.toLowerCase())
      : [...previous, language])
  }

  function addLanguage() {
    const language = languageDraft.trim().replace(/\s+/g, ' ')
    if (!language) return
    if (!languages.some(item => item.toLowerCase() === language.toLowerCase())) {
      setLanguages(previous => [...previous, language])
    }
    setLanguageDraft('')
  }

  function toggleDay(day: DayKey) {
    setAvailability(previous => ({
      ...previous,
      [day]: { ...previous[day], active: !previous[day].active },
    }))
  }

  function setTime(day: DayKey, field: 'start' | 'end', value: string) {
    setAvailability(previous => ({
      ...previous,
      [day]: { ...previous[day], [field]: value },
    }))
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setNotice(null)
    if (!fullName.trim()) {
      setNotice({ kind: 'error', text: t('profile.errName') })
      return
    }
    if (!licenseNumber.trim()) {
      setNotice({ kind: 'error', text: t('profile.errLicense') })
      return
    }
    if (alertPhone.replace(/\D/g, '').length < 10) {
      setNotice({ kind: 'error', text: t('profile.errPhone') })
      return
    }

    setSaving(true)
    const values = {
      full_name: fullName.trim(),
      alert_phone: alertPhone.trim() || null,
      license_number: licenseNumber.trim(),
      showing_areas: showingAreas.trim() || null,
      lead_preference: leadPreference,
      mls_affiliation: mlsAffiliation,
      // Assignments are emailed; the broker's AI texts agents from its own phone system
      alert_preference: 'email' as const,
      availability,
      languages,
    }

    const write = (payload: Partial<typeof values>) => profile
      ? supabase.from('agent_profiles').update(payload).eq('id', userId)
      : supabase.from('agent_profiles').insert({ id: userId, email: userEmail, is_admin: false, ...payload })

    let result = await write(values)
    let languagesSkipped = false
    // Environments that have not run supabase-agent-languages.sql yet lack the column;
    // save everything else instead of failing the whole profile.
    if (result.error && /languages/i.test(result.error.message)) {
      const withoutLanguages: Partial<typeof values> = { ...values }
      delete withoutLanguages.languages
      result = await write(withoutLanguages)
      languagesSkipped = !result.error
    }

    if (result.error) setNotice({ kind: 'error', text: result.error.message })
    else if (languagesSkipped) setNotice({ kind: 'error', text: t('profile.savedNoLanguages') })
    else setNotice({ kind: 'success', text: t('profile.saved') })
    setSaving(false)
  }

  const displayName = fullName.trim() || userEmail.split('@')[0]

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <strong><span className={styles.mark}><UserRound size={15}/></span> {t('profile.title')}</strong>
        <Link href="/pipeline"><ArrowLeft size={13}/> {t('nav.backToPipeline')}</Link>
      </nav>

      <section className={styles.shell}>
        <div className={styles.hero}>
          <label className={styles.avatar} title="Upload profile photo">
            {avatarUrl ? <img src={avatarUrl} alt=""/> : initials(fullName, userEmail)}
            <input ref={fileRef} type="file" accept="image/*" onChange={event => void uploadAvatar(event.target.files?.[0])}/>
          </label>
          <div className={styles.heroText}>
            <h1>{displayName}</h1>
            <p>{userEmail}</p>
            <button type="button" className={styles.upload} onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Camera size={12}/> {uploading ? t('lead.uploading') : t('profile.upload')}
            </button>
          </div>
        </div>

        <form className={styles.form} onSubmit={save}>
          <section className={styles.card}>
            <div className={styles.cardHead}><strong>{t('profile.info')}</strong><span>{t('profile.infoHint')}</span></div>
            <div className={styles.grid2}>
              <div className={styles.field}><label>{t('profile.fullName')} <span className={styles.required}>{t('profile.required')}</span></label><input value={fullName} onChange={event => setFullName(event.target.value)}/></div>
              <div className={`${styles.field} ${styles.readonly}`}><label>{t('profile.email')}</label><input value={userEmail} readOnly/></div>
              <div className={styles.field}><label>{t('profile.phone')} <span className={styles.required}>{t('profile.required')}</span></label><input type="tel" value={alertPhone} onChange={event => setAlertPhone(event.target.value)} placeholder="9545551212"/></div>
              <div className={styles.field}><label>{t('profile.license')} <span className={styles.required}>{t('profile.required')}</span></label><input value={licenseNumber} onChange={event => setLicenseNumber(event.target.value)} placeholder="SL1234567"/></div>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}><strong>{t('profile.mls')}</strong><span>{t('profile.mlsHint')}</span></div>
            <div className={styles.choices}>
              <button type="button" className={`${styles.choice} ${mlsAffiliation === 'miami_mls' ? styles.activeBlue : ''}`} onClick={() => setMlsAffiliation('miami_mls')}><strong>Miami MLS</strong><small>{t('profile.miamiHint')}</small></button>
              <button type="button" className={`${styles.choice} ${mlsAffiliation === 'beaches_mls' ? styles.activeGreen : ''}`} onClick={() => setMlsAffiliation('beaches_mls')}><strong>Beaches MLS</strong><small>Broward / Palm Beach</small></button>
              <button type="button" className={`${styles.choice} ${mlsAffiliation === 'no_mls' ? styles.activeGold : ''}`} onClick={() => setMlsAffiliation('no_mls')}><strong>{t('profile.noMls')}</strong><small>{t('profile.noMlsHint')}</small></button>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}><strong>{t('profile.areas')}</strong><span>{t('profile.areasHint')}</span></div>
            <div className={styles.field}><textarea value={showingAreas} onChange={event => setShowingAreas(event.target.value)} placeholder={t('profile.areasPlaceholder')}/></div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}><strong>{t('lang.label')}</strong><span>{t('profile.languageHint')}</span></div>
            <LanguageToggle />
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}><strong>{t('profile.languages')}</strong><span>{t('profile.languagesHint')}</span></div>
            <div className={styles.languages}>
              {[...COMMON_LANGUAGES, ...languages.filter(item => !COMMON_LANGUAGES.some(common => common.toLowerCase() === item.toLowerCase()))].map(language => {
                const active = languages.some(item => item.toLowerCase() === language.toLowerCase())
                return <button type="button" key={language} aria-pressed={active} className={`${styles.language} ${active ? styles.active : ''}`} onClick={() => toggleLanguage(language)}>{active ? '✓ ' : ''}{language}</button>
              })}
            </div>
            <div className={styles.addLanguage}>
              <input
                value={languageDraft}
                onChange={event => setLanguageDraft(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addLanguage() } }}
                placeholder={t('profile.addLanguage')}
                aria-label={t('profile.addLanguage')}
              />
              <button type="button" onClick={addLanguage} disabled={!languageDraft.trim()}>{t('profile.add')}</button>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}><strong>{t('profile.leadPref')}</strong><span>{t('profile.leadPrefHint')}</span></div>
            <div className={styles.choices}>
              <button type="button" className={`${styles.choice} ${leadPreference === 'showing_only' ? styles.activeGold : ''}`} onClick={() => setLeadPreference('showing_only')}><strong>{t('type.showing')}</strong><small>{t('profile.showingPay')}</small></button>
              <button type="button" className={`${styles.choice} ${leadPreference === 'full_service' ? styles.activeBlue : ''}`} onClick={() => setLeadPreference('full_service')}><strong>{t('profile.fullLeads')}</strong><small>{t('type.fullPay')}</small></button>
              <button type="button" className={`${styles.choice} ${leadPreference === 'both' ? styles.activeGreen : ''}`} onClick={() => setLeadPreference('both')}><strong>{t('profile.both')}</strong><small>{t('profile.allEligible')}</small></button>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}><strong>{t('profile.availability')}</strong><span>{t('profile.availabilityHint')}</span></div>
            <div className={styles.availability}>
              {DAYS.map(day => {
                const slot = availability[day]
                return (
                  <div key={day} className={`${styles.day} ${slot.active ? styles.on : ''}`}>
                    <button type="button" className={styles.toggle} onClick={() => toggleDay(day)}><span className={styles.dot}/>{t(`day.${day}` as TranslationKey)}</button>
                    {slot.active ? <div className={styles.times}><input type="time" value={slot.start} onChange={event => setTime(day, 'start', event.target.value)}/><span>{t('profile.to')}</span><input type="time" value={slot.end} onChange={event => setTime(day, 'end', event.target.value)}/></div> : <div className={styles.offText}>{t('profile.off')}</div>}
                  </div>
                )
              })}
            </div>
          </section>

          {notice && <div className={`${styles.message} ${notice.kind === 'success' ? styles.success : styles.error}`}>{notice.text}</div>}
          <button className={styles.save} disabled={saving}>{saving ? t('profile.saving') : t('profile.save')}</button>
        </form>
      </section>
    </main>
  )
}
