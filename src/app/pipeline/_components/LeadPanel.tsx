'use client'

import { useState, useRef } from 'react'
import { Lead, STAGES, STAGE_COLORS, Note, LeadDocument } from '@/types/lead'
import { getSupabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { CityAutocomplete } from './CityAutocomplete'

interface LeadPanelProps {
  lead: Lead
  agentEmail: string
  isAdmin: boolean
  onClose: () => void
  onLeadUpdated: (lead: Lead) => void
  onDeleteLead?: (id: string) => void
  onDispatch?: () => void  // admin opens dispatch modal
}

// ── Hardcoded dark theme ──────────────────────────────────────────────────
const C = {
  text:   '#e6edf3',
  sub:    '#c9d1d9',
  muted:  '#8b949e',
  dim:    '#6e7681',
  border: 'rgba(255,255,255,0.07)',
  input:  'rgba(255,255,255,0.06)',
  surface:'rgba(255,255,255,0.04)',
  danger: '#e24b4a',
}

// ── Quick-select pill ─────────────────────────────────────────────────────
function Pill({ label, selected, color, onClick }: {
  label: string; selected: boolean; color?: string; onClick: () => void
}) {
  const c = color ?? '#388bfd'
  return (
    <button onClick={onClick} style={{
      background: selected ? `${c}25` : C.surface,
      border: `1px solid ${selected ? `${c}60` : C.border}`,
      borderRadius: 8, padding: '6px 12px',
      fontSize: 12, fontWeight: selected ? 600 : 400,
      color: selected ? c : C.muted,
      cursor: 'pointer', fontFamily: 'inherit',
      transition: 'all .12s', whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  )
}

function PillGroup({ label, options, value, onSelect }: {
  label: string
  options: { label: string; value: string; color?: string }[]
  value: string | null
  onSelect: (v: string) => void
}) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map(o => (
          <Pill key={o.value} label={o.label}
            selected={value === o.value} color={o.color}
            onClick={() => onSelect(value === o.value ? '' : o.value)} />
        ))}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, color: C.dim,
      textTransform: 'uppercase', letterSpacing: '0.8px',
      marginBottom: 8,
    }}>
      {children}
    </div>
  )
}

