'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, KeyRound, ShieldCheck, Waves } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'

export default function SetPasswordPage() {
  const router = useRouter()
  const supabase = getSupabase()

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
      setError('Use at least 8 characters for your password.')
      return
    }

    if (password !== confirmPassword) {
      setError('The passwords do not match.')
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
          <div style={{ color: '#8da0b7', fontSize: 12 }}>Securing your invitation…</div>
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
          <div className="ros-login-kicker">Agent activation</div>
          <h1>Welcome to<br/>the team.</h1>
          <p>Create your private password once. After activation, you can sign in with your password or request a secure magic link whenever you prefer.</p>
          <div className="ros-login-proof">
            <span className="ros-proof-pill"><ShieldCheck size={13}/> Private agent access</span>
            <span className="ros-proof-pill"><KeyRound size={13}/> Your own password</span>
          </div>
        </div>

        <div className="ros-login-footer">Your invitation link is one-time access. Keep your password private.</div>
      </section>

      <section className="ros-login-side">
        <div className="ros-login-card">
          {done ? (
            <div className="ros-auth-success">
              <div className="ros-auth-success-icon"><CheckCircle2 size={25}/></div>
              <h3>You&apos;re activated</h3>
              <p>Your password is set. Your Rental OS workspace is ready.</p>
              <button className="ros-auth-submit" style={{ marginTop: 20 }} onClick={() => router.replace('/pipeline')}>
                Open Rental OS <ArrowRight size={14}/>
              </button>
            </div>
          ) : (
            <>
              <h2>Create your password</h2>
              <p>Choose the password you&apos;ll use for regular agent login.</p>

              <form onSubmit={submit}>
                <div className="ros-field">
                  <label>New password</label>
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
                      placeholder="At least 8 characters"
                    />
                  </div>
                </div>

                <div className="ros-field">
                  <label>Confirm password</label>
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
                      placeholder="Type it again"
                    />
                  </div>
                </div>

                {error && <div className="ros-auth-error">{error}</div>}

                <button className="ros-auth-submit" type="submit" disabled={loading}>
                  {loading ? 'Saving…' : <>Set password <ArrowRight size={14}/></>}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
