'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, KeyRound, ShieldCheck, Waves } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'

export default function SetPasswordPage() {
  const router = useRouter()
  const supabase = getSupabase()
  const { t } = useI18n()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login')
      else setChecking(false)
    })
  }, [router, supabase])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(t('pw.errLength'))
      return
    }

    if (password !== confirmPassword) {
      setError(t('pw.errMatch'))
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setDone(true)
  }

  if (checking) {
    return (
      <main className="ros-login" style={{ gridTemplateColumns: '1fr' }}>
        <section className="ros-login-side" style={{ border: 0 }}>
          <div style={{ color: '#8da0b7', fontSize: 12 }}>{t('pw.securing')}</div>
        </section>
      </main>
    )
  }

  return (
    <main className="ros-login">
      <section className="ros-login-hero">
        <div className="ros-login-brand">
          <div className="ros-logo"><Waves size={22} strokeWidth={2.4}/></div>
          <div className="ros-login-brand-copy">
            <strong>Rental OS</strong>
            <span>Sun Ocean Realty</span>
          </div>
        </div>

        <div className="ros-login-message">
          <div className="ros-login-kicker">{t('pw.kicker')}</div>
          <h1>{t('pw.h1a')}<br/>{t('pw.h1b')}</h1>
          <p>{t('pw.pitch')}</p>
          <div className="ros-login-proof">
            <span className="ros-proof-pill"><ShieldCheck size={13}/> {t('pw.p1')}</span>
            <span className="ros-proof-pill"><KeyRound size={13}/> {t('pw.p2')}</span>
          </div>
        </div>

        <div className="ros-login-footer">{t('pw.footer')}</div>
      </section>

      <section className="ros-login-side">
        <div className="ros-login-card">
          {done ? (
            <div className="ros-auth-success">
              <div className="ros-auth-success-icon"><CheckCircle2 size={25}/></div>
              <h3>{t('pw.done')}</h3>
              <p>{t('pw.doneHint')}</p>
              <button className="ros-auth-submit" style={{ marginTop: 20 }} onClick={() => router.replace('/pipeline')}>
                {t('pw.open')} <ArrowRight size={14}/>
              </button>
            </div>
          ) : (
            <>
              <h2>{t('pw.title')}</h2>
              <p>{t('pw.sub')}</p>

              <form onSubmit={submit}>
                <div className="ros-field">
                  <label>{t('pw.new')}</label>
                  <div className="ros-field-wrap">
                    <KeyRound className="ros-field-icon" size={15}/>
                    <input
                      className="ros-auth-input"
                      type="password"
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder={t('pw.newPh')}
                    />
                  </div>
                </div>

                <div className="ros-field">
                  <label>{t('pw.confirm')}</label>
                  <div className="ros-field-wrap">
                    <KeyRound className="ros-field-icon" size={15}/>
                    <input
                      className="ros-auth-input"
                      type="password"
                      value={confirmPassword}
                      onChange={event => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder={t('pw.confirmPh')}
                    />
                  </div>
                </div>

                {error && <div className="ros-auth-error">{error}</div>}

                <button className="ros-auth-submit" type="submit" disabled={loading}>
                  {loading ? t('lead.saving') : <>{t('pw.set')} <ArrowRight size={14}/></>}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