function EditRow({ label, value, onChange, onBlur, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  onBlur?: () => void; placeholder?: string
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <SectionLabel>{label}</SectionLabel>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder ?? ''}
        style={{
          width: '100%', background: C.input,
          border: `1px solid ${C.border}`, color: C.text,
          borderRadius: 7, padding: '8px 10px',
          fontSize: 13, outline: 'none', fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

// ── Quick-select data ─────────────────────────────────────────────────────

const CREDIT_OPTIONS = [
  { label: 'Excellent  750+', value: 'Excellent', color: '#3fb950' },
  { label: 'Good  700–749',   value: 'Good',      color: '#e3b341' },
  { label: 'Fair  650–699',   value: 'Fair',      color: '#f0883e' },
  { label: 'Poor  <650',      value: 'Poor',      color: '#e24b4a' },
]

const PET_OPTIONS = [
  { label: 'No Pets',       value: 'No Pets',      color: '#3fb950' },
  { label: 'Cat',           value: 'Cat',          color: '#388bfd' },
  { label: 'Small Dog',     value: 'Small Dog',    color: '#388bfd' },
  { label: 'Large Dog',     value: 'Large Dog',    color: '#a371f7' },
  { label: 'Multiple Pets', value: 'Multiple Pets', color: '#f0883e' },
]

const INCOME_OPTIONS = [
  { label: 'Pay Stubs',        value: 'Pay Stubs',        color: '#388bfd' },
  { label: 'Bank Statements',  value: 'Bank Statements',  color: '#388bfd' },
  { label: 'Self-Employed',    value: 'Self-Employed',    color: '#a371f7' },
  { label: 'Cash',             value: 'Cash',             color: '#e3b341' },
  { label: 'Benefits/SSI',     value: 'Benefits/SSI',     color: '#6e7681' },
]

const CRIMINAL_OPTIONS = [
  { label: '✓ Clean',              value: 'Clean',                 color: '#3fb950' },
  { label: 'Minor Criminal',       value: 'Minor Criminal',        color: '#e3b341' },
  { label: 'Eviction History',     value: 'Eviction History',      color: '#f0883e' },
  { label: 'Criminal & Eviction',  value: 'Criminal & Eviction',   color: '#e24b4a' },
  { label: 'Unknown',              value: 'Unknown',               color: '#6e7681' },
]

// ── Main component ────────────────────────────────────────────────────────
export function LeadPanel({
  lead, agentEmail, isAdmin, onClose, onLeadUpdated, onDeleteLead, onDispatch,
}: LeadPanelProps) {
  const supabase = getSupabase()
  const accent   = STAGE_COLORS[lead.stage] ?? '#6e7681'
  const fileRef  = useRef<HTMLInputElement>(null)

  // Editable field state
  const [leadName,  setLeadName]  = useState(lead.name ?? '')
  const [phone,     setPhone]     = useState(lead.phone ?? '')
  const [budget,    setBudget]    = useState(lead.budget ?? '')
  const [moveIn,    setMoveIn]    = useState(lead.move_in ?? '')
  const [bedrooms,  setBedrooms]  = useState(lead.bedrooms ?? '')
  const [bathrooms, setBathrooms] = useState(lead.bathrooms ?? '')
  const [credit,    setCredit]    = useState(lead.credit ?? '')
  const [pets,      setPets]      = useState(lead.pets ?? '')
  const [income,    setIncome]    = useState(lead.income ?? '')
  const [criminal,  setCriminal]  = useState(lead.criminal_eviction_status ?? '')
  const [cosigner,  setCosigner]  = useState(lead.cosigner_info ?? '')
  const [cities,    setCities]    = useState<string[]>(lead.specific_cities ?? [])
  const [noteText,  setNoteText]  = useState('')
  const [documents, setDocuments] = useState<LeadDocument[]>(lead.documents ?? [])

  const [savingNote,  setSavingNote]  = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [confirmDel,  setConfirmDel]  = useState(false)
  const [hasChanges,  setHasChanges]  = useState(false)
  const [uploading,   setUploading]   = useState(false)

  async function persist(patch: Partial<Lead>) {
    const { error } = await supabase.from('leads').update(patch).eq('id', lead.id)
    if (!error) onLeadUpdated({ ...lead, ...patch })
  }

  // Mark dirty on any field change
  function markDirty() { setHasChanges(true); setSaved(false) }

  // Save ALL changes at once
  async function saveAllChanges() {
    setSaving(true)
    const areaString = cities.length ? cities.join(', ') : lead.area
    const patch: Partial<Lead> = {
      name: leadName || null,
      phone: phone || null,
      budget: budget || null,
      move_in: moveIn || null,
      bedrooms: bedrooms || null,
      bathrooms: bathrooms || null,
      credit: credit || null,
      pets: pets || null,
      income: income || null,
      criminal_eviction_status: criminal || null,
      cosigner_info: cosigner || null,
      specific_cities: cities.length ? cities : null,
      area: areaString || null,
      stage: lead.stage,              // CRITICAL: preserve current stage
      assigned_agent: lead.assigned_agent, // preserve assignment
    }
    await persist(patch)
    setSaving(false)
    setHasChanges(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // File upload to Supabase storage
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop() ?? 'file'
    const path = `lead-docs/${lead.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: false })
    if (error) {
      setUploading(false)
      return
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const newDoc: LeadDocument = {
      name: file.name,
      url: data.publicUrl,
      type: ext,
      uploaded_at: new Date().toISOString(),
      uploaded_by: agentEmail.split('@')[0],
    }
    const updatedDocs = [...documents, newDoc]
    setDocuments(updatedDocs)
    await persist({ documents: updatedDocs })
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function removeDoc(idx: number) {
    const updatedDocs = documents.filter((_, i) => i !== idx)
    setDocuments(updatedDocs)
    await persist({ documents: updatedDocs })
  }

  // Quick-select pills update local state only — saved via Save button
  function selectPill(field: string, value: string) {
    if (field === 'credit')   setCredit(value)
    if (field === 'pets')     setPets(value)
    if (field === 'income')   setIncome(value)
    if (field === 'criminal_eviction_status') setCriminal(value)
    markDirty()
  }

  function updateCities(next: string[]) {
    setCities(next)
    markDirty()
  }

  async function saveNote() {
    if (!noteText.trim()) return
    setSavingNote(true)
    const newNote: Note = {
      ts: format(new Date(), 'MMM d h:mm a'),
      by: agentEmail.split('@')[0],
      text: noteText.trim(),
    }
    const updated = [newNote, ...lead.notes]
    await persist({ notes: updated })
    setNoteText('')
    setSavingNote(false)
  }

  async function handleDeleteLead() {
    await supabase.from('leads').delete().eq('id', lead.id)
    onDeleteLead?.(lead.id)
  }

  const mlsCodes = (lead.mls_codes ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const urls     = (lead.urls     ?? '').split(',').map(s => s.trim()).filter(Boolean)

  const isUnassigned = !lead.assigned_agent || lead.assigned_agent === 'Unassigned'

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: 'rgba(10,13,20,0.97)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderLeft: `1px solid ${C.border}`,
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '14px 18px',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Editable name */}
            <input value={leadName}
              onChange={e => { setLeadName(e.target.value); markDirty() }}
              style={{
                fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: '-0.3px',
                background: 'transparent', border: 'none', outline: 'none',
                width: '100%', padding: 0, marginBottom: 4, fontFamily: 'inherit',
                borderBottom: '1px solid transparent',
              }}
              onFocus={e => e.currentTarget.style.borderBottom = '1px solid rgba(56,139,253,0.4)'}
              onBlur={e => e.currentTarget.style.borderBottom = '1px solid transparent'}
            />
            {/* Editable phone */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input value={phone}
                onChange={e => { setPhone(e.target.value); markDirty() }}
                type="tel"
                style={{
                  fontSize: 13, color: '#388bfd', fontWeight: 600,
                  background: 'transparent', border: 'none', outline: 'none',
                  padding: 0, fontFamily: 'inherit', width: 140,
                  borderBottom: '1px solid transparent',
                }}
                onFocus={e => e.currentTarget.style.borderBottom = '1px solid rgba(56,139,253,0.4)'}
                onBlur={e => e.currentTarget.style.borderBottom = '1px solid transparent'}
              />
              {phone && (
                <a href={`tel:${phone}`} style={{ fontSize: 11, color: '#388bfd', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>call</a>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${C.border}`,
            color: C.dim, width: 28, height: 28, borderRadius: 7,
            cursor: 'pointer', fontSize: 17, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, background: `${accent}20`, color: accent,
            border: `0.5px solid ${accent}50`, borderRadius: 20,
            padding: '3px 10px', fontWeight: 600,
          }}>
            {lead.stage}
          </span>
          {isAdmin && lead.source && (
            <span style={{
              fontSize: 10,
              background: lead.source.toLowerCase().includes('facebook') ? 'rgba(24,119,242,0.18)' : 'rgba(52,168,83,0.18)',
              color: lead.source.toLowerCase().includes('facebook') ? '#1877f2' : '#34a853',
              borderRadius: 20, padding: '2px 8px', fontWeight: 600,
            }}>
              {lead.source.toLowerCase().includes('facebook') ? 'FB' : 'GV'}
            </span>
          )}
        </div>

        {/* Admin: assign/reassign button */}
        {isAdmin && (
          <button
            onClick={onDispatch}
            style={{
              marginTop: 10, width: '100%',
              background: isUnassigned
                ? 'linear-gradient(135deg, #0550ae, #388bfd)'
                : 'rgba(56,139,253,0.1)',
              border: `1px solid ${isUnassigned ? 'transparent' : 'rgba(56,139,253,0.3)'}`,
              color: '#fff', borderRadius: 8, padding: '7px 0',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: isUnassigned ? '0 2px 8px rgba(56,139,253,0.25)' : 'none',
            }}
          >
            {isUnassigned ? '⚡ Assign to Agent' : `↺ Reassign (${(lead.assigned_agent ?? '').split('@')[0]})`}
          </button>
        )}

        {/* Agent: read-only assigned agent */}
        {!isAdmin && (
          <div style={{ marginTop: 8, fontSize: 12, color: C.dim }}>
            Assigned to: <span style={{ color: C.sub, fontWeight: 500 }}>
              {(lead.assigned_agent ?? 'Unassigned').split('@')[0]}
            </span>
          </div>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>

        {/* ── AI Handoff Summary (static, non-editable) ── */}
        {lead.notes_crm && (
          <div style={{
            marginBottom: '1rem',
            background: 'rgba(56,139,253,0.06)',
            border: '1px solid rgba(56,139,253,0.15)',
            borderRadius: 10, padding: '10px 12px',
          }}>
            <div style={{ fontSize: 10, color: '#388bfd', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              AI Summary
            </div>
            <div style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {lead.notes_crm}
            </div>
          </div>
        )}

        {/* ── Core Criteria Grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <EditRow label="Budget (monthly)" value={budget}
            onChange={v => { setBudget(v); markDirty() }} />
          <EditRow label="Bedrooms" value={bedrooms}
            onChange={v => { setBedrooms(v); markDirty() }} />
          <EditRow label="Bathrooms" value={bathrooms}
            onChange={v => { setBathrooms(v); markDirty() }} />
          <EditRow label="Move-in Date" value={moveIn}
            onChange={v => { setMoveIn(v); markDirty() }} />
          <EditRow label="Cosigner" value={cosigner}
            onChange={v => { setCosigner(v); markDirty() }} />
        </div>

        {/* ── Credit quick-select ── */}
        <PillGroup label="Credit" options={CREDIT_OPTIONS}
          value={credit} onSelect={v => selectPill('credit', v)} />

        {/* ── Pets quick-select ── */}
        <PillGroup label="Pets" options={PET_OPTIONS}
          value={pets} onSelect={v => selectPill('pets', v)} />

        {/* ── Income quick-select ── */}
        <PillGroup label="Income Proof" options={INCOME_OPTIONS}
          value={income} onSelect={v => selectPill('income', v)} />

        {/* ── Criminal/Eviction quick-select ── */}
        <PillGroup label="Criminal / Eviction" options={CRIMINAL_OPTIONS}
          value={criminal} onSelect={v => selectPill('criminal_eviction_status', v)} />

        {/* ── Target Cities (below pills so dropdown doesn't cover them) ── */}
        <div style={{ marginBottom: '1rem' }}>
          <SectionLabel>Target Cities</SectionLabel>
          <CityAutocomplete value={cities} onChange={updateCities} />
        </div>

        {/* ── SAVE CHANGES BUTTON ── */}
        <button onClick={saveAllChanges} disabled={saving || (!hasChanges && !saved)} style={{
          width: '100%', marginBottom: '1rem',
          background: saved ? '#3fb950' : hasChanges ? 'linear-gradient(135deg, #0550ae, #388bfd)' : 'rgba(56,139,253,0.15)',
          color: '#fff', border: 'none', borderRadius: 8,
          padding: '10px 0', fontSize: 13, fontWeight: 600,
          cursor: saving || !hasChanges ? (saved ? 'default' : 'not-allowed') : 'pointer',
          fontFamily: 'inherit',
          boxShadow: hasChanges ? '0 4px 16px rgba(56,139,253,0.25)' : 'none',
          transition: 'all .2s',
        }}>
          {saving ? 'Saving...' : saved ? 'Saved' : hasChanges ? 'Save Changes' : 'No Changes'}
        </button>

        {/* ── MLS Picks ── */}
        {mlsCodes.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <SectionLabel>MLS Picks</SectionLabel>
            {mlsCodes.map((code, i) => (
              <div key={code} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 0',
                borderBottom: `0.5px solid rgba(255,255,255,0.05)`,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#388bfd', flexShrink: 0 }} />
                {urls[i]
                  ? <a href={urls[i]} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 13, color: '#388bfd', fontWeight: 600, textDecoration: 'none' }}>
                      {code}
                    </a>
                  : <span style={{ fontSize: 13, color: '#388bfd', fontWeight: 600 }}>{code}</span>
                }
              </div>
            ))}
          </div>
        )}

        {/* ── Documents ── */}
        <div style={{ marginBottom: '1rem' }}>
          <SectionLabel>Documents</SectionLabel>
          {documents.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {documents.map((doc, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '8px 10px',
                }}>
                  <span style={{ fontSize: 11, background: 'rgba(56,139,253,0.15)', color: '#388bfd', borderRadius: 4, padding: '2px 6px', fontWeight: 600, textTransform: 'uppercase', flexShrink: 0 }}>
                    {doc.type}
                  </span>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: '#388bfd', textDecoration: 'none', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {doc.name}
                  </a>
                  <span style={{ fontSize: 10, color: C.dim, flexShrink: 0 }}>{doc.uploaded_by}</span>
                  <button onClick={() => removeDoc(i)} style={{
                    background: 'none', border: 'none', color: 'rgba(226,75,74,0.5)',
                    cursor: 'pointer', fontSize: 14, padding: '0 4px', fontFamily: 'inherit', flexShrink: 0,
                  }}>x</button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
            width: '100%',
            background: uploading ? 'rgba(56,139,253,0.15)' : C.surface,
            border: `1px dashed ${C.border}`,
            color: uploading ? '#388bfd' : C.muted,
            borderRadius: 8, padding: '10px 0',
            fontSize: 12, cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}>
            {uploading ? 'Uploading...' : '+ Upload Document'}
          </button>
        </div>

        {/* ── Agent Notes ── */}
        <SectionLabel>Agent Notes</SectionLabel>
        {lead.notes.length > 0 && (
          <div style={{ marginBottom: '0.75rem' }}>
            {lead.notes.map((note, i) => (
              <div key={i} style={{
                borderLeft: `2px solid ${accent}`,
                paddingLeft: 10, paddingTop: 5, paddingBottom: 5, marginBottom: 8,
                background: `${accent}08`, borderRadius: '0 6px 6px 0',
              }}>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 3 }}>
                  {note.ts} · {note.by}
                </div>
                <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>{note.text}</div>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          
          rows={2}
          style={{
            width: '100%', background: C.input,
            border: `1px solid ${C.border}`, color: C.text,
            borderRadius: 8, padding: '9px 11px',
            fontSize: 13, resize: 'none', outline: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        <button onClick={saveNote} disabled={savingNote || !noteText.trim()} style={{
          marginTop: 7, width: '100%',
          background: savingNote || !noteText.trim() ? 'rgba(56,139,253,0.2)' : 'rgba(56,139,253,0.85)',
          color: '#fff', border: 'none', borderRadius: 8,
          padding: '9px 0', fontSize: 13, fontWeight: 600,
          cursor: savingNote || !noteText.trim() ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}>
          {savingNote ? 'Saving...' : 'Save Note'}
        </button>

        {/* ── Move Stage ── */}
        <div style={{ marginTop: '1.1rem', marginBottom: '1rem' }}>
          <SectionLabel>Move Stage</SectionLabel>
          <select
            value={lead.stage}
            onChange={e => persist({ stage: e.target.value })}
            style={{
              width: '100%', background: C.input,
              border: `1px solid ${C.border}`, color: C.text,
              borderRadius: 8, padding: '9px 11px',
              fontSize: 13, cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
            }}
          >
            {STAGES.map(s => (
              <option key={s} value={s} style={{ background: '#161b22' }}>{s}</option>
            ))}
          </select>
        </div>

        {/* ── Admin: Reassign + Delete ── */}
        {isAdmin && (
          <div style={{ marginBottom: '2rem' }}>
            {/* Reassign button */}
            <button onClick={onDispatch} style={{
              width: '100%', marginBottom: 8,
              background: 'rgba(163,113,247,0.1)',
              border: '1px solid rgba(163,113,247,0.3)',
              color: '#a371f7', borderRadius: 8, padding: '9px 0',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Reassign Lead
            </button>

            {/* Delete button */}
            {!confirmDel ? (
              <button onClick={() => setConfirmDel(true)} style={{
                width: '100%',
                background: 'rgba(226,75,74,0.08)',
                border: `1px solid rgba(226,75,74,0.25)`,
                color: C.danger, borderRadius: 8, padding: '8px 0',
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Delete Lead
              </button>
            ) : (
              <div style={{
                background: 'rgba(226,75,74,0.08)',
                border: `1px solid rgba(226,75,74,0.3)`,
                borderRadius: 8, padding: '12px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 12, color: C.danger, marginBottom: 10 }}>
                  Permanently delete this lead?
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmDel(false)} style={{
                    flex: 1, background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${C.border}`, color: C.muted,
                    borderRadius: 7, padding: '7px 0', fontSize: 12,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>Cancel</button>
                  <button onClick={handleDeleteLead} style={{
                    flex: 1, background: 'rgba(226,75,74,0.8)',
                    border: 'none', color: '#fff', borderRadius: 7,
                    padding: '7px 0', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ height: '1.5rem' }} />
      </div>
    </div>
  )
}
