'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const [dark, setDark] = useState(true)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${location.origin}/pipeline` },
      })
      if (error) setError(error.message)
      else setSent(true)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/pipeline')
    }

    setLoading(false)
  }

  const d = dark
    ? {
        page: '#0d1117',
        card: '#161b22',
        border: 'rgba(255,255,255,0.08)',
        text: '#e6edf3',
        muted: '#7d8590',
        input: '#1c2128',
        btn: '#238636',
        btnHover: '#2ea043',
      }
    : {
        page: '#f2f1ed',
        card: '#ffffff',
        border: 'rgba(0,0,0,0.08)',
        text: '#1f2328',
        muted: '#636c76',
        input: '#f6f8fa',
        btn: '#1a7f37',
        btnHover: '#2da44e',
      }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: d.page,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-geist-sans, system-ui)',
        padding: '1rem',
        position: 'relative',
      }}
    >
      {/* Dark mode toggle */}
      <button
        onClick={() => setDark(!dark)}
        style={{
          position: 'absolute',
          top: '1.25rem',
          right: '1.25rem',
          background: d.card,
          border: `0.5px solid ${d.border}`,
          color: d.muted,
          borderRadius: '8px',
          padding: '6px 14px',
          fontSize: '12px',
          cursor: 'pointer',
        }}
      >
        {dark ? 'Light mode' : 'Dark mode'}
      </button>

      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: d.card,
          borderRadius: '16px',
          border: `0.5px solid ${d.border}`,
          padding: '2.5rem 2rem',
          boxShadow: dark
            ? 'none'
            : '0 4px 32px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              background: '#e87c2a',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <polygon
                points="10,2 18,6.5 18,13.5 10,18 2,13.5 2,6.5"
                stroke="white"
                strokeWidth="1.8"
                fill="none"
              />
              <circle cx="10" cy="10" r="2.8" fill="white" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 500, color: d.text }}>Sun Ocean Realty</div>
            <div style={{ fontSize: '12px', color: d.muted }}>Agent Portal</div>
          </div>
        </div>

        {sent ? (
          <div
            style={{
              textAlign: 'center',
              padding: '1.5rem 0',
              color: d.text,
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                background: '#1a7f3722',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M20 4H4a1 1 0 00-1 1v14a1 1 0 001 1h16a1 1 0 001-1V5a1 1 0 00-1-1z" stroke="#1a7f37" strokeWidth="1.5" />
                <path d="M3 6l9 7 9-7" stroke="#1a7f37" strokeWidth="1.5" />
              </svg>
            </div>
            <p style={{ fontWeight: 500, marginBottom: '6px' }}>Check your email</p>
            <p style={{ fontSize: '13px', color: d.muted }}>
              We sent a magic link to <strong>{email}</strong>
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              style={{
                marginTop: '1.5rem',
                background: 'none',
                border: `0.5px solid ${d.border}`,
                color: d.muted,
                borderRadius: '8px',
                padding: '7px 18px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Back
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{ display: 'block', fontSize: '12px', color: d.muted, marginBottom: '5px' }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="agent@brokerage.com"
                style={{
                  width: '100%',
                  background: d.input,
                  border: `0.5px solid ${d.border}`,
                  color: d.text,
                  borderRadius: '8px',
                  padding: '9px 12px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {mode === 'password' && (
              <div style={{ marginBottom: '1rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    color: d.muted,
                    marginBottom: '5px',
                  }}
                >
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    background: d.input,
                    border: `0.5px solid ${d.border}`,
                    color: d.text,
                    borderRadius: '8px',
                    padding: '9px 12px',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {error && (
              <div
                style={{
                  fontSize: '13px',
                  color: '#e24b4a',
                  background: '#e24b4a11',
                  border: '0.5px solid #e24b4a44',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  marginBottom: '1rem',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: d.btn,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 0',
                fontSize: '14px',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity .15s',
              }}
            >
              {loading ? 'Signing in…' : mode === 'password' ? 'Sign in' : 'Send magic link'}
            </button>

            <button
              type="button"
              onClick={() => { setMode(mode === 'password' ? 'magic' : 'password'); setError(null) }}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: d.muted,
                fontSize: '13px',
                marginTop: '12px',
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              {mode === 'password'
                ? 'Sign in with magic link instead'
                : 'Sign in with password instead'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
