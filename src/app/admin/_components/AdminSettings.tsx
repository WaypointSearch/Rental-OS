'use client'

import { useEffect, useState } from 'react'
import { Bot, Check, Copy, KeyRound, Languages, Mail, RefreshCw, Trash2 } from 'lucide-react'

type Source = 'god_mode' | 'env' | 'default' | null
interface Status {
  openai: { set: boolean; last4: string | null; source: Source }
  openaiModel: { value: string | null; source: Source }
  aiAgentKey: { set: boolean; last4: string | null; source: Source }
  email: { configured: boolean }
  siteUrl: string | null
  generatedKey?: string
  test?: { ok: boolean; sample?: string; error?: string }
  error?: string
}

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16, padding: 20, marginBottom: 14,
}
const input: React.CSSProperties = {
  flex: 1, minWidth: 0, height: 42, boxSizing: 'border-box', padding: '0 12px',
  background: '#0f141d', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9,
  color: '#e6edf3', fontSize: 14, fontFamily: 'inherit', outline: 'none',
}
const btn = (tone = '#58a6ff', solid = false): React.CSSProperties => ({
  height: 42, padding: '0 15px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
  background: solid ? tone : `${tone}1a`, color: solid ? '#0a0d14' : tone, border: `1px solid ${tone}55`,
})

function Pill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const tone = ok ? '#3fb950' : '#e3b341'
  return <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, color: tone, background: `${tone}1a`, border: `1px solid ${tone}44` }}>{children}</span>
}

function sourceLabel(source: Source) {
  return source === 'god_mode' ? 'saved in God Mode' : source === 'env' ? 'from Vercel env var' : source === 'default' ? 'default' : ''
}

