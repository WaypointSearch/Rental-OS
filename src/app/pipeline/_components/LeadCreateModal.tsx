'use client'

import { useEffect, useState } from 'react'
import { AssignmentType, Lead, STAGES } from '@/types/lead'
import { getSupabase } from '@/lib/supabase'
import { useI18n } from '@/lib/i18n'

interface LeadCreateModalProps {
  onClose: () => void
  onCreated: (lead: Lead) => void
  agentEmail: string
  /** Broker view: choose the lead source and assign in the same form */
  isAdmin?: boolean
}

const SOURCES = ['Google Voice', 'Facebook Marketplace', 'Referral', 'Other'] as const
type AgentOption = { email: string; full_name: string | null; lead_preference: string | null }

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
  fontSize: 16, // 16px stops iOS from zooming into the field
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

function choiceStyle(active: boolean, tone: string): React.CSSProperties {
  return {
    minHeight: 40, padding: '8px 13px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
    color: active ? tone : C.muted, background: active ? `${tone}1f` : C.input,
    border: `1.5px solid ${active ? tone : C.border}`,
  }
}

function Field({ label, children, span2 }: {
  label: string; children: React.ReactNode; span2?: boolean
}) {
  return (
    <label style={{ display: 'block', gridColumn: span2 ? '1 / -1' : 'auto' }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  )
}

export function LeadCreateModal({ onClose, onCreated, agentEmail, isAdmin = false }: LeadCreateModalProps) {
  const [saving, setSaving] = useState(false)
  const { t, stage: stageName } = useI18n()
  const [error,  setError]  = useState<string | null>(null)

  const [form, setForm] = useState({
    id:             '',
    source:         isAdmin ? 'Google Voice' : 'Self-generated',
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
    notes_crm:      '',
    stage:          'Waiting for contact',
    assigned_agent: 'Unassigned',
  })
  const [assignType, setAssignType] = useState<AssignmentType>('full')
  const [agents, setAgents] = useState<AgentOption[]>([])

  useEffect(() => {
    if (!isAdmin) return
    getSupabase().from('agent_profiles').select('email, full_name, lead_preference').order('full_name')
      .then(({ data }) => setAgents((data ?? []) as AgentOption[]))
  }, [isAdmin])

  const assigning = isAdmin && form.assigned_agent !== 'Unassigned'
  const chosenAgent = agents.find(a => a.email === form.assigned_agent)

  function set(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.name.trim() && !form.phone.trim()) {
      setError(t('new.errNameOrPhone'))
      return
    }
    setSaving(true)

    const payload: Record<string, unknown> = {
      ...form, id: form.id.trim(), notes: [], notes_crm: form.notes_crm.trim() || null,
    }
    if (assigning) payload.assignment_type = assignType

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

    // Broker assigned it here: email the agent (same as the Assign screen)
    if (assigning) {
      await fetch('/api/send-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: data.lead.id, agentEmail: form.assigned_agent, assignmentType: data.lead.assignment_type ?? null }),
      }).catch(() => null)
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
              {t('nav.newLead')}
            </div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
              {t('new.sub')}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('lead.cancel')}
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
            gap: '13px 16px',
          }}>
            {isAdmin && (
              <div style={{ gridColumn: '1 / -1' }} role="radiogroup" aria-label={t('new.source')}>
                <span style={labelStyle}>{t('new.source')}</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {SOURCES.map(source => (
                    <button key={source} type="button" role="radio" aria-checked={form.source === source}
                      onClick={() => set('source', source)} style={choiceStyle(form.source === source, source === 'Facebook Marketplace' ? '#1877f2' : source === 'Google Voice' ? '#34a853' : '#8b949e')}>
                      {source === 'Referral' ? t('new.referral') : source === 'Other' ? t('new.other') : source}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Field label={t('new.id')} span2>
              <input
                style={inputStyle}
                placeholder={t('new.idPlaceholder')}
                value={form.id}
                onChange={e => set('id', e.target.value)}
              />
            </Field>

            <Field label={t('new.name')}>
              <input style={inputStyle}
                value={form.name} onChange={e => set('name', e.target.value)} />
            </Field>

            <Field label={t('new.phone')}>
              <input style={inputStyle}
                value={form.phone} onChange={e => set('phone', e.target.value)} />
            </Field>

            <Field label={t('new.area')} span2>
              <input style={inputStyle} placeholder={t('new.areaPh')}
                value={form.area} onChange={e => set('area', e.target.value)} />
            </Field>

            <Field label={t('lead.bedrooms')}>
              <input style={inputStyle}
                value={form.bedrooms} onChange={e => set('bedrooms', e.target.value)} />
            </Field>

            <Field label={t('lead.bathrooms')}>
              <input style={inputStyle}
                value={form.bathrooms} onChange={e => set('bathrooms', e.target.value)} />
            </Field>

            <Field label={t('new.budget')}>
              <input style={inputStyle}
                value={form.budget} onChange={e => set('budget', e.target.value)} />
            </Field>

            <Field label={t('lead.moveIn')}>
              <input style={inputStyle}
                value={form.move_in} onChange={e => set('move_in', e.target.value)} />
            </Field>

            <Field label={t('lead.pets')}>
              <input style={inputStyle}
                value={form.pets} onChange={e => set('pets', e.target.value)} />
            </Field>

            <Field label={t('lead.credit')}>
              <input style={inputStyle}
                value={form.credit} onChange={e => set('credit', e.target.value)} />
            </Field>

            <Field label={t('new.income')}>
              <input style={inputStyle}
                value={form.income} onChange={e => set('income', e.target.value)} />
            </Field>

            <Field label={t('new.mls')} span2>
              <input style={inputStyle}
                value={form.mls_codes} onChange={e => set('mls_codes', e.target.value)} />
            </Field>

            <Field label={t('new.urls')} span2>
              <input style={inputStyle}
                value={form.urls} onChange={e => set('urls', e.target.value)} />
            </Field>

            <Field label={t('new.craigslist')} span2>
              <input style={inputStyle}
                value={form.cl_url} onChange={e => set('cl_url', e.target.value)} />
            </Field>

            <Field label={t('new.cosigner')}>
              <input style={inputStyle}
                value={form.cosigner_info} onChange={e => set('cosigner_info', e.target.value)} />
            </Field>

            <Field label={t('new.stage')}>
              <select style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.stage} onChange={e => set('stage', e.target.value)}>
                {STAGES.map(s => (
                  <option key={s} value={s} style={{ background: '#161b22' }}>{stageName(s)}</option>
                ))}
              </select>
            </Field>

            <Field label={t('new.summary')} span2>
              <textarea style={{ ...inputStyle, minHeight: 84, resize: 'vertical', lineHeight: 1.45 }} placeholder={t('new.summaryPh')}
                value={form.notes_crm} onChange={e => set('notes_crm', e.target.value)} />
            </Field>

            {isAdmin && (
              <div style={{ gridColumn: '1 / -1', padding: 14, borderRadius: 12, background: 'rgba(56,139,253,0.06)', border: '1px solid rgba(56,139,253,0.2)', display: 'grid', gap: 12 }}>
                <Field label={t('new.assignTo')}>
                  <select style={{ ...inputStyle, cursor: 'pointer' }}
                    value={form.assigned_agent} onChange={e => set('assigned_agent', e.target.value)}>
                    <option value="Unassigned" style={{ background: '#161b22' }}>{t('new.leaveUnassigned')}</option>
                    {agents.map(a => (
                      <option key={a.email} value={a.email} style={{ background: '#161b22' }}>
                        {a.full_name || a.email}{a.lead_preference === 'showing_only' ? ` (${t('type.showing')})` : a.lead_preference === 'full_service' ? ` (${t('type.full')})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                {assigning && (
                  <div role="radiogroup" aria-label={t('new.assignType')}>
                    <span style={labelStyle}>{t('new.assignType')}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                      {(['full', 'showing'] as const).map(type => (
                        <button key={type} type="button" role="radio" aria-checked={assignType === type}
                          onClick={() => setAssignType(type)} style={{ ...choiceStyle(assignType === type, type === 'full' ? '#5aa9ff' : '#f5a623'), textAlign: 'left', padding: '10px 12px' }}>
                          <strong style={{ display: 'block' }}>{t(type === 'full' ? 'type.full' : 'type.showing')}</strong>
                          <small style={{ opacity: 0.8 }}>{t(type === 'full' ? 'type.fullPay' : 'type.showingPay')}</small>
                        </button>
                      ))}
                    </div>
                    {chosenAgent && ((assignType === 'full' && chosenAgent.lead_preference === 'showing_only') || (assignType === 'showing' && chosenAgent.lead_preference === 'full_service')) && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#e3b341' }}>{t('new.prefMismatch')}</div>
                    )}
                    <div style={{ marginTop: 8, fontSize: 12, color: C.muted }}>{t('new.emailNote')}</div>
                  </div>
                )}
              </div>
            )}
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
              {t('lead.cancel')}
            </button>
            <button type="submit" disabled={saving} style={{
              background: saving ? 'rgba(56,139,253,0.3)' : 'linear-gradient(135deg, #0550ae, #388bfd)',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 24px', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: saving ? 'none' : '0 2px 10px rgba(56,139,253,0.3)',
            }}>
              {saving ? t('new.creating') : assigning ? t('new.createAssign') : t('new.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
