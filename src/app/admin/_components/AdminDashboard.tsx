'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  BellRing,
  Check,
  Clipboard,
  Download,
  FileSignature,
  Gauge,
  MailPlus,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRoundPlus,
  UsersRound,
} from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import { useRouter } from 'next/navigation'
import { Lead, STAGES, STAGE_COLORS, parseBudget, formatCommission } from '@/types/lead'
import { AgentProfile, DAYS, DAY_LABELS, DayKey } from '@/types/agent'
import { useLeadsRealtime } from '@/lib/useLeadsRealtime'
import { useToast, ToastProvider } from '@/lib/useToast'
import { exportLeadsToCSV } from '@/lib/exportCSV'
import { getSupabase } from '@/lib/supabase'

interface AdminDashboardProps {
  leads: Lead[]
  agents: AgentProfile[]
  adminEmail: string
  adminId: string
}

type Tab = 'command' | 'team' | 'leads'

function isUnassigned(lead: Lead) {
  return !lead.assigned_agent || lead.assigned_agent === 'Unassigned'
}

function agentName(agent: AgentProfile) {
  return agent.full_name || agent.email.split('@')[0]
}

function agentInitials(agent: AgentProfile) {
  return agentName(agent).split(/\s+/).map(part => part[0] || '').join('').slice(0, 2).toUpperCase()
}

function stageCommission(leads: Lead[]) {
  return leads.reduce((sum, lead) => sum + parseBudget(lead.budget), 0) / 2
}