export function AdminSettings() {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [openaiKey, setOpenaiKey] = useState('')
  const [model, setModel] = useState('')
  const [agentKey, setAgentKey] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then((data: Status) => {
      setStatus(data)
      setModel(data.openaiModel?.value ?? '')
    }).catch(() => setMessage({ ok: false, text: 'Could not load settings.' }))
  }, [])

  async function act(action: string, extra: Record<string, unknown> = {}, success?: string) {
    setBusy(action)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      const data: Status = await response.json()
      if (!response.ok) { setMessage({ ok: false, text: data.error ?? 'Could not save.' }); return }
      setStatus(data)
      if (data.generatedKey) { setNewKey(data.generatedKey); setCopied(false) }
      if (data.test) setMessage(data.test.ok ? { ok: true, text: `OpenAI works. Test translation: “${data.test.sample}”` } : { ok: false, text: `OpenAI test failed: ${data.test.error}` })
      else if (success) setMessage({ ok: true, text: success })
    } finally {
      setBusy(null)
    }
  }

  if (!status) return <div style={{ color: '#8b949e', padding: 20 }}>{message?.text ?? 'Loading settings…'}</div>

  const apiBase = status.siteUrl ?? (typeof window !== 'undefined' ? window.location.origin : '')

  return (
    <div style={{ maxWidth: 820 }}>
      {message && (
        <div role="status" style={{ ...card, padding: '12px 16px', color: message.ok ? '#3fb950' : '#ff7b72', borderColor: message.ok ? 'rgba(63,185,80,.35)' : 'rgba(248,81,73,.35)' }}>
          {message.text}
        </div>
      )}

      {/* OpenAI */}
      <section style={card} aria-labelledby="openai-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <Languages size={18} color="#a371f7" aria-hidden="true" />
          <h3 id="openai-title" style={{ margin: 0, fontSize: 16, color: '#f0f6fc' }}>OpenAI (note translation)</h3>
          <Pill ok={status.openai.set}>{status.openai.set ? `Connected ••••${status.openai.last4}` : 'Not set'}</Pill>
          {status.openai.set && <span style={{ fontSize: 12, color: '#6e7681' }}>{sourceLabel(status.openai.source)}</span>}
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#8b949e', lineHeight: 1.5 }}>
          Powers the “Translate” button on lead notes (English ↔ Spanish). Get a key at platform.openai.com → API keys.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input style={input} type="password" autoComplete="off" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder={status.openai.set ? 'Paste a new key to replace it' : 'sk-…'} aria-label="OpenAI API key" />
          <button type="button" style={btn('#a371f7', true)} disabled={!openaiKey.trim() || busy !== null} onClick={async () => { await act('save_openai_key', { value: openaiKey }, 'OpenAI key saved.'); setOpenaiKey('') }}>
            <KeyRound size={15} /> {busy === 'save_openai_key' ? 'Saving…' : 'Save key'}
          </button>
          <button type="button" style={btn('#3fb950')} disabled={!status.openai.set || busy !== null} onClick={() => act('test_openai')}>
            <Check size={15} /> {busy === 'test_openai' ? 'Testing…' : 'Test'}
          </button>
          {status.openai.source === 'god_mode' && (
            <button type="button" style={btn('#f85149')} disabled={busy !== null} onClick={() => { if (confirm('Remove the OpenAI key?')) void act('clear', { name: 'openai_api_key' }, 'OpenAI key removed.') }} aria-label="Remove OpenAI key">
              <Trash2 size={15} />
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="openai-model" style={{ fontSize: 13, color: '#8b949e', width: 60 }}>Model</label>
          <input id="openai-model" style={{ ...input, flex: '0 1 240px' }} value={model} onChange={e => setModel(e.target.value)} placeholder="gpt-4o-mini" />
          <button type="button" style={btn()} disabled={!model.trim() || model === status.openaiModel.value || busy !== null} onClick={() => act('save_openai_model', { value: model }, 'Model saved.')}>
            {busy === 'save_openai_model' ? 'Saving…' : 'Save model'}
          </button>
        </div>
      </section>

      {/* AI agent key */}
      <section style={card} aria-labelledby="agent-key-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <Bot size={18} color="#58a6ff" aria-hidden="true" />
          <h3 id="agent-key-title" style={{ margin: 0, fontSize: 16, color: '#f0f6fc' }}>AI agent API key</h3>
          <Pill ok={status.aiAgentKey.set}>{status.aiAgentKey.set ? `Active ••••${status.aiAgentKey.last4}` : 'Off'}</Pill>
          {status.aiAgentKey.set && <span style={{ fontSize: 12, color: '#6e7681' }}>{sourceLabel(status.aiAgentKey.source)}</span>}
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#8b949e', lineHeight: 1.5 }}>
          Lets your AI agent (Muse, Grok, etc.) add leads and assign them to agents. Give it this key and the instructions at <a href="/llms.txt" target="_blank" style={{ color: '#58a6ff' }}>/llms.txt</a>.
          Generating a new key turns off the old one.
        </p>

        {newKey && (
          <div style={{ marginBottom: 12, padding: 14, borderRadius: 12, background: 'rgba(63,185,80,0.08)', border: '1px solid rgba(63,185,80,0.35)' }}>
            <div style={{ fontSize: 13, color: '#3fb950', fontWeight: 700, marginBottom: 8 }}>New key: copy it now, it won’t be shown again.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <code style={{ ...input, display: 'flex', alignItems: 'center', fontFamily: 'var(--font-geist-mono, monospace)', fontSize: 13, overflowX: 'auto', whiteSpace: 'nowrap' }}>{newKey}</code>
              <button type="button" style={btn('#3fb950', true)} onClick={async () => { await navigator.clipboard.writeText(newKey); setCopied(true) }}>
                {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={btn('#58a6ff', true)} disabled={busy !== null} onClick={() => {
            if (status.aiAgentKey.set && !confirm('Generate a new key? The current key stops working immediately.')) return
            void act('generate_agent_key')
          }}>
            <RefreshCw size={15} /> {busy === 'generate_agent_key' ? 'Generating…' : status.aiAgentKey.set ? 'Generate new key' : 'Generate key'}
          </button>
          {status.aiAgentKey.source === 'god_mode' && (
            <button type="button" style={btn('#f85149')} disabled={busy !== null} onClick={() => { if (confirm('Turn off the AI agent API?')) { setNewKey(null); void act('clear', { name: 'ai_agent_api_key' }, 'AI agent API turned off.') } }}>
              <Trash2 size={15} /> Turn off
            </button>
          )}
        </div>
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: '#8b949e' }}>Use my own key instead (24+ characters)</summary>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <input style={input} type="password" autoComplete="off" value={agentKey} onChange={e => setAgentKey(e.target.value)} placeholder="At least 24 characters" aria-label="Custom AI agent key" />
            <button type="button" style={btn()} disabled={agentKey.trim().length < 24 || busy !== null} onClick={async () => { await act('save_agent_key', { value: agentKey }, 'AI agent key saved.'); setAgentKey('') }}>
              Save key
            </button>
          </div>
          {agentKey && agentKey.trim().length < 24 && <div style={{ fontSize: 12, color: '#e3b341', marginTop: 6 }}>{24 - agentKey.trim().length} more characters needed.</div>}
        </details>
        <pre style={{ marginTop: 14, padding: 12, borderRadius: 10, background: '#0b0f16', border: '1px solid rgba(255,255,255,0.07)', color: '#8b949e', fontSize: 12, overflowX: 'auto', lineHeight: 1.5 }}>{`POST ${apiBase}/api/agent/leads
Authorization: Bearer <your AI agent key>
{ "name": "Maria Gonzalez", "phone": "9545551210", "budget": "$2,400/mo",
  "area": "Hollywood", "assign": { "agentEmail": "jane@…", "type": "full" } }`}</pre>
      </section>

      {/* Notifications */}
      <section style={card} aria-labelledby="notify-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <Mail size={18} color="#f5a623" aria-hidden="true" />
          <h3 id="notify-title" style={{ margin: 0, fontSize: 16, color: '#f0f6fc' }}>Assignment alerts</h3>
          <Pill ok={status.email.configured}>{status.email.configured ? 'Email sending on' : 'RESEND_API_KEY missing'}</Pill>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: '#8b949e', lineHeight: 1.6 }}>
          Every assignment (from you, the New Lead form or the AI agent) automatically emails the agent a
          branded summary of the lead. Texts are left to your AI agent: it gets each agent’s mobile number
          from <code>GET /api/agent/agents</code> and texts them from its own phone system.
        </p>
      </section>
    </div>
  )
}
