'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  Waves,
  Zap,
} from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { LanguageToggle, useI18n } from '@/lib/i18n'

type Mode = 'password' | 'magic'

export default function LoginPage() {
  const router = useRouter()
  const supabase = getSupabase()
  const { t } = useI18n()

  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'magic') {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      })
      if (authError) setError(authError.message)
      else setSent(true)
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) setError(authError.message)
      else router.push('/pipeline')
    }

    setLoading(false)
  }

  return (
    <main className="ros-login">
      <section className="ros-login-hero">
        <div className="ros-login-brand">
          <div className="ros-logo">
            <Waves size={22} strokeWidth={2.4}/>
          </div>
          <div className="ros-login-brand-copy">
            <strong>Rental OS</strong>
            <span>Sun Ocean Realty</span>
          </div>
        </div>

        <div className="ros-login-message">
          <div className="ros-login-kicker">{t('login.kicker')}</div>
          <h1>{t('login.h1a')}<br/>{t('login.h1b')}</h1>
          <p>
            {t('login.pitch')}
          </p>
          <div className="ros-login-proof">
            <span className="ros-proof-pill"><Zap size={13}/> {t('login.p1')}</span>
            <span className="ros-proof-pill"><ShieldCheck size={13}/> {t('login.p2')}</span>
            <span className="ros-proof-pill"><Sparkles size={13}/> {t('login.p3')}</span>
          </div>
        </div>

        <div style={{ marginTop: 18 }}><LanguageToggle /></div>
        <div className="ros-login-footer">{t('login.footer')}</div>
      </section>

      <section className="ros-login-side">
        <div className="ros-login-card">
          {sent ? (
            <div className="ros-auth-success">
              <div className="ros-auth-success-icon"><CheckCircle2 size={25}/></div>
              <h3>{t('login.inbox')}</h3>
              <p>{t('login.sentA')} <strong>{email}</strong>. {t('login.sentB')}</p>
              <button
                className="ros-btn"
                type="button"
                style={{ marginTop: 18 }}
                onClick={() => { setSent(false); setEmail('') }}
              >
                {t('login.another')}
              </button>
            </div>
          ) : (
            <>
              <h2>{t('login.welcome')}</h2>
              <p>{t('login.how')}</p>

              <div className="ros-auth-tabs">
                <button
                  type="button"
                  className={`ros-auth-tab ${mode === 'password' ? 'is-active' : ''}`}
                  onClick={() => { setMode('password'); setError(null) }}
                >
                  {t('login.password')}
                </button>
                <button
                  type="button"
                  className={`ros-auth-tab ${mode === 'magic' ? 'is-active' : ''}`}
                  onClick={() => { setMode('magic'); setError(null) }}
                >
                  {t('login.magic')}
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="ros-field">
                  <label>{t('profile.email')}</label>
                  <div className="ros-field-wrap">
                    <Mail className="ros-field-icon" size={15}/>
                    <input
                      className="ros-auth-input"
                      type="email"
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      required
                      autoComplete="email"
                      placeholder={t('login.emailPh')}
                    />
                  </div>
                </div>

                {mode === 'password' && (
                  <div className="ros-field">
                    <label>{t('login.password')}</label>
                    <div className="ros-field-wrap">
                      <KeyRound className="ros-field-icon" size={15}/>
                      <input
                        className="ros-auth-input"
                        type="password"
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        required
                        autoComplete="current-password"
                        placeholder={t('login.passwordPh')}
                      />
                    </div>
                  </div>
                )}

                {error && <div className="ros-auth-error">{error}</div>}

                <button className="ros-auth-submit" type="submit" disabled={loading}>
                  {loading
                    ? t('login.signingIn')
                    : mode === 'password'
                      ? <><LockKeyhole size={15}/> {t('login.signIn')} <ArrowRight size={14}/></>
                      : <><Mail size={15}/> {t('login.sendMagic')} <ArrowRight size={14}/></>
                  }
                </button>
              </form>

              <div style={{ marginTop: 16, color: '#60758e', fontSize: 10, lineHeight: 1.6, textAlign: 'center' }}>
                {t('login.newAgent')}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
