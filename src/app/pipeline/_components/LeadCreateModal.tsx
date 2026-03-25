'use client'

import { useState } from 'react'
import { Lead, STAGES } from '@/types/lead'

interface LeadCreateModalProps {
  onClose: () => void
  onCreated: (lead: Lead) => void
  agentEmail: string
}

// ── Hardcoded dark theme — no CSS variables ───────────────────────────────
const C = {
  bg:     '#13181f',
  surface:'rgba(255,255,255,0.04)',
  input:  'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.1)',
  text:   '#e6edf3',
  muted:  '#8b949e',
  dim:    '#6e7681',
  accent: '#388bfd',
  danger: '#e24b4a',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: C.input,
  border: `1px solid ${C.border}`,
  color: C.text,
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: C.muted,
  marginBottom: 5,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

function Field({ label, children, span2 }: {
  label: string; children: React.ReactNode; span2?: boolean
}) {
  return (
    <div style={{ gridColumn: span2 ? 'span 2' : 'span 1' }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

export function LeadCreateModal({ onClose, onCreated, agentEmail }: LeadCreateModalProps) {
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const [form, setForm] = useState({
    id:             '',
    source:         'Manual',
    name:           '',
    phone:          '',
    area:           '',
    bedrooms:       '',
    bathrooms:      '',
    budget:         '',
    move_in:        '',
    pets:           '',
    credit:         '',
    income:         '',
    mls_codes:      '',
    urls:           '',
    cl_url:         '',
    cosigner_info:  '',
    stage:          'Waiting for contact',
    assigned_agent: 'Unassigned',
  })

  function set(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.id.trim()) {
      setError('Lead ID is required (use phone number or thread ID)')
      return
    }
    setSaving(true)

    const payload = { ...form, id: form.id.trim(), notes: [] }

    // Use admin API route to bypass RLS
    const res = await fetch('/api/leads/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()

    if (data.error) {
      setError(data.error)
      setSaving(false)
      return
    }

    onCreated(data.lead as Lead)
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.bg,
          border: `1px solid rgba(255,255,255,0.1)`,
          borderRadius: 16,
          width: '100%',
          maxWidth: 580,
          maxHeight: '92dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: `1px solid rgba(255,255,255,0.07)`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.02)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, letterSpacing: '-0.3px' }}>
              New Lead
            </div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
              Manually add a lead to the pipeline
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid rgba(255,255,255,0.1)`,
              color: C.dim, width: 30, height: 30, borderRadius: 7,
              cursor: 'pointer', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '13px 16px',
          }}>
            <Field label="Lead ID *" span2>
              <input
                style={inputStyle}
                placeholder="Phone number or FB thread ID"
                value={form.id}
                onChange={e => set('id', e.target.value)}
                required
              />
            </Field>

            <Field label="Full Name">
              <input style={inputStyle}
                value={form.name} onChange={e => set('name', e.target.value)} />
            </Field>

            <Field label="Phone">
              <input style={inputStyle}
                value={form.phone} onChange={e => set('phone', e.target.value)} />
            </Field>

            <Field label="Source">
              <select style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.source} onChange={e => set('source', e.target.value)}>
                <option value="Manual">Manual</option>
                <option value="Facebook Marketplace">Facebook Marketplace</option>
                <option value="Google Voice">Google Voice</option>
                <option value="Referral">Referral</option>
                <option value="Other">Other</option>
              </select>
            </Field>

            <Field label="Bedrooms">
              <input style={inputStyle}
                value={form.bedrooms} onChange={e => set('bedrooms', e.target.value)} />
            </Field>

            <Field label="Bathrooms">
              <input style={inputStyle}
                value={form.bathrooms} onChange={e => set('bathrooms', e.target.value)} />
            </Field>

            <Field label="Budget">
              <input style={inputStyle}
                value={form.budget} onChange={e => set('budget', e.target.value)} />
            </Field>

            <Field label="Move-in Date">
              <input style={inputStyle}
                value={form.move_in} onChange={e => set('move_in', e.target.value)} />
            </Field>

            <Field label="Pets">
              <input style={inputStyle}
                value={form.pets} onChange={e => set('pets', e.target.value)} />
            </Field>

            <Field label="Credit">
              <input style={inputStyle}
                value={form.credit} onChange={e => set('credit', e.target.value)} />
            </Field>

            <Field label="Monthly Income">
              <input style={inputStyle}
                value={form.income} onChange={e => set('income', e.target.value)} />
            </Field>

            <Field label="MLS Codes (comma-separated)" span2>
              <input style={inputStyle}
                value={form.mls_codes} onChange={e => set('mls_codes', e.target.value)} />
            </Field>

            <Field label="Listing URLs (comma-separated)" span2>
              <input style={inputStyle}
                value={form.urls} onChange={e => set('urls', e.target.value)} />
            </Field>

            <Field label="Craigslist URL" span2>
              <input style={inputStyle}
                value={form.cl_url} onChange={e => set('cl_url', e.target.value)} />
            </Field>

            <Field label="Cosigner Info">
              <input style={inputStyle}
                value={form.cosigner_info} onChange={e => set('cosigner_info', e.target.value)} />
            </Field>

            <Field label="Initial Stage">
              <select style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.stage} onChange={e => set('stage', e.target.value)}>
                {STAGES.map(s => (
                  <option key={s} value={s} style={{ background: '#161b22' }}>{s}</option>
                ))}
              </select>
            </Field>
          </div>

          {error && (
            <div style={{
              marginTop: 14, fontSize: 13, color: C.danger,
              background: 'rgba(226,75,74,0.1)',
              border: `0.5px solid rgba(226,75,74,0.35)`,
              borderRadius: 8, padding: '9px 13px',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18, paddingBottom: 4 }}>
            <button type="button" onClick={onClose} style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid rgba(255,255,255,0.1)`,
              color: C.muted, borderRadius: 8,
              padding: '9px 20px', fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{
              background: saving ? 'rgba(56,139,253,0.3)' : 'linear-gradient(135deg, #0550ae, #388bfd)',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 24px', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: saving ? 'none' : '0 2px 10px rgba(56,139,253,0.3)',
            }}>
              {saving ? 'Creating…' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