function AdminInner({ leads: initialLeads, agents: initialAgents, adminEmail, adminId: _adminId }: AdminDashboardProps) {
  const supabase = getSupabase()
  const router = useRouter()
  const { push: toast } = useToast()

  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [agents, setAgents] = useState<AgentProfile[]>(initialAgents)
  const [tab, setTab] = useState<Tab>('command')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [deletingUser, setDeletingUser] = useState<string | null>(null)

  const onInsert = useCallback((lead: Lead) => {
    setLeads(previous => previous.find(item => item.id === lead.id) ? previous : [lead, ...previous])
  }, [])
  const onUpdate = useCallback((lead: Lead) => {
    setLeads(previous => previous.map(item => item.id === lead.id ? lead : item))
  }, [])
  const onDelete = useCallback((id: string) => {
    setLeads(previous => previous.filter(lead => lead.id !== id))
  }, [])
  useLeadsRealtime({ onInsert, onUpdate, onDelete })

  const ready = leads.filter(lead => lead.stage === 'Waiting for contact' && isUnassigned(lead))
  const active = leads.filter(lead => !['Waiting for contact', 'Move in / Deposit'].includes(lead.stage))
  const closing = leads.filter(lead => ['Offer Sent', 'Offer Approved', 'HOA Approved'].includes(lead.stage))
  const closed = leads.filter(lead => lead.stage === 'Move in / Deposit')
  const potentialCommission = stageCommission(leads.filter(lead => lead.stage !== 'Waiting for contact'))

  const agentStats = useMemo(() => agents.map(agent => {
    const assigned = leads.filter(lead => lead.assigned_agent === agent.email)
    return {
      ...agent,
      leadCount: assigned.length,
      contactCount: assigned.filter(lead => lead.stage === 'Waiting for contact').length,
      closingCount: assigned.filter(lead => ['Offer Sent', 'Offer Approved', 'HOA Approved'].includes(lead.stage)).length,
      closedCount: assigned.filter(lead => lead.stage === 'Move in / Deposit').length,
      commission: stageCommission(assigned),
    }
  }).sort((a, b) => b.leadCount - a.leadCount), [agents, leads])

  const selectedAgent = selectedAgentId ? agentStats.find(agent => agent.id === selectedAgentId) ?? null : null
  const selectedAgentLeads = selectedAgent ? leads.filter(lead => lead.assigned_agent === selectedAgent.email) : []

  const visibleLeads = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return leads
    return leads.filter(lead => [
      lead.name,
      lead.phone,
      lead.area,
      lead.stage,
      lead.assigned_agent,
      lead.budget,
    ].some(value => String(value ?? '').toLowerCase().includes(needle)))
  }, [leads, query])

  async function handleInvite(event: React.FormEvent) {
    event.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteLink(null)

    try {
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      })
      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error || 'Invite failed')
      setInviteLink(data.link)
      toast({ type: 'success', title: 'Agent invite ready', body: inviteEmail.trim() })
      setInviteEmail('')
    } catch (error) {
      toast({ type: 'error', title: 'Invite failed', body: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setInviting(false)
    }
  }

  async function copyInvite() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    toast({ type: 'success', title: 'Invite copied', body: 'Send this secure link to the agent.' })
  }

  async function handleDeleteAgent(userId: string, email: string) {
    if (!window.confirm(`Remove ${email} from Rental OS?`)) return
    setDeletingUser(userId)
    try {
      const response = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error || 'Delete failed')
      setAgents(previous => previous.filter(agent => agent.id !== userId))
      if (selectedAgentId === userId) setSelectedAgentId(null)
      toast({ type: 'success', title: 'Agent removed', body: email })
    } catch (error) {
      toast({ type: 'error', title: 'Could not remove agent', body: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setDeletingUser(null)
    }
  }

  async function handleDeleteLead(id: string, name: string | null) {
    if (!window.confirm(`Delete ${name || 'this lead'}?`)) return
    const { error } = await supabase.from('leads').delete().eq('id', id)
    if (error) {
      toast({ type: 'error', title: 'Delete failed', body: error.message })
      return
    }
    setLeads(previous => previous.filter(lead => lead.id !== id))
    toast({ type: 'info', title: 'Lead deleted' })
  }

  async function reassignLead(lead: Lead, email: string) {
    const nextEmail = email || 'Unassigned'
    const { error } = await supabase.from('leads').update({ assigned_agent: nextEmail }).eq('id', lead.id)
    if (error) {
      toast({ type: 'error', title: 'Reassign failed', body: error.message })
      return
    }
    setLeads(previous => previous.map(item => item.id === lead.id ? { ...item, assigned_agent: nextEmail } : item))
    toast({ type: 'success', title: 'Assignment updated', body: nextEmail === 'Unassigned' ? 'Lead is unassigned' : `→ ${nextEmail.split('@')[0]}` })
  }

  const commandMetrics = [
    { label: 'Ready to assign', value: ready.length, tone: 'var(--ros-brand)', icon: UserRoundPlus, sub: 'Qualified, waiting on you' },
    { label: 'Active leads', value: active.length, tone: 'var(--ros-blue)', icon: Activity, sub: 'Currently being worked' },
    { label: 'Closing', value: closing.length, tone: 'var(--ros-green)', icon: FileSignature, sub: 'Offer / approval stage' },
    { label: 'Agents', value: agents.length, tone: 'var(--ros-purple)', icon: UsersRound, sub: 'Profiles in Rental OS' },
    { label: 'Closed', value: closed.length, tone: 'var(--ros-green)', icon: Check, sub: 'Move in / deposit' },
    { label: 'Potential commission', value: formatCommission(potentialCommission), tone: 'var(--ros-brand-2)', icon: Gauge, sub: 'Half-month gross estimate' },
  ]

  return (
    <main className="ros-admin-shell">
      <nav className="ros-admin-nav">
        <button className="ros-admin-brand" onClick={() => router.push('/pipeline')}>
          <span className="ros-logo"><ShieldCheck size={20}/></span>
          <span>
            <strong>Broker Center</strong>
            <small>Rental OS · Sun Ocean Realty</small>
          </span>
        </button>

        <div className="ros-admin-nav-actions">
          <span className="ros-hide-mobile" style={{ color: 'var(--ros-muted-2)', fontSize: 10 }}>{adminEmail}</span>
          <button className="ros-btn" onClick={() => exportLeadsToCSV(leads)}><Download size={14}/> <span className="ros-hide-mobile">Export</span></button>
          <button className="ros-btn ros-btn-primary" onClick={() => router.push('/pipeline')}><ArrowLeft size={14}/> Pipeline</button>
        </div>
      </nav>

      <div className="ros-admin-content">
        <header className="ros-admin-hero">
          <div>
            <div className="ros-admin-kicker">Broker command center</div>
            <h1>{tab === 'command' ? 'What needs your attention.' : tab === 'team' ? 'Your rental team.' : 'Every rental lead.'}</h1>
            <p>{tab === 'command' ? 'See what is moving, what is waiting, and where to intervene.' : tab === 'team' ? 'Manage coverage, availability and agent access.' : 'Search, reassign and clean up the full pipeline.'}</p>
          </div>
          {ready.length > 0 && (
            <button className="ros-admin-alert" onClick={() => router.push('/pipeline')}>
              <BellRing size={16}/>
              <span><strong>{ready.length} ready to assign</strong><small>Open pipeline to dispatch</small></span>
            </button>
          )}
        </header>

        <div className="ros-admin-tabs">
          <button className={tab === 'command' ? 'is-active' : ''} onClick={() => setTab('command')}><Gauge size={14}/> Command</button>
          <button className={tab === 'team' ? 'is-active' : ''} onClick={() => setTab('team')}><UsersRound size={14}/> Team <span>{agents.length}</span></button>
          <button className={tab === 'leads' ? 'is-active' : ''} onClick={() => setTab('leads')}><Activity size={14}/> All leads <span>{leads.length}</span></button>
        </div>

        {tab === 'command' && (
          <>
            <section className="ros-admin-metrics">
              {commandMetrics.map(metric => {
                const Icon = metric.icon
                return (
                  <article key={metric.label} style={{ '--metric-tone': metric.tone } as React.CSSProperties}>
                    <div className="ros-admin-metric-top"><span>{metric.label}</span><Icon size={15}/></div>
                    <strong>{metric.value}</strong>
                    <small>{metric.sub}</small>
                  </article>
                )
              })}
            </section>

            <div className="ros-admin-grid">
              <section className="ros-admin-panel ros-admin-ready-panel">
                <div className="ros-admin-panel-head">
                  <div><span className="ros-admin-section-kicker">Dispatch queue</span><h2>Ready to assign</h2></div>
                  <button className="ros-btn" onClick={() => router.push('/pipeline')}>Open pipeline</button>
                </div>
                <div className="ros-admin-ready-list">
                  {ready.slice(0, 6).map(lead => (
                    <div key={lead.id} className="ros-admin-ready-row">
                      <span className="ros-ready-dot"/>
                      <div className="ros-admin-ready-main">
                        <strong>{lead.name || 'Unnamed lead'}</strong>
                        <span>{lead.area || 'Area unknown'} · {lead.bedrooms || '?'} bd · {lead.budget || 'Budget ?'}</span>
                      </div>
                      <small>{formatDistanceToNowStrict(new Date(lead.created_at), { addSuffix: true })}</small>
                    </div>
                  ))}
                  {ready.length === 0 && <div className="ros-admin-empty"><Check size={22}/><strong>Dispatch queue is clear</strong><span>No qualified unassigned leads right now.</span></div>}
                </div>
              </section>

              <section className="ros-admin-panel">
                <div className="ros-admin-panel-head">
                  <div><span className="ros-admin-section-kicker">Pipeline health</span><h2>Stage distribution</h2></div>
                </div>
                <div className="ros-admin-funnel">
                  {STAGES.map(stage => {
                    const stageLeads = leads.filter(lead => lead.stage === stage)
                    const count = stageLeads.length
                    const pct = leads.length ? Math.max(2, (count / leads.length) * 100) : 0
                    const accent = STAGE_COLORS[stage]
                    return (
                      <div key={stage}>
                        <div className="ros-admin-funnel-label"><span>{stage}</span><strong style={{ color: accent }}>{count}</strong></div>
                        <div className="ros-admin-funnel-track"><span style={{ width: `${pct}%`, background: accent }}/></div>
                      </div>
                    )
                  })}
                </div>
              </section>
            </div>

            <section className="ros-admin-panel" style={{ marginTop: 12 }}>
              <div className="ros-admin-panel-head">
                <div><span className="ros-admin-section-kicker">Workload</span><h2>Agent pulse</h2></div>
                <button className="ros-btn" onClick={() => setTab('team')}>Manage team</button>
              </div>
              <div className="ros-admin-agent-grid">
                {agentStats.slice(0, 8).map(agent => (
                  <button key={agent.id} className="ros-admin-agent-card" onClick={() => { setSelectedAgentId(agent.id); setTab('team') }}>
                    <span className="ros-admin-agent-avatar">{agent.avatar_url ? <img src={agent.avatar_url} alt=""/> : agentInitials(agent)}</span>
                    <span className="ros-admin-agent-copy"><strong>{agentName(agent)}</strong><small>{agent.leadCount} leads · {agent.closingCount} closing</small></span>
                    <span className="ros-admin-agent-number">{agent.leadCount}</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'team' && (
          <>
            <section className="ros-admin-invite">
              <div>
                <span className="ros-admin-section-kicker">Agent access</span>
                <h2>Invite an agent</h2>
                <p>Generate a secure one-time link. The agent opens it, chooses their own password, then can use password or magic-link login.</p>
              </div>
              <form onSubmit={handleInvite}>
                <div className="ros-admin-invite-input"><MailPlus size={15}/><input type="email" required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="agent@email.com"/></div>
                <button className="ros-btn ros-btn-primary" disabled={inviting}>{inviting ? 'Creating…' : 'Create invite'}</button>
              </form>
              {inviteLink && (
                <div className="ros-admin-invite-link">
                  <div><strong>Secure invite ready</strong><span>{inviteLink}</span></div>
                  <button className="ros-btn" onClick={copyInvite}><Clipboard size={14}/> Copy</button>
                </div>
              )}
            </section>

            <section className="ros-admin-team-layout">
              <div className="ros-admin-agent-list">
                {agentStats.map(agent => (
                  <button key={agent.id} className={`ros-admin-team-row ${selectedAgentId === agent.id ? 'is-selected' : ''}`} onClick={() => setSelectedAgentId(agent.id)}>
                    <span className="ros-admin-agent-avatar">{agent.avatar_url ? <img src={agent.avatar_url} alt=""/> : agentInitials(agent)}</span>
                    <span className="ros-admin-agent-copy"><strong>{agentName(agent)} {agent.is_admin && <em>Broker</em>}</strong><small>{agent.email}</small></span>
                    <span className="ros-admin-team-meta"><strong>{agent.leadCount}</strong><small>leads</small></span>
                  </button>
                ))}
              </div>

              <div className="ros-admin-agent-detail">
                {selectedAgent ? (
                  <>
                    <div className="ros-admin-agent-detail-head">
                      <span className="ros-admin-agent-avatar ros-admin-agent-avatar-lg">{selectedAgent.avatar_url ? <img src={selectedAgent.avatar_url} alt=""/> : agentInitials(selectedAgent)}</span>
                      <div><span className="ros-admin-section-kicker">Agent profile</span><h2>{agentName(selectedAgent)}</h2><p>{selectedAgent.email}</p></div>
                      {!selectedAgent.is_admin && <button className="ros-btn" disabled={deletingUser === selectedAgent.id} onClick={() => handleDeleteAgent(selectedAgent.id, selectedAgent.email)}><Trash2 size={13}/> Remove</button>}
                    </div>

                    <div className="ros-admin-profile-facts">
                      <div><span>License</span><strong>{selectedAgent.license_number || '—'}</strong></div>
                      <div><span>Lead preference</span><strong>{selectedAgent.lead_preference?.replace('_', ' ') || '—'}</strong></div>
                      <div><span>MLS</span><strong>{selectedAgent.mls_affiliation?.replace('_', ' ') || '—'}</strong></div>
                      <div><span>Alerts</span><strong>{selectedAgent.alert_preference || '—'} {selectedAgent.alert_phone ? `· ${selectedAgent.alert_phone}` : ''}</strong></div>
                    </div>

                    <div className="ros-admin-coverage"><span><MapPin size={12}/> Showing areas</span><p>{selectedAgent.showing_areas || 'No showing areas entered.'}</p></div>

                    <div className="ros-admin-days">
                      {DAYS.map(day => {
                        const slot = selectedAgent.availability?.[day as DayKey]
                        return <span key={day} className={slot?.active ? 'is-on' : ''}><strong>{DAY_LABELS[day as DayKey]}</strong><small>{slot?.active ? `${slot.start}–${slot.end}` : 'Off'}</small></span>
                      })}
                    </div>

                    <div className="ros-admin-agent-kpis">
                      <div><span>Assigned</span><strong>{selectedAgent.leadCount}</strong></div>
                      <div><span>Need contact</span><strong>{selectedAgent.contactCount}</strong></div>
                      <div><span>Closing</span><strong>{selectedAgent.closingCount}</strong></div>
                      <div><span>Closed</span><strong>{selectedAgent.closedCount}</strong></div>
                    </div>

                    <div className="ros-admin-assigned-list">
                      {selectedAgentLeads.slice(0, 8).map(lead => <div key={lead.id}><span style={{ background: STAGE_COLORS[lead.stage] }}/><strong>{lead.name || 'Unnamed'}</strong><small>{lead.stage}</small></div>)}
                      {selectedAgentLeads.length === 0 && <div className="ros-admin-empty"><UsersRound size={20}/><span>No assigned leads.</span></div>}
                    </div>
                  </>
                ) : (
                  <div className="ros-admin-empty" style={{ minHeight: 320 }}><UsersRound size={26}/><strong>Select an agent</strong><span>View coverage, availability and workload.</span></div>
                )}
              </div>
            </section>
          </>
        )}

        {tab === 'leads' && (
          <section className="ros-admin-panel">
            <div className="ros-admin-panel-head ros-admin-leads-head">
              <div><span className="ros-admin-section-kicker">Database</span><h2>All rental leads</h2></div>
              <div className="ros-admin-search"><Search size={14}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search leads…"/></div>
            </div>
            <div className="ros-admin-lead-table-wrap">
              <table className="ros-admin-lead-table">
                <thead><tr><th>Lead</th><th>Stage</th><th>Budget</th><th>Agent</th><th>Age</th><th/></tr></thead>
                <tbody>
                  {visibleLeads.map(lead => {
                    const accent = STAGE_COLORS[lead.stage]
                    return (
                      <tr key={lead.id}>
                        <td><strong>{lead.name || 'Unnamed lead'}</strong><small>{lead.area || lead.phone || '—'}</small></td>
                        <td><span className="ros-admin-stage" style={{ color: accent, background: `color-mix(in srgb, ${accent} 10%, transparent)`, borderColor: `color-mix(in srgb, ${accent} 18%, transparent)` }}>{lead.stage}</span></td>
                        <td>{lead.budget || '—'}</td>
                        <td>
                          <select value={lead.assigned_agent || 'Unassigned'} onChange={event => reassignLead(lead, event.target.value)}>
                            <option value="Unassigned">Unassigned</option>
                            {agents.map(agent => <option key={agent.id} value={agent.email}>{agentName(agent)}</option>)}
                          </select>
                        </td>
                        <td>{formatDistanceToNowStrict(new Date(lead.created_at), { addSuffix: true })}</td>
                        <td><button className="ros-btn ros-icon-btn" onClick={() => handleDeleteLead(lead.id, lead.name)}><Trash2 size={13}/></button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {visibleLeads.length === 0 && <div className="ros-admin-empty"><Search size={20}/><span>No matching leads.</span></div>}
            </div>
          </section>
        )}
      </div>

      <style>{`
        .ros-admin-shell{min-height:100dvh;color:var(--ros-text);background:radial-gradient(circle at 7% -4%,rgba(255,155,74,.08),transparent 27%),radial-gradient(circle at 94% 4%,rgba(90,169,255,.08),transparent 28%),linear-gradient(180deg,var(--ros-bg),var(--ros-bg-2))}
        .ros-admin-nav{height:66px;position:sticky;top:0;z-index:50;padding:0 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--ros-line);background:color-mix(in srgb,var(--ros-panel-solid) 86%,transparent);backdrop-filter:blur(22px)}
        .ros-admin-brand{border:0;background:transparent;display:flex;align-items:center;gap:10px;color:var(--ros-text);cursor:pointer;text-align:left}.ros-admin-brand>span:last-child{display:block}.ros-admin-brand strong{display:block;font-size:13px;letter-spacing:-.02em}.ros-admin-brand small{display:block;margin-top:2px;color:var(--ros-muted-2);font-size:9px}.ros-admin-nav-actions{display:flex;align-items:center;gap:7px}
        .ros-admin-content{width:min(1280px,100%);margin:0 auto;padding:28px 18px 60px}.ros-admin-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:20px}.ros-admin-kicker,.ros-admin-section-kicker{color:var(--ros-brand);font-size:9px;font-weight:780;letter-spacing:.11em;text-transform:uppercase}.ros-admin-hero h1{margin:8px 0 7px;font-size:clamp(28px,4vw,44px);line-height:1;letter-spacing:-.05em}.ros-admin-hero p{margin:0;color:var(--ros-muted);font-size:12px}.ros-admin-alert{min-width:220px;padding:12px 14px;display:flex;align-items:center;gap:10px;border:1px solid color-mix(in srgb,var(--ros-brand) 28%,transparent);border-radius:14px;background:var(--ros-brand-soft);color:var(--ros-brand);cursor:pointer;text-align:left}.ros-admin-alert span{display:block}.ros-admin-alert strong{display:block;font-size:11px}.ros-admin-alert small{display:block;margin-top:2px;color:var(--ros-muted);font-size:9px}
        .ros-admin-tabs{display:flex;gap:5px;margin-bottom:14px;padding:4px;border:1px solid var(--ros-line);border-radius:13px;background:var(--ros-card);width:max-content;max-width:100%;overflow:auto}.ros-admin-tabs button{height:35px;padding:0 12px;display:flex;align-items:center;gap:6px;border:0;border-radius:9px;background:transparent;color:var(--ros-muted);font-size:10px;font-weight:700;white-space:nowrap;cursor:pointer}.ros-admin-tabs button.is-active{color:var(--ros-text);background:var(--ros-panel-strong);box-shadow:inset 0 0 0 1px var(--ros-line)}.ros-admin-tabs button span{min-width:19px;padding:2px 5px;border-radius:999px;background:var(--ros-card);font-size:8px}
        .ros-admin-metrics{display:grid;grid-template-columns:repeat(6,minmax(130px,1fr));gap:9px;margin-bottom:12px}.ros-admin-metrics article{padding:13px 14px;border:1px solid var(--ros-line);border-radius:14px;background:var(--ros-card);overflow:hidden}.ros-admin-metric-top{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--ros-muted);font-size:9px;font-weight:720;text-transform:uppercase;letter-spacing:.06em}.ros-admin-metric-top svg{color:var(--metric-tone)}.ros-admin-metrics article>strong{display:block;margin-top:8px;color:var(--metric-tone);font-size:24px;line-height:1;font-weight:780;letter-spacing:-.04em}.ros-admin-metrics article>small{display:block;margin-top:5px;color:var(--ros-muted-2);font-size:8px}
        .ros-admin-grid{display:grid;grid-template-columns:1.12fr .88fr;gap:12px}.ros-admin-panel,.ros-admin-invite{border:1px solid var(--ros-line);border-radius:17px;background:color-mix(in srgb,var(--ros-panel) 62%,transparent);box-shadow:inset 0 1px 0 rgba(255,255,255,.018)}.ros-admin-panel{padding:16px}.ros-admin-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px}.ros-admin-panel-head h2,.ros-admin-invite h2,.ros-admin-agent-detail h2{margin:4px 0 0;font-size:17px;letter-spacing:-.03em}.ros-admin-ready-list{display:flex;flex-direction:column;gap:6px}.ros-admin-ready-row{min-height:50px;padding:9px 10px;display:flex;align-items:center;gap:9px;border:1px solid var(--ros-line);border-radius:11px;background:var(--ros-card)}.ros-admin-ready-main{flex:1;min-width:0}.ros-admin-ready-main strong{display:block;font-size:11px}.ros-admin-ready-main span{display:block;margin-top:3px;color:var(--ros-muted);font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ros-admin-ready-row>small{color:var(--ros-muted-2);font-size:8px;white-space:nowrap}
        .ros-admin-funnel{display:flex;flex-direction:column;gap:7px}.ros-admin-funnel-label{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--ros-muted);font-size:9px}.ros-admin-funnel-label strong{font-size:10px}.ros-admin-funnel-track{height:6px;overflow:hidden;border-radius:999px;background:var(--ros-card)}.ros-admin-funnel-track span{display:block;height:100%;border-radius:999px}
        .ros-admin-agent-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.ros-admin-agent-card,.ros-admin-team-row{border:1px solid var(--ros-line);background:var(--ros-card);color:var(--ros-text);cursor:pointer}.ros-admin-agent-card{min-width:0;padding:10px;display:flex;align-items:center;gap:9px;border-radius:12px;text-align:left}.ros-admin-agent-avatar{width:34px;height:34px;flex:0 0 34px;overflow:hidden;display:grid;place-items:center;border-radius:10px;color:var(--ros-blue);background:color-mix(in srgb,var(--ros-blue) 11%,transparent);border:1px solid color-mix(in srgb,var(--ros-blue) 22%,transparent);font-size:9px;font-weight:780}.ros-admin-agent-avatar img{width:100%;height:100%;object-fit:cover}.ros-admin-agent-avatar-lg{width:52px;height:52px;flex-basis:52px;border-radius:15px;font-size:12px}.ros-admin-agent-copy{flex:1;min-width:0}.ros-admin-agent-copy strong{display:block;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ros-admin-agent-copy strong em{margin-left:4px;color:var(--ros-brand);font-style:normal;font-size:7px;text-transform:uppercase}.ros-admin-agent-copy small{display:block;margin-top:3px;color:var(--ros-muted-2);font-size:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ros-admin-agent-number{color:var(--ros-blue);font-size:15px;font-weight:780}
        .ros-admin-invite{padding:18px;margin-bottom:12px;display:grid;grid-template-columns:1fr minmax(320px,.8fr);align-items:end;gap:18px}.ros-admin-invite p{max-width:600px;margin:7px 0 0;color:var(--ros-muted);font-size:10px;line-height:1.6}.ros-admin-invite form{display:flex;gap:7px}.ros-admin-invite-input{height:36px;flex:1;display:flex;align-items:center;gap:7px;padding:0 10px;border:1px solid var(--ros-line);border-radius:10px;color:var(--ros-muted-2);background:var(--ros-card)}.ros-admin-invite-input input{width:100%;border:0;outline:0;background:transparent;color:var(--ros-text-2);font-size:10px}.ros-admin-invite-link{grid-column:1/-1;padding:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid color-mix(in srgb,var(--ros-green) 20%,transparent);border-radius:11px;background:color-mix(in srgb,var(--ros-green) 7%,transparent)}.ros-admin-invite-link div{min-width:0}.ros-admin-invite-link strong{display:block;color:var(--ros-green);font-size:9px}.ros-admin-invite-link span{display:block;margin-top:3px;color:var(--ros-muted-2);font-size:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ros-admin-team-layout{display:grid;grid-template-columns:minmax(260px,.72fr) minmax(0,1.28fr);gap:12px}.ros-admin-agent-list,.ros-admin-agent-detail{border:1px solid var(--ros-line);border-radius:16px;background:color-mix(in srgb,var(--ros-panel) 62%,transparent)}.ros-admin-agent-list{padding:8px;max-height:680px;overflow:auto}.ros-admin-team-row{width:100%;min-height:54px;margin-bottom:6px;padding:8px;display:flex;align-items:center;gap:9px;border-radius:11px;text-align:left}.ros-admin-team-row.is-selected{background:color-mix(in srgb,var(--ros-blue) 8%,var(--ros-card));border-color:color-mix(in srgb,var(--ros-blue) 24%,transparent)}.ros-admin-team-meta{text-align:right}.ros-admin-team-meta strong{display:block;color:var(--ros-text);font-size:13px}.ros-admin-team-meta small{display:block;color:var(--ros-muted-2);font-size:7px}.ros-admin-agent-detail{min-width:0;padding:17px}.ros-admin-agent-detail-head{display:flex;align-items:center;gap:12px;margin-bottom:15px}.ros-admin-agent-detail-head>div{flex:1;min-width:0}.ros-admin-agent-detail-head p{margin:3px 0 0;color:var(--ros-muted-2);font-size:9px}.ros-admin-profile-facts,.ros-admin-agent-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.ros-admin-profile-facts div,.ros-admin-agent-kpis div{padding:10px;border:1px solid var(--ros-line);border-radius:11px;background:var(--ros-card)}.ros-admin-profile-facts span,.ros-admin-agent-kpis span{display:block;color:var(--ros-muted-2);font-size:7px;font-weight:740;text-transform:uppercase;letter-spacing:.06em}.ros-admin-profile-facts strong,.ros-admin-agent-kpis strong{display:block;margin-top:4px;color:var(--ros-text-2);font-size:9px;text-transform:capitalize;overflow-wrap:anywhere}.ros-admin-agent-kpis strong{font-size:16px}.ros-admin-coverage{margin:10px 0;padding:11px;border:1px solid var(--ros-line);border-radius:11px;background:var(--ros-card)}.ros-admin-coverage span{display:flex;align-items:center;gap:5px;color:var(--ros-muted-2);font-size:8px;font-weight:740;text-transform:uppercase}.ros-admin-coverage p{margin:6px 0 0;color:var(--ros-muted);font-size:9px;line-height:1.5}.ros-admin-days{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:10px}.ros-admin-days>span{padding:7px 3px;text-align:center;border:1px solid var(--ros-line);border-radius:9px;background:var(--ros-card);opacity:.55}.ros-admin-days>span.is-on{opacity:1;border-color:color-mix(in srgb,var(--ros-green) 22%,transparent);background:color-mix(in srgb,var(--ros-green) 6%,transparent)}.ros-admin-days strong{display:block;color:var(--ros-muted);font-size:7px}.ros-admin-days small{display:block;margin-top:3px;color:var(--ros-muted-2);font-size:6px}.ros-admin-assigned-list{margin-top:10px;display:flex;flex-direction:column;gap:5px}.ros-admin-assigned-list>div:not(.ros-admin-empty){min-height:37px;padding:7px 9px;display:flex;align-items:center;gap:7px;border:1px solid var(--ros-line);border-radius:9px;background:var(--ros-card)}.ros-admin-assigned-list>div>span{width:6px;height:6px;border-radius:50%}.ros-admin-assigned-list strong{font-size:9px}.ros-admin-assigned-list small{margin-left:auto;color:var(--ros-muted-2);font-size:8px}
        .ros-admin-leads-head{align-items:end}.ros-admin-search{width:min(360px,100%);height:36px;padding:0 10px;display:flex;align-items:center;gap:7px;border:1px solid var(--ros-line);border-radius:10px;color:var(--ros-muted-2);background:var(--ros-card)}.ros-admin-search input{width:100%;border:0;outline:0;background:transparent;color:var(--ros-text-2);font-size:10px}.ros-admin-lead-table-wrap{overflow:auto}.ros-admin-lead-table{width:100%;min-width:760px;border-collapse:collapse}.ros-admin-lead-table th{padding:9px 8px;text-align:left;color:var(--ros-muted-2);font-size:7px;text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid var(--ros-line)}.ros-admin-lead-table td{padding:9px 8px;color:var(--ros-muted);font-size:9px;border-bottom:1px solid var(--ros-line)}.ros-admin-lead-table td>strong{display:block;color:var(--ros-text-2);font-size:9px}.ros-admin-lead-table td>small{display:block;margin-top:2px;color:var(--ros-muted-2);font-size:7px}.ros-admin-lead-table select{height:29px;max-width:145px;border:1px solid var(--ros-line);border-radius:8px;background:var(--ros-card);color:var(--ros-text-2);font-size:8px}.ros-admin-stage{display:inline-flex;padding:3px 6px;border:1px solid;border-radius:999px;font-size:7px;font-weight:700;white-space:nowrap}
        .ros-admin-empty{min-height:105px;padding:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--ros-muted-2);text-align:center}.ros-admin-empty strong{color:var(--ros-muted);font-size:10px}.ros-admin-empty span{font-size:8px}
        @media(max-width:1050px){.ros-admin-metrics{grid-template-columns:repeat(3,1fr)}.ros-admin-agent-grid{grid-template-columns:repeat(2,1fr)}.ros-admin-invite{grid-template-columns:1fr}.ros-admin-invite form{max-width:600px}.ros-admin-team-layout{grid-template-columns:1fr}.ros-admin-agent-list{max-height:360px}}
        @media(max-width:680px){.ros-admin-content{padding:18px 10px 90px}.ros-admin-nav{height:60px;padding:0 10px}.ros-admin-hero{align-items:stretch;flex-direction:column}.ros-admin-alert{min-width:0;width:100%}.ros-admin-metrics{grid-template-columns:repeat(2,1fr)}.ros-admin-grid{grid-template-columns:1fr}.ros-admin-agent-grid{grid-template-columns:1fr 1fr}.ros-admin-invite form{flex-direction:column}.ros-admin-invite form .ros-btn{width:100%}.ros-admin-profile-facts,.ros-admin-agent-kpis{grid-template-columns:repeat(2,1fr)}.ros-admin-days{grid-template-columns:repeat(4,1fr)}.ros-admin-leads-head{align-items:stretch;flex-direction:column}.ros-admin-search{width:100%}.ros-admin-tabs{width:100%}.ros-admin-tabs button{flex:1;justify-content:center}}
      `}</style>
    </main>
  )
}

export function AdminDashboard(props: AdminDashboardProps) {
  return <ToastProvider><AdminInner {...props}/></ToastProvider>
}
