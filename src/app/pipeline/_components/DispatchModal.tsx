'use client'

import { useState } from 'react'
import { Lead, STAGE_COLORS } from '@/types/lead'
import { AgentProfile, DAYS, DAY_LABELS, DayKey } from '@/types/agent'
import { getSupabase } from '@/lib/supabase'

interface DispatchModalProps {
  lead: Lead
  agents: AgentProfile[]
  onClose: () => void
  onAssigned: (lead: Lead, agentEmail: string) => void
}

const DAYS_ORDER: DayKey[] = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

function LeadSummaryRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{ fontSize: 12, color: '#6e7681', flexShrink: 0, width: 110 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#c9d1d9', fontWeight: 500, textAlign: 'right', flex: 1 }}>{value}</span>
    </div>
  )
}

export function DispatchModal({ lead, agents, onClose, onAssigned }: DispatchModalProps) {
  const supabase = getSupabase()
  const [assigning, setAssigning] = useState<string | null>(null)
  const accent = STAGE_COLORS[lead.stage] ?? '#6e7681'

  const mlsCodes = (lead.mls_codes ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const cities = lead.specific_cities?.join(', ') ?? lead.area ?? '—'

  async function assignTo(agent: AgentProfile) {
    setAssigning(agent.email)
    try {
      // 1. Update Supabase
      const { error } = await supabase
        .from('leads')
        .update({ assigned_agent: agent.email })
        .eq('id', lead.id)

      if (error) throw error

      // 2. Fire assignment email via API route
      await fetch('/api/send-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId:     lead.id,
          agentEmail: agent.email,
          leadName:   lead.name,
          budget:     lead.budget,
          moveIn:     lead.move_in,
          phone:      lead.phone,
          source:     lead.source,
          area:       lead.area,
        }),
      })

      onAssigned({ ...lead, assigned_agent: agent.email }, agent.email)
    } finally {
      setAssigning(null)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
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
          background: '#13181f',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 860,
          maxHeight: '90dvh',
          display: 'flex',
          flexWrap: 'wrap',
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* ── LEFT: Lead Summary ─────────────────────────────── */}
        <div style={{
          width: 320,
          minWidth: 280,
          flexShrink: 0,
          flexGrow: 0,
          borderRight: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Lead header */}
          <div style={{
            padding: '20px 22px',
            background: 'rgba(255,255,255,0.02)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
              New Unassigned Lead
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.4px', marginBottom: 6 }}>
              {lead.name ?? 'Unknown'}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11, background: `${accent}20`, color: accent,
                border: `0.5px solid ${accent}50`, borderRadius: 20,
                padding: '2px 9px', fontWeight: 600,
              }}>
                {lead.stage}
              </span>
              {lead.source && (
                <span style={{
                  fontSize: 10,
                  background: lead.source.toLowerCase().includes('facebook') ? 'rgba(24,119,242,0.2)' : 'rgba(52,168,83,0.2)',
                  color: lead.source.toLowerCase().includes('facebook') ? '#1877f2' : '#34a853',
                  borderRadius: 20, padding: '2px 8px', fontWeight: 600,
                }}>
                  {lead.source.toLowerCase().includes('facebook') ? 'Facebook' : 'Google Voice'}
                </span>
              )}
            </div>
          </div>

          {/* Lead criteria */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
            {lead.phone && (
              <div style={{ marginBottom: 14 }}>
                <a href={`tel:${lead.phone}`} style={{
                  fontSize: 15, color: '#388bfd', fontWeight: 600,
                  textDecoration: 'none', letterSpacing: '-0.2px',
                }}>
                  {lead.phone}
                </a>
              </div>
            )}
            <LeadSummaryRow label="Cities"       value={cities} />
            <LeadSummaryRow label="Bedrooms"     value={lead.bedrooms ? `${lead.bedrooms} bd` : null} />
            <LeadSummaryRow label="Budget"       value={lead.budget} />
            <LeadSummaryRow label="Move-in"      value={lead.move_in} />
            <LeadSummaryRow label="Pets"         value={lead.pets} />
            <LeadSummaryRow label="Credit"       value={lead.credit} />
            <LeadSummaryRow label="Income"       value={lead.income} />
            <LeadSummaryRow label="Criminal/Evic" value={lead.criminal_eviction_status} />

            {mlsCodes.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
                  MLS Picks
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {mlsCodes.map(code => (
                    <span key={code} style={{
                      fontSize: 11, background: 'rgba(56,139,253,0.15)',
                      border: '0.5px solid rgba(56,139,253,0.3)',
                      color: '#388bfd', borderRadius: 6, padding: '3px 8px', fontWeight: 600,
                    }}>
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Agents ──────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            padding: '20px 22px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6fc' }}>Assign to Agent</div>
              <div style={{ fontSize: 12, color: '#6e7681', marginTop: 2 }}>
                {agents.length} agent{agents.length !== 1 ? 's' : ''} available
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#6e7681', width: 30, height: 30, borderRadius: 7,
                cursor: 'pointer', fontSize: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>

          {/* Agent list — sorted by availability: today > tomorrow > most days */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {agents.length === 0 && (
              <div style={{
                textAlign: 'center', padding: '3rem 0',
                color: 'rgba(255,255,255,0.2)', fontSize: 14,
              }}>
                No agents found. Invite agents in Admin → Agents.
              </div>
            )}
            {(() => {
              const todayIdx = new Date().getDay() // 0=Sun
              const todayKey = DAYS_ORDER[(todayIdx + 6) % 7] // Convert to Mon=0
              const tomorrowKey = DAYS_ORDER[(todayIdx + 7) % 7 % 7]

              const sorted = [...agents].sort((a, b) => {
                const aToday = a.availability?.[todayKey]?.active ? 1 : 0
                const bToday = b.availability?.[todayKey]?.active ? 1 : 0
                if (bToday !== aToday) return bToday - aToday

                const aTomorrow = a.availability?.[tomorrowKey]?.active ? 1 : 0
                const bTomorrow = b.availability?.[tomorrowKey]?.active ? 1 : 0
                if (bTomorrow !== aTomorrow) return bTomorrow - aTomorrow

                const aDays = DAYS_ORDER.filter(d => a.availability?.[d]?.active).length
                const bDays = DAYS_ORDER.filter(d => b.availability?.[d]?.active).length
                return bDays - aDays
              })

              return sorted.map(agent => {
              const isCurrentAgent = lead.assigned_agent === agent.email
              const activeDays = DAYS_ORDER.filter(d => agent.availability?.[d]?.active)
              const isAssigning = assigning === agent.email
              const _todayIdx = new Date().getDay()
              const _todayKey = DAYS_ORDER[(_todayIdx + 6) % 7]
              const _tomorrowKey = DAYS_ORDER[(_todayIdx) % 7]
              const availToday = agent.availability?.[_todayKey]?.active
              const availTomorrow = agent.availability?.[_tomorrowKey]?.active

              return (
                <div
                  key={agent.id}
                  style={{
                    background: isCurrentAgent
                      ? 'rgba(56,139,253,0.08)'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isCurrentAgent ? 'rgba(56,139,253,0.3)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 12,
                    padding: '14px 16px',
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    transition: 'background .15s',
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: agent.avatar_url ? 'transparent' : 'rgba(56,139,253,0.15)',
                    border: '1.5px solid rgba(56,139,253,0.3)',
                    overflow: 'hidden', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: '#388bfd',
                  }}>
                    {agent.avatar_url
                      ? <img src={agent.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (agent.full_name ?? agent.email).slice(0, 2).toUpperCase()
                    }
                  </div>

                  {/* Agent info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6fc', marginBottom: 2 }}>
                      {agent.full_name ?? agent.email.split('@')[0]}
                    </div>
                    <div style={{ fontSize: 11, color: '#6e7681', marginBottom: 6 }}>
                      {agent.email}
                      {agent.alert_phone && (
                        <span style={{ marginLeft: 8 }}>· 📱 {agent.alert_phone}</span>
                      )}
                    </div>

                    {/* Availability status badges */}
                    {(availToday || availTomorrow) && (
                      <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
                        {availToday && (
                          <span style={{ fontSize: 10, background: 'rgba(63,185,80,0.15)', color: '#3fb950', borderRadius: 20, padding: '2px 8px', fontWeight: 600, border: '0.5px solid rgba(63,185,80,0.3)' }}>
                            Available today
                          </span>
                        )}
                        {availTomorrow && !availToday && (
                          <span style={{ fontSize: 10, background: 'rgba(227,179,65,0.15)', color: '#e3b341', borderRadius: 20, padding: '2px 8px', fontWeight: 600, border: '0.5px solid rgba(227,179,65,0.3)' }}>
                            Available tomorrow
                          </span>
                        )}
                      </div>
                    )}

                    {/* Availability pills */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {DAYS_ORDER.map(day => {
                        const slot = agent.availability?.[day]
                        const active = slot?.active
                        return (
                          <span
                            key={day}
                            title={active ? `${DAY_LABELS[day]}: ${slot?.start} – ${slot?.end}` : `${DAY_LABELS[day]}: Off`}
                            style={{
                              fontSize: 10, padding: '2px 6px', borderRadius: 4,
                              background: active ? 'rgba(63,185,80,0.15)' : 'rgba(255,255,255,0.04)',
                              color: active ? '#3fb950' : 'rgba(255,255,255,0.2)',
                              border: `0.5px solid ${active ? 'rgba(63,185,80,0.3)' : 'rgba(255,255,255,0.06)'}`,
                              fontWeight: active ? 600 : 400,
                            }}
                          >
                            {DAY_LABELS[day]}
                          </span>
                        )
                      })}
                      {activeDays.length === 0 && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
                          No availability set
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Assign button */}
                  {isCurrentAgent ? (
                    <span style={{
                      fontSize: 11, color: '#388bfd',
                      background: 'rgba(56,139,253,0.12)',
                      border: '0.5px solid rgba(56,139,253,0.3)',
                      borderRadius: 20, padding: '4px 12px', fontWeight: 600,
                    }}>
                      Assigned
                    </span>
                  ) : (
                    <button
                      onClick={() => assignTo(agent)}
                      disabled={isAssigning}
                      style={{
                        background: isAssigning
                          ? 'rgba(56,139,253,0.2)'
                          : 'linear-gradient(135deg, #0550ae, #388bfd)',
                        border: 'none', color: '#fff', borderRadius: 8,
                        padding: '8px 18px', fontSize: 13, fontWeight: 600,
                        cursor: isAssigning ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', flexShrink: 0,
                        boxShadow: isAssigning ? 'none' : '0 2px 8px rgba(56,139,253,0.3)',
                        transition: 'all .15s',
                        opacity: isAssigning ? 0.7 : 1,
                      }}
                    >
                      {isAssigning ? 'Assigning…' : 'Assign →'}
                    </button>
                  )}
                </div>
              )
            })
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
