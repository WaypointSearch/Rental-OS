'use client'

import { useState, useRef } from 'react'
import { AgentProfile, DAYS, DAY_LABELS, DayKey, DEFAULT_AVAILABILITY, Availability } from '@/types/agent'
import { getSupabase } from '@/lib/supabase'
import { useToast, ToastProvider } from '@/lib/useToast'
import { useRouter } from 'next/navigation'

interface AgentProfileFormProps {
  profile:   AgentProfile | null
  userId:    string
  userEmail: string
}

const DAYS_ORDERED: DayKey[] = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

function ProfileInner({ profile, userId, userEmail }: AgentProfileFormProps) {
  const supabase  = getSupabase()
  const router    = useRouter()
  const { push: toast } = useToast()
  const fileRef   = useRef<HTMLInputElement>(null)

  const [fullName,    setFullName]    = useState(profile?.full_name    ?? '')
  const [alertPhone,  setAlertPhone]  = useState(profile?.alert_phone  ?? '')
  const [alertPref,   setAlertPref]   = useState<'email' | 'text' | 'both'>(profile?.alert_preference ?? 'email')
  const [avatarUrl,   setAvatarUrl]   = useState(profile?.avatar_url   ?? null)
  const [availability, setAvailability] = useState<Availability>(
    profile?.availability ?? DEFAULT_AVAILABILITY
  )
  const [uploading,  setUploading]  = useState(false)
  const [saving,     setSaving]     = useState(false)

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const path = `avatars/${userId}.jpg`
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) {
      toast({ type: 'error', title: 'Upload failed', body: error.message })
    } else {
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl + '?t=' + Date.now()
      setAvatarUrl(url)
      await supabase.from('agent_profiles').update({ avatar_url: data.publicUrl }).eq('id', userId)
      toast({ type: 'success', title: 'Avatar updated' })
    }
    setUploading(false)
  }

  function toggleDay(day: DayKey) {
    setAvailability((p) => ({
      ...p,
      [day]: { ...p[day], active: !p[day].active },
    }))
  }

  function setTime(day: DayKey, field: 'start' | 'end', value: string) {
    setAvailability((p) => ({
      ...p,
      [day]: { ...p[day], [field]: value },
    }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase
      .from('agent_profiles')
      .update({ full_name: fullName || null, alert_phone: alertPhone || null, alert_preference: alertPref, availability })
      .eq('id', userId)
    if (error) {
      toast({ type: 'error', title: 'Save failed', body: error.message })
    } else {
      toast({ type: 'success', title: 'Profile saved' })
    }
    setSaving(false)
  }

  const initials = (fullName || userEmail).slice(0, 2).toUpperCase()

  return (
    <div style={{
      background: '#0a0d14',
      color: '#e6edf3',
      fontFamily: 'var(--font-geist-sans, system-ui)',
      minHeight: '100dvh',
      fontSize: 14,
    }}>
      {/* Background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(56,139,253,0.07) 0%, transparent 70%)',
      }} />

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,16,28,0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 0.75rem', height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg, #e87c2a, #f5a623)',
            borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 10px rgba(56,139,253,0.25)',
          }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <polygon points="10,2 18,6.5 18,13.5 10,18 2,13.5 2,6.5" stroke="white" strokeWidth="1.8" fill="none" />
              <circle cx="10" cy="10" r="2.8" fill="white" />
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#f0f6fc' }}>My Profile</span>
        </div>
        <button
          onClick={() => router.push('/pipeline')}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#8b949e', padding: '5px 14px',
            borderRadius: 6, fontSize: 12,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ← Back to Pipeline
        </button>
      </nav>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 620, margin: '0 auto', padding: '1.5rem 0.75rem' }}>
        <form onSubmit={handleSave}>

          {/* ── Avatar ── */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, padding: '1.5rem',
            marginBottom: '1.25rem',
            display: 'flex', alignItems: 'center', gap: '1.25rem',
          }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: 80, height: 80, borderRadius: '50%',
                background: avatarUrl ? 'transparent' : 'rgba(56,139,253,0.15)',
                border: '2px solid rgba(56,139,253,0.3)',
                overflow: 'hidden', flexShrink: 0, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700, color: '#388bfd',
                transition: 'border-color .2s',
                position: 'relative',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(56,139,253,0.7)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(56,139,253,0.3)')}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : uploading ? <span style={{ fontSize: 12 }}>…</span> : initials
              }
              {/* Overlay hint */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0, transition: 'opacity .2s',
                fontSize: 11, color: '#fff', fontWeight: 500,
              }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
              >
                Change
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />

            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#f0f6fc', marginBottom: 4 }}>
                {fullName || userEmail.split('@')[0]}
              </div>
              <div style={{ fontSize: 13, color: '#6e7681', marginBottom: 8 }}>{userEmail}</div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  background: 'rgba(56,139,253,0.12)',
                  border: '0.5px solid rgba(56,139,253,0.3)',
                  color: '#388bfd', borderRadius: 6,
                  padding: '5px 14px', fontSize: 12,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {uploading ? 'Uploading…' : 'Upload Photo'}
              </button>
            </div>
          </div>

          {/* ── Info fields ── */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, padding: '1.25rem',
            marginBottom: '1.25rem',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 14 }}>
              Profile Info
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6e7681', marginBottom: 5 }}>
                  Full Name
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e6edf3', borderRadius: 8,
                    padding: '9px 12px', fontSize: 13,
                    outline: 'none', fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6e7681', marginBottom: 5 }}>
                  Email
                </label>
                <div style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  color: '#8b949e', borderRadius: 8,
                  padding: '9px 12px', fontSize: 13,
                  boxSizing: 'border-box',
                }}>
                  {userEmail}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#6e7681', marginBottom: 5 }}>
                  Phone Number
                  <span style={{ marginLeft: 6, fontSize: 11, color: '#444c56' }}>(for SMS lead alerts)</span>
                </label>
                <input
                  value={alertPhone}
                  onChange={(e) => setAlertPhone(e.target.value)}
                  type="tel"
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e6edf3', borderRadius: 8,
                    padding: '9px 12px', fontSize: 13,
                    outline: 'none', fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── Notification Preferences ── */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, padding: '1.25rem',
            marginBottom: '1.25rem',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 14 }}>
              Lead Alert Preference
            </div>
            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 12 }}>
              How do you want to receive new lead notifications?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { label: 'Email Only', value: 'email' as const },
                { label: 'Text Only', value: 'text' as const },
                { label: 'Both', value: 'both' as const },
              ]).map(opt => (
                <button key={opt.value} type="button" onClick={() => setAlertPref(opt.value)} style={{
                  flex: 1,
                  background: alertPref === opt.value ? 'rgba(245,166,35,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${alertPref === opt.value ? 'rgba(245,166,35,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: alertPref === opt.value ? '#f5a623' : '#8b949e',
                  borderRadius: 8, padding: '10px 8px',
                  fontSize: 12, fontWeight: alertPref === opt.value ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {alertPref !== 'email' && !alertPhone && (
              <div style={{ fontSize: 11, color: '#e3b341', marginTop: 8 }}>
                Enter your phone number above to receive text alerts
              </div>
            )}
          </div>

          {/* ── Weekly Availability ── */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, padding: '1.25rem',
            marginBottom: '1.5rem',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 14 }}>
              Weekly Availability
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DAYS_ORDERED.map((day) => {
                const slot  = availability[day]
                return (
                  <div key={day} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 12px',
                    background: slot.active ? 'rgba(63,185,80,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${slot.active ? 'rgba(63,185,80,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 8,
                    transition: 'all .15s',
                  }}>
                    {/* Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleDay(day)}
                      style={{
                        width: 34, height: 18, borderRadius: 9,
                        background: slot.active ? '#3fb950' : 'rgba(255,255,255,0.1)',
                        border: 'none', cursor: 'pointer',
                        position: 'relative', flexShrink: 0,
                        transition: 'background .2s',
                      }}
                    >
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%',
                        background: '#fff',
                        position: 'absolute',
                        top: 2,
                        left: slot.active ? 18 : 2,
                        transition: 'left .2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }} />
                    </button>

                    {/* Day label */}
                    <span style={{
                      fontSize: 13, fontWeight: 500, width: 36, flexShrink: 0,
                      color: slot.active ? '#e6edf3' : '#6e7681',
                    }}>
                      {DAY_LABELS[day]}
                    </span>

                    {/* Time range */}
                    {slot.active && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="time"
                          value={slot.start}
                          onChange={(e) => setTime(day, 'start', e.target.value)}
                          style={{
                            background: 'rgba(255,255,255,0.07)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#c9d1d9', borderRadius: 6,
                            padding: '4px 8px', fontSize: 12,
                            outline: 'none', fontFamily: 'inherit',
                            colorScheme: 'dark',
                          }}
                        />
                        <span style={{ fontSize: 12, color: '#6e7681' }}>to</span>
                        <input
                          type="time"
                          value={slot.end}
                          onChange={(e) => setTime(day, 'end', e.target.value)}
                          style={{
                            background: 'rgba(255,255,255,0.07)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#c9d1d9', borderRadius: 6,
                            padding: '4px 8px', fontSize: 12,
                            outline: 'none', fontFamily: 'inherit',
                            colorScheme: 'dark',
                          }}
                        />
                      </div>
                    )}
                    {!slot.active && (
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.15)' }}>Off</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Save button */}
          <button
            type="submit"
            disabled={saving}
            style={{
              width: '100%',
              background: saving ? 'rgba(56,139,253,0.3)' : 'linear-gradient(135deg, #0550ae, #388bfd)',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '12px 0', fontSize: 14, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: saving ? 'none' : '0 4px 16px rgba(56,139,253,0.25)',
            }}
          >
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </form>

        <div style={{ height: '3rem' }} />
      </div>
    </div>
  )
}

export function AgentProfileForm(props: AgentProfileFormProps) {
  return <ToastProvider><ProfileInner {...props} /></ToastProvider>
}
