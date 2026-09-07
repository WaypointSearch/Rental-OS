'use client'

import { useState, useCallback } from 'react'
import { Lead, STAGES, STAGE_COLORS, parseBudget, formatCommission } from '@/types/lead'
import { AgentProfile, DAYS, DAY_LABELS, DayKey } from '@/types/agent'
import { useLeadsRealtime } from '@/lib/useLeadsRealtime'
import { useToast, ToastProvider } from '@/lib/useToast'
import { exportLeadsToCSV } from '@/lib/exportCSV'
import { getSupabase } from '@/lib/supabase'
import { formatDistanceToNowStrict } from 'date-fns'
import { useRouter } from 'next/navigation'

interface AdminDashboardProps {
  leads:       Lead[]
  agents:      AgentProfile[]
  adminEmail:  string
  adminId:     string
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12,
      padding: '14px 18px',
    }}>
      <div style={{ fontSize: 11, color: '#6e7681', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color: color ?? '#f0f6fc', letterSpacing: '-0.5px' }}>
        {value}
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: '#6e7681',
      textTransform: 'uppercase', letterSpacing: '0.8px',
      marginBottom: 12,
    }}>
      {children}
    </div>
  )
}

function AdminInner({ leads: initialLeads, agents: initialAgents, adminEmail, adminId }: AdminDashboardProps) {
  const supabase = getSupabase()
  const router   = useRouter()
  const { push: toast } = useToast()

  const [leads,         setLeads]         = useState<Lead[]>(initialLeads)
  const [agents,        setAgents]        = useState<AgentProfile[]>(initialAgents)
  const [inviteEmail,   setInviteEmail]   = useState('')
  const [inviteLink,    setInviteLink]    = useState<string | null>(null)
  const [inviting,      setInviting]      = useState(false)
  const [deletingUser,  setDeletingUser]  = useState<string | null>(null)
  const [tab,           setTab]           = useState<'overview' | 'agents' | 'leads'>('overview')
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null)
  const [reassignLead,  setReassignLead]  = useState<Lead | null>(null)

  // Realtime
  const onInsert = useCallback((l: Lead) => setLeads((p) => p.find((x) => x.id === l.id) ? p : [l, ...p]), [])
  const onUpdate = useCallback((l: Lead) => setLeads((p) => p.map((x) => (x.id === l.id ? l : x))), [])
  const onDelete = useCallback((id: string) => setLeads((p) => p.filter((l) => l.id !== id)), [])
  useLeadsRealtime({ onInsert, onUpdate, onDelete })

  // ── Stats ──────────────────────────────────────────────────────────────
  const closingSoon = leads.filter((l) =>
    ['Offer Sent', 'Offer Approved', 'HOA Approved'].includes(l.stage)
  ).length

  const totalCommission = leads
    .filter((l) => l.stage !== 'Waiting for contact')
    .reduce((sum, l) => sum + parseBudget(l.budget), 0) / 2

  const movedThisWeek = leads.filter((l) => {
    const days = (Date.now() - new Date(l.created_at).getTime()) / 86_400_000
    return days <= 7
  }).length

  // ── Per-agent stats ────────────────────────────────────────────────────
  const agentStats = agents.map((ag) => {
    const agLeads    = leads.filter((l) => l.assigned_agent === ag.email)
    const commission = agLeads.reduce((s, l) => s + parseBudget(l.budget), 0) / 2
    const closing    = agLeads.filter((l) => ['Offer Sent','Offer Approved','HOA Approved','Move in / Deposit'].includes(l.stage)).length
    return { ...ag, leadCount: agLeads.length, commission, closing }
  })

  // ── Invite ────────────────────────────────────────────────────────────
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteLink(null)
    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    })
    const data = await res.json()
    if (data.error) {
      toast({ type: 'error', title: 'Invite failed', body: data.error })
    } else {
      setInviteLink(data.link)
      toast({ type: 'success', title: 'Invite link generated', body: inviteEmail })
      setInviteEmail('')
    }
    setInviting(false)
  }

  // ── Delete agent ──────────────────────────────────────────────────────
  async function handleDeleteAgent(userId: string, email: string) {
    setDeletingUser(userId)
    const res = await fetch('/api/admin/delete-user', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const data = await res.json()
    if (data.error) {
      toast({ type: 'error', title: 'Delete failed', body: data.error })
    } else {
      setAgents((p) => p.filter((a) => a.id !== userId))
      toast({ type: 'success', title: 'Agent removed', body: email })
    }
    setDeletingUser(null)
  }

  // ── Delete lead ───────────────────────────────────────────────────────
  async function handleDeleteLead(id: string) {
    await supabase.from('leads').delete().eq('id', id)
    setLeads((p) => p.filter((l) => l.id !== id))
    toast({ type: 'info', title: 'Lead deleted' })
  }

  // ── Reassign lead to agent ─────────────────────────────────────────
  async function handleReassign(lead: Lead, toAgent: AgentProfile) {
    const { error } = await supabase.from('leads').update({ assigned_agent: toAgent.email }).eq('id', lead.id)
    if (!error) {
      setLeads(p => p.map(l => l.id === lead.id ? { ...l, assigned_agent: toAgent.email } : l))
      setReassignLead(null)
      toast({ type: 'success', title: 'Reassigned', body: `${lead.name} → ${toAgent.full_name ?? toAgent.email.split('@')[0]}` })
    }
  }

  // Get leads for selected agent
  const agentLeads = selectedAgent ? leads.filter(l => l.assigned_agent === selectedAgent.email) : []

  const NAV_TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'agents',   label: `Agents (${agents.length})` },
    { key: 'leads',    label: `All Leads (${leads.length})` },
  ] as const

  return (
    <div style={{
      background: '#0a0d14',
      color: '#e6edf3',
      fontFamily: 'var(--font-geist-sans, system-ui)',
      minHeight: '100dvh',
      fontSize: 14,
    }}>
      {/* Background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 70% 40% at 30% 10%, rgba(163,113,247,0.07) 0%, transparent 60%), radial-gradient(ellipse 50% 30% at 80% 90%, rgba(56,139,253,0.05) 0%, transparent 60%)',
      }} />

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(13,16,28,0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 0.75rem',
        height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg, #4c1d95, #a371f7)',
            borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 10px rgba(163,113,247,0.3)',
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 1L15 5v6L8 15 1 11V5L8 1z" stroke="white" strokeWidth="1.5" fill="none"/>
              <circle cx="8" cy="8" r="2" fill="white"/>
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#f0f6fc' }}>God Mode</span>
          <span style={{
            fontSize: 10, background: 'rgba(163,113,247,0.2)',
            color: '#a371f7', border: '0.5px solid rgba(163,113,247,0.4)',
            borderRadius: 20, padding: '2px 8px', fontWeight: 600,
          }}>ADMIN</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => router.push('/pipeline')}
            style={{
              background: 'rgba(56,139,253,0.12)',
              border: '0.5px solid rgba(56,139,253,0.3)',
              color: '#388bfd',
              padding: '5px 12px', borderRadius: 6,
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ← Pipeline
          </button>
          <button
            onClick={() => exportLeadsToCSV(leads)}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#8b949e',
              padding: '5px 11px', borderRadius: 6,
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ↓ Export All
          </button>
        </div>
      </nav>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '1rem 0.75rem' }}>

        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 2,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10, padding: 4,
          marginBottom: '1.5rem',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch' as any,
        }}>
          {NAV_TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              background: tab === key ? 'rgba(163,113,247,0.2)' : 'transparent',
              border: tab === key ? '0.5px solid rgba(163,113,247,0.4)' : '0.5px solid transparent',
              color: tab === key ? '#a371f7' : '#6e7681',
              borderRadius: 7, padding: '6px 16px',
              fontSize: 13, fontWeight: tab === key ? 600 : 400,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ──────────────────────────────────────────────── */}
        {tab === 'overview' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
              <StatCard label="Total Leads"      value={leads.length} />
              <StatCard label="Active Agents"    value={agents.length} />
              <StatCard label="Closing Soon"     value={closingSoon} color="#f0883e" />
              <StatCard label="New This Week"    value={movedThisWeek} color="#3fb950" />
              <StatCard label="Total Commission" value={formatCommission(totalCommission)} color="#a371f7" />
            </div>

            {/* Pipeline funnel */}
            <SectionTitle>Pipeline Funnel</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '2rem' }}>
              {STAGES.map((stage) => {
                const count   = leads.filter((l) => l.stage === stage).length
                const pct     = leads.length ? (count / leads.length) * 100 : 0
                const accent  = STAGE_COLORS[stage]
                const comm    = leads.filter((l) => l.stage === stage).reduce((s, l) => s + parseBudget(l.budget), 0) / 2
                return (
                  <div key={stage} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8, padding: '8px 12px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{ width: 100, fontSize: 11, color: '#8b949e', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stage}</div>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: accent, borderRadius: 4, transition: 'width .5s ease' }} />
                    </div>
                    <div style={{ width: 28, textAlign: 'right', fontSize: 13, fontWeight: 600, color: accent }}>{count}</div>
                    <div style={{ width: 72, textAlign: 'right', fontSize: 12, color: '#3fb950', fontWeight: 500 }}>
                      {formatCommission(comm)}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Agent activity summary */}
            <SectionTitle>Agent Activity <span style={{ fontSize: 11, color: '#6e7681', fontWeight: 400 }}>— click an agent to view their leads</span></SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {agentStats.map((ag) => (
                <div key={ag.id} onClick={() => setSelectedAgent(ag)} style={{
                  background: selectedAgent?.id === ag.id ? 'rgba(56,139,253,0.08)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${selectedAgent?.id === ag.id ? 'rgba(56,139,253,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 12, padding: '14px 16px',
                  cursor: 'pointer', transition: 'all .15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: ag.avatar_url ? 'transparent' : 'rgba(56,139,253,0.2)',
                      border: '1.5px solid rgba(56,139,253,0.3)',
                      overflow: 'hidden', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 600, color: '#388bfd',
                    }}>
                      {ag.avatar_url
                        ? <img src={ag.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (ag.full_name ?? ag.email).slice(0, 2).toUpperCase()
                      }
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f6fc' }}>
                        {ag.full_name ?? ag.email.split('@')[0]}
                      </div>
                      <div style={{ fontSize: 11, color: '#6e7681' }}>{ag.email}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { l: 'Leads',   v: ag.leadCount,                  c: '#388bfd' },
                      { l: 'Closing', v: ag.closing,                    c: '#f0883e' },
                      { l: 'Commiss', v: formatCommission(ag.commission), c: '#a371f7' },
                    ].map(({ l, v, c }) => (
                      <div key={l} style={{
                        background: 'rgba(255,255,255,0.04)', borderRadius: 7,
                        padding: '6px 8px', textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>{l}</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: c }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Availability pills */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
                    {DAYS.map((day) => {
                      const active = ag.availability?.[day as DayKey]?.active
                      return (
                        <span key={day} style={{
                          fontSize: 10, padding: '2px 6px', borderRadius: 4,
                          background: active ? 'rgba(63,185,80,0.15)' : 'rgba(255,255,255,0.04)',
                          color: active ? '#3fb950' : '#6e7681',
                          border: `0.5px solid ${active ? 'rgba(63,185,80,0.3)' : 'rgba(255,255,255,0.07)'}`,
                          fontWeight: active ? 600 : 400,
                        }}>
                          {DAY_LABELS[day as DayKey]}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Selected Agent's Leads ── */}
            {selectedAgent && (
              <div style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <SectionTitle>{selectedAgent.full_name ?? selectedAgent.email.split('@')[0]}&apos;s Leads ({agentLeads.length})</SectionTitle>
                  <button onClick={() => setSelectedAgent(null)} style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#8b949e', borderRadius: 6, padding: '4px 12px', fontSize: 12,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>Close</button>
                </div>

                {agentLeads.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#6e7681', padding: '2rem 0', textAlign: 'center' }}>No leads assigned</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                    {agentLeads.map(lead => {
                      const accent = STAGE_COLORS[lead.stage] ?? '#6e7681'
                      return (
                        <div key={lead.id} style={{
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 12, padding: '14px', borderLeft: `3px solid ${accent}`,
                        }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6fc', marginBottom: 4 }}>{lead.name ?? 'Unknown'}</div>
                          {lead.phone && <div style={{ fontSize: 12, color: '#6e7681', marginBottom: 6 }}>{lead.phone}</div>}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            {lead.budget && <span style={{ fontSize: 11, color: accent, fontWeight: 600 }}>{lead.budget}</span>}
                            {lead.area && <span style={{ fontSize: 11, color: '#8b949e' }}>{lead.area}</span>}
                            {lead.move_in && <span style={{ fontSize: 11, color: '#8b949e' }}>Move: {lead.move_in}</span>}
                          </div>
                          <span style={{ fontSize: 10, background: `${accent}18`, color: accent, borderRadius: 6, padding: '2px 8px', fontWeight: 600, border: `0.5px solid ${accent}40` }}>
                            {lead.stage}
                          </span>
                          <button onClick={() => setReassignLead(lead)} style={{
                            display: 'block', width: '100%', marginTop: 10,
                            background: 'rgba(163,113,247,0.1)', border: '1px solid rgba(163,113,247,0.3)',
                            color: '#a371f7', borderRadius: 7, padding: '6px 0',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                          }}>Reassign</button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Reassign Modal (available on all tabs) ── */}
        {reassignLead && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setReassignLead(null)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: '#161b22', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 400, maxHeight: '80dvh', overflowY: 'auto',
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#f0f6fc', marginBottom: 4 }}>Reassign: {reassignLead.name ?? 'Unknown'}</div>
              <div style={{ fontSize: 12, color: '#6e7681', marginBottom: 16 }}>Currently: {(reassignLead.assigned_agent ?? 'Unassigned').split('@')[0]}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {agents.map(ag => (
                  <button key={ag.id} onClick={() => handleReassign(reassignLead, ag)} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: reassignLead.assigned_agent === ag.email ? 'rgba(56,139,253,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${reassignLead.assigned_agent === ag.email ? 'rgba(56,139,253,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left',
                  }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: ag.avatar_url ? 'transparent' : 'rgba(56,139,253,0.2)', border: '1px solid rgba(56,139,253,0.3)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#388bfd' }}>
                      {ag.avatar_url ? <img src={ag.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (ag.full_name ?? ag.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#f0f6fc' }}>{ag.full_name ?? ag.email.split('@')[0]}</div>
                      <div style={{ fontSize: 11, color: '#6e7681' }}>{ag.email}</div>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setReassignLead(null)} style={{ marginTop: 12, width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#8b949e', borderRadius: 8, padding: '8px 0', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── AGENTS TAB ────────────────────────────────────────────────── */}
        {tab === 'agents' && (
          <>
            {/* Invite form */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '1.25rem',
              marginBottom: '1.5rem',
            }}>
              <SectionTitle>Invite New Agent</SectionTitle>
              <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8 }}>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="agent@brokerage.com"
                  required
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e6edf3',
                    borderRadius: 8, padding: '9px 12px',
                    fontSize: 13, outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <button type="submit" disabled={inviting} style={{
                  background: 'linear-gradient(135deg, #4c1d95, #a371f7)',
                  color: '#fff', border: 'none', borderRadius: 8,
                  padding: '9px 20px', fontSize: 13, fontWeight: 600,
                  cursor: inviting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  opacity: inviting ? 0.7 : 1,
                }}>
                  {inviting ? 'Generating…' : 'Generate Invite Link'}
                </button>
              </form>

              {inviteLink && (
                <div style={{
                  marginTop: 12,
                  background: 'rgba(163,113,247,0.08)',
                  border: '1px solid rgba(163,113,247,0.25)',
                  borderRadius: 8, padding: '10px 14px',
                }}>
                  <div style={{ fontSize: 11, color: '#a371f7', marginBottom: 6, fontWeight: 600 }}>
                    Invite link (share once, expires in 24h):
                  </div>
                  <div style={{
                    fontSize: 12, color: '#c9d1d9', wordBreak: 'break-all',
                    fontFamily: 'var(--font-geist-mono, monospace)',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 6, padding: '8px 10px',
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                  }}>
                    <span style={{ flex: 1 }}>{inviteLink}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(inviteLink); toast({ type: 'success', title: 'Copied!' }) }}
                      style={{
                        background: 'rgba(163,113,247,0.2)',
                        border: '0.5px solid rgba(163,113,247,0.4)',
                        color: '#a371f7', borderRadius: 5,
                        padding: '3px 10px', fontSize: 11,
                        cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Agent list */}
            <SectionTitle>Active Agents</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {agentStats.map((ag) => (
                <div key={ag.id} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: ag.avatar_url ? 'transparent' : 'rgba(56,139,253,0.15)',
                    border: '1.5px solid rgba(56,139,253,0.3)',
                    overflow: 'hidden', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 600, color: '#388bfd',
                  }}>
                    {ag.avatar_url
                      ? <img src={ag.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (ag.full_name ?? ag.email).slice(0, 2).toUpperCase()
                    }
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#f0f6fc' }}>
                        {ag.full_name ?? ag.email.split('@')[0]}
                      </span>
                      {ag.is_admin && (
                        <span style={{
                          fontSize: 9, background: 'rgba(163,113,247,0.2)',
                          color: '#a371f7', borderRadius: 20,
                          padding: '1px 7px', fontWeight: 700, letterSpacing: '0.5px',
                        }}>ADMIN</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#6e7681' }}>{ag.email}</div>
                    {ag.alert_phone && (
                      <div style={{ fontSize: 12, color: '#6e7681', marginTop: 2 }}>
                        📱 {ag.alert_phone}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                    {[
                      { l: 'Leads',    v: ag.leadCount,                   c: '#388bfd' },
                      { l: 'Closing',  v: ag.closing,                     c: '#f0883e' },
                      { l: 'Comm.',    v: formatCommission(ag.commission), c: '#a371f7' },
                    ].map(({ l, v, c }) => (
                      <div key={l} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 2 }}>{l}</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: c }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Delete (only non-admin, non-self) */}
                  {!ag.is_admin && ag.id !== adminId && (
                    <button
                      onClick={() => handleDeleteAgent(ag.id, ag.email)}
                      disabled={deletingUser === ag.id}
                      style={{
                        background: 'rgba(226,75,74,0.1)',
                        border: '1px solid rgba(226,75,74,0.25)',
                        color: '#e24b4a', borderRadius: 7,
                        padding: '6px 12px', fontSize: 12,
                        cursor: deletingUser === ag.id ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', flexShrink: 0,
                      }}
                    >
                      {deletingUser === ag.id ? '…' : 'Remove'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── ALL LEADS TAB ─────────────────────────────────────────────── */}
        {tab === 'leads' && (
          <>
            <SectionTitle>All Leads — {leads.length} total</SectionTitle>
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontSize: 13, minWidth: 900,
              }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {['Name', 'Stage', 'Budget', 'Move-in', 'Agent', 'Source', 'Age', ''].map((h) => (
                      <th key={h} style={{
                        padding: '8px 12px', textAlign: 'left',
                        fontSize: 10, color: '#6e7681', fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.6px',
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => {
                    const accent = STAGE_COLORS[lead.stage]
                    const age    = formatDistanceToNowStrict(new Date(lead.created_at))
                    return (
                      <tr key={lead.id} style={{
                        background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}>
                        <td style={{ padding: '10px 12px', color: '#f0f6fc', fontWeight: 600 }}>
                          {lead.name ?? '—'}
                          {lead.phone && <div style={{ fontSize: 11, color: '#6e7681', fontWeight: 400 }}>{lead.phone}</div>}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            fontSize: 11, background: `${accent}18`, color: accent,
                            borderRadius: 6, padding: '3px 8px', fontWeight: 600,
                            border: `0.5px solid ${accent}40`,
                          }}>
                            {lead.stage}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#c9d1d9' }}>{lead.budget ?? '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#8b949e' }}>{lead.move_in ?? '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#8b949e' }}>
                          {(lead.assigned_agent ?? 'Unassigned').split('@')[0]}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {lead.source && (
                            <span style={{
                              fontSize: 10,
                              background: lead.source.toLowerCase().includes('facebook') ? 'rgba(24,119,242,0.15)' : 'rgba(52,168,83,0.15)',
                              color: lead.source.toLowerCase().includes('facebook') ? '#1877f2' : '#34a853',
                              borderRadius: 20, padding: '2px 7px', fontWeight: 600,
                            }}>
                              {lead.source.toLowerCase().includes('facebook') ? 'FB' : 'GV'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#6e7681', fontSize: 12 }}>{age}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleDeleteLead(lead.id)}
                            style={{
                              background: 'none', border: 'none',
                              color: 'rgba(226,75,74,0.5)',
                              cursor: 'pointer', fontSize: 13,
                              fontFamily: 'inherit', padding: '2px 6px',
                            }}
                            title="Delete"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div style={{ height: '3rem' }} />
      </div>
    </div>
  )
}

export function AdminDashboard(props: AdminDashboardProps) {
  return <ToastProvider><AdminInner {...props} /></ToastProvider>
}
