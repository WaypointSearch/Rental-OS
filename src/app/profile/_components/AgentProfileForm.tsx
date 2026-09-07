'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Camera, UserRound } from 'lucide-react'
import {
  AgentProfile,
  Availability,
  DAY_LABELS,
  DAYS,
  DEFAULT_AVAILABILITY,
  DayKey,
} from '@/types/agent'
import { getSupabase } from '@/lib/supabase'
import styles from '../profile.module.css'

const CARRIERS = [
  ['verizon', 'Verizon'],
  ['tmobile', 'T-Mobile'],
  ['att', 'AT&T'],
  ['sprint', 'Sprint'],
  ['googlefi', 'Google Fi'],
  ['metropcs', 'Metro PCS'],
  ['cricket', 'Cricket'],
  ['other', 'Other / Unknown'],
] as const

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
  const fileRef = useRef<HTMLInputElement>(null)
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [alertPhone, setAlertPhone] = useState(profile?.alert_phone ?? '')
  const [licenseNumber, setLicenseNumber] = useState(profile?.license_number ?? '')
  const [showingAreas, setShowingAreas] = useState(profile?.showing_areas ?? '')
  const [leadPreference, setLeadPreference] = useState(profile?.lead_preference ?? 'both')
  const [mlsAffiliation, setMlsAffiliation] = useState(profile?.mls_affiliation ?? 'no_mls')
  const [alertPreference, setAlertPreference] = useState<'email' | 'text' | 'both'>(profile?.alert_preference ?? 'email')
  const [alertCarrier, setAlertCarrier] = useState(profile?.alert_carrier ?? 'verizon')
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
      setNotice({ kind: 'success', text: 'Profile photo updated.' })
    } catch (caught) {
      setNotice({ kind: 'error', text: caught instanceof Error ? caught.message : 'Could not upload photo.' })
    } finally {
      setUploading(false)
    }
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
      setNotice({ kind: 'error', text: 'Enter your full name.' })
      return
    }
    if (!licenseNumber.trim()) {
      setNotice({ kind: 'error', text: 'Florida license number is required.' })
      return
    }
    if (alertPreference !== 'email' && !alertPhone.trim()) {
      setNotice({ kind: 'error', text: 'Enter a phone number to receive text alerts.' })
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
      alert_preference: alertPreference,
      alert_carrier: alertCarrier,
      availability,
    }

    const result = profile
      ? await supabase.from('agent_profiles').update(values).eq('id', userId)
      : await supabase.from('agent_profiles').insert({ id: userId, email: userEmail, is_admin: false, ...values })

    if (result.error) setNotice({ kind: 'error', text: result.error.message })
    else setNotice({ kind: 'success', text: 'Profile saved. Broker routing now uses these preferences.' })
    setSaving(false)
  }

  const displayName = fullName.trim() || userEmail.split('@')[0]

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <strong><span className={styles.mark}><UserRound size={15}/></span> My Profile</strong>
        <Link href="/pipeline"><ArrowLeft size={13}/> Back to Pipeline</Link>
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
              <Camera size={12}/> {uploading ? 'Uploading…' : 'Upload Photo'}
            </button>
          </div>
        </div>

        <form className={styles.form} onSubmit={save}>
          <section className={styles.card}>
            <div className={styles.cardHead}><strong>Profile Info</strong><span>Used by the broker when assigning and routing rental leads.</span></div>
            <div className={styles.grid2}>
              <div className={styles.field}><label>Full Name <span className={styles.required}>required</span></label><input value={fullName} onChange={event => setFullName(event.target.value)}/></div>
              <div className={`${styles.field} ${styles.readonly}`}><label>Email</label><input value={userEmail} readOnly/></div>
              <div className={styles.field}><label>Phone Number <span>for SMS lead alerts</span></label><input type="tel" value={alertPhone} onChange={event => setAlertPhone(event.target.value)} placeholder="9545551212"/></div>
              <div className={styles.field}><label>Florida License Number <span className={styles.required}>required</span></label><input value={licenseNumber} onChange={event => setLicenseNumber(event.target.value)} placeholder="SL1234567"/></div>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}><strong>MLS Affiliation</strong><span>Select the MLS association you currently belong to.</span></div>
            <div className={styles.choices}>
              <button type="button" className={`${styles.choice} ${mlsAffiliation === 'miami_mls' ? styles.activeBlue : ''}`} onClick={() => setMlsAffiliation('miami_mls')}><strong>Miami MLS</strong><small>Miami-Dade access</small></button>
              <button type="button" className={`${styles.choice} ${mlsAffiliation === 'beaches_mls' ? styles.activeGreen : ''}`} onClick={() => setMlsAffiliation('beaches_mls')}><strong>Beaches MLS</strong><small>Broward / Palm Beach</small></button>
              <button type="button" className={`${styles.choice} ${mlsAffiliation === 'no_mls' ? styles.activeGold : ''}`} onClick={() => setMlsAffiliation('no_mls')}><strong>No MLS</strong><small>Showing-only eligible</small></button>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}><strong>Showing Areas</strong><span>Tell the broker where you are willing to show properties. This feeds the assignment match.</span></div>
            <div className={styles.field}><textarea value={showingAreas} onChange={event => setShowingAreas(event.target.value)} placeholder="e.g. Hollywood, Fort Lauderdale, Pembroke Pines, all East Broward, Boca Raton…"/></div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}><strong>Lead Preference</strong><span>What type of rental work do you want the broker to route to you?</span></div>
            <div className={styles.choices}>
              <button type="button" className={`${styles.choice} ${leadPreference === 'showing_only' ? styles.activeGold : ''}`} onClick={() => setLeadPreference('showing_only')}><strong>Showing Only</strong><small>$250/showing</small></button>
              <button type="button" className={`${styles.choice} ${leadPreference === 'full_service' ? styles.activeBlue : ''}`} onClick={() => setLeadPreference('full_service')}><strong>Full Leads</strong><small>60% commission</small></button>
              <button type="button" className={`${styles.choice} ${leadPreference === 'both' ? styles.activeGreen : ''}`} onClick={() => setLeadPreference('both')}><strong>Both</strong><small>All eligible leads</small></button>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}><strong>Lead Alert Preference</strong><span>Choose how you want to receive new assignment notifications.</span></div>
            <div className={styles.choices}>
              <button type="button" className={`${styles.choice} ${alertPreference === 'email' ? styles.activeBlue : ''}`} onClick={() => setAlertPreference('email')}><strong>Email Only</strong><small>Inbox alert</small></button>
              <button type="button" className={`${styles.choice} ${alertPreference === 'text' ? styles.activeGold : ''}`} onClick={() => setAlertPreference('text')}><strong>Text Only</strong><small>Carrier SMS alert</small></button>
              <button type="button" className={`${styles.choice} ${alertPreference === 'both' ? styles.activeGreen : ''}`} onClick={() => setAlertPreference('both')}><strong>Both</strong><small>Email + text</small></button>
            </div>
            {alertPreference !== 'email' && (
              <div className={styles.carriers}>
                {CARRIERS.map(([value, label]) => <button type="button" key={value} className={`${styles.carrier} ${alertCarrier === value ? styles.active : ''}`} onClick={() => setAlertCarrier(value)}>{label}</button>)}
              </div>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}><strong>Weekly Availability</strong><span>Turn on the days and times you can accept showings. The broker sees this when assigning leads.</span></div>
            <div className={styles.availability}>
              {DAYS.map(day => {
                const slot = availability[day]
                return (
                  <div key={day} className={`${styles.day} ${slot.active ? styles.on : ''}`}>
                    <button type="button" className={styles.toggle} onClick={() => toggleDay(day)}><span className={styles.dot}/>{DAY_LABELS[day]}</button>
                    {slot.active ? <div className={styles.times}><input type="time" value={slot.start} onChange={event => setTime(day, 'start', event.target.value)}/><span>to</span><input type="time" value={slot.end} onChange={event => setTime(day, 'end', event.target.value)}/></div> : <div className={styles.offText}>Off</div>}
                  </div>
                )
              })}
            </div>
          </section>

          {notice && <div className={`${styles.message} ${notice.kind === 'success' ? styles.success : styles.error}`}>{notice.text}</div>}
          <button className={styles.save} disabled={saving}>{saving ? 'Saving Profile…' : 'Save Profile'}</button>
        </form>
      </section>
    </main>
  )
}
