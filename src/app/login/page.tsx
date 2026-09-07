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

type Mode = 'password' | 'magic'

export default function LoginPage() {
  const router = useRouter()
  const supabase = getSupabase()

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
          <div className="ros-login-kicker">Rental operations, simplified</div>
          <h1>Every lead.<br/>One clean system.</h1>
          <p>
            Qualify, assign, show, apply and close without losing the thread. Rental OS keeps the whole team moving from first text to move-in.
          </p>
          <div className="ros-login-proof">
            <span className="ros-proof-pill"><Zap size={13}/> Realtime lead updates</span>
            <span className="ros-proof-pill"><ShieldCheck size={13}/> Agent-specific access</span>
            <span className="ros-proof-pill"><Sparkles size={13}/> AI-assisted intake</span>
          </div>
        </div>

        <div className="ros-login-footer">Private workspace for Sun Ocean Realty agents.</div>
      </section>

      <section className="ros-login-side">
        <div className="ros-login-card">
          {sent ? (
            <div className="ros-auth-success">
              <div className="ros-auth-success-icon"><CheckCircle2 size={25}/></div>
              <h3>Check your inbox</h3>
              <p>We sent a secure sign-in link to <strong>{email}</strong>. Open it on this device to enter Rental OS.</p>
              <button
                className="ros-btn"
                type="button"
                style={{ marginTop: 18 }}
                onClick={() => { setSent(false); setEmail('') }}
              >
                Use another email
              </button>
            </div>
          ) : (
            <>
              <h2>Welcome back</h2>
              <p>Sign in with your agent password, or use a one-time magic link.</p>

              <div className="ros-auth-tabs">
                <button
                  type="button"
                  className={`ros-auth-tab ${mode === 'password' ? 'is-active' : ''}`}
                  onClick={() => { setMode('password'); setError(null) }}
                >
                  Password
                </button>
                <button
                  type="button"
                  className={`ros-auth-tab ${mode === 'magic' ? 'is-active' : ''}`}
                  onClick={() => { setMode('magic'); setError(null) }}
                >
                  Magic link
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="ros-field">
                  <label>Email</label>
                  <div className="ros-field-wrap">
                    <Mail className="ros-field-icon" size={15}/>
                    <input
                      className="ros-auth-input"
                      type="email"
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      required
                      autoComplete="email"
                      placeholder="you@brokerage.com"
                    />
                  </div>
                </div>

                {mode === 'password' && (
                  <div className="ros-field">
                    <label>Password</label>
                    <div className="ros-field-wrap">
                      <KeyRound className="ros-field-icon" size={15}/>
                      <input
                        className="ros-auth-input"
                        type="password"
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        required
                        autoComplete="current-password"
                        placeholder="Your password"
                      />
                    </div>
                  </div>
                )}

                {error && <div className="ros-auth-error">{error}</div>}

                <button className="ros-auth-submit" type="submit" disabled={loading}>
                  {loading
                    ? 'Signing in…'
                    : mode === 'password'
                      ? <><LockKeyhole size={15}/> Sign in <ArrowRight size={14}/></>
                      : <><Mail size={15}/> Send magic link <ArrowRight size={14}/></>
                  }
                </button>
              </form>

              <div style={{ marginTop: 16, color: '#60758e', fontSize: 10, lineHeight: 1.6, textAlign: 'center' }}>
                New agent? Use the invitation sent by your broker to activate your account.
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
