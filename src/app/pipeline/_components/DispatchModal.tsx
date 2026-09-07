'use client'

import { useMemo, useState } from 'react'
import {
  BadgeCheck,
  CalendarCheck2,
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  X,
} from 'lucide-react'
import { Lead, STAGE_COLORS } from '@/types/lead'
import { AgentProfile, DAY_LABELS, DayKey } from '@/types/agent'
import { getSupabase } from '@/lib/supabase'

interface DispatchModalProps {
  lead: Lead
  agents: AgentProfile[]
  onClose: () => void
  onAssigned: (lead: Lead, agentEmail: string) => void
}

type RankedAgent = AgentProfile & {
  score: number
  reasons: string[]
  availableToday: boolean
  availableTomorrow: boolean
}

const DAY_ORDER: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function dayKey(offset = 0): DayKey {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const jsDay = date.getDay()
  return DAY_ORDER[(jsDay + 6) % 7]
}

function normalize(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function locationTokens(lead: Lead) {
  const raw = [lead.area, ...(lead.specific_cities ?? [])]
    .map(normalize)
    .filter(Boolean)

  const tokens = new Set<string>()
  for (const item of raw) {
    tokens.add(item)
    item.split(/,|\//).map(part => part.trim()).filter(part => part.length >= 4).forEach(part => tokens.add(part))
  }
  return [...tokens]
}

function rankAgent(agent: AgentProfile, lead: Lead): RankedAgent {
  const today = dayKey(0)
  const tomorrow = dayKey(1)
  const availableToday = Boolean(agent.availability?.[today]?.active)
  const availableTomorrow = Boolean(agent.availability?.[tomorrow]?.active)
  const reasons: string[] = []
  let score = 0

  if (availableToday) {
    score += 5
    reasons.push('Available today')
  } else if (availableTomorrow) {
    score += 2
    reasons.push('Available tomorrow')
  }

  const showingAreas = normalize(agent.showing_areas)
  const leadLocations = locationTokens(lead)
  const areaMatch = showingAreas && leadLocations.some(location =>
    location.length >= 4 && (showingAreas.includes(location) || location.includes(showingAreas))
  )

  if (areaMatch) {
    score += 7
    reasons.push('Area match')
  }

  if (agent.lead_preference === 'both') {
    score += 2
    reasons.push('Full-service lead')
  } else if (agent.lead_preference === 'showing_only') {
    score += 1
  }

  if (agent.mls_affiliation && agent.mls_affiliation !== 'no_mls') {
    score += 1
    reasons.push('MLS access')
  }

  const activeDays = DAY_ORDER.filter(day => agent.availability?.[day]?.active).length
  score += Math.min(activeDays, 7) * 0.15

  return { ...agent, score, reasons, availableToday, availableTomorrow }
}

function leadSummaryValue(value: string | null | undefined) {
  return value && String(value).trim() ? value : '—'
}

export function DispatchModal({ lead, agents, onClose, onAssigned }: DispatchModalProps) {
  const supabase = getSupabase()
  const [assigning, setAssigning] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const accent = STAGE_COLORS[lead.stage] ?? '#6e7681'

  const ranked = useMemo(() => agents
    .map(agent => rankAgent(agent, lead))
    .filter(agent => {
      const haystack = normalize(`${agent.full_name} ${agent.email} ${agent.showing_areas} ${agent.mls_affiliation}`)
      return !query.trim() || haystack.includes(normalize(query))
    })
    .sort((a, b) => b.score - a.score || (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email)),
  [agents, lead, query])

  async function assignTo(agent: AgentProfile) {
    setAssigning(agent.email)
    try {
      const { error } = await supabase
        .from('leads')
        .update({ assigned_agent: agent.email })
        .eq('id', lead.id)

      if (error) throw error

      await fetch('/api/send-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          agentEmail: agent.email,
          leadName: lead.name,
          budget: lead.budget,
          moveIn: lead.move_in,
          phone: lead.phone,
          source: lead.source,
          area: lead.area,
        }),
      })

      onAssigned({ ...lead, assigned_agent: agent.email }, agent.email)
    } finally {
      setAssigning(null)
    }
  }

  const location = lead.specific_cities?.length
    ? lead.specific_cities.join(', ')
    : lead.area

  return (
    <div className="ros-dispatch-backdrop" onClick={onClose}>
      <div className="ros-dispatch" onClick={event => event.stopPropagation()}>
        <aside className="ros-dispatch-lead">
          <div className="ros-dispatch-lead-head">
            <div className="ros-dispatch-kicker"><Sparkles size={12}/> Ready to assign</div>
            <h2>{lead.name || 'Unnamed lead'}</h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="ros-badge" style={{ padding: '4px 8px', fontSize: 9, color: accent, background: `color-mix(in srgb, ${accent} 10%, transparent)`, borderColor: `color-mix(in srgb, ${accent} 22%, transparent)` }}>{lead.stage}</span>
              {lead.source && <span className="ros-badge" style={{ padding: '4px 8px', fontSize: 9, color: 'var(--ros-muted)' }}>{lead.source}</span>}
            </div>
          </div>

          <div className="ros-dispatch-lead-body">
            {lead.phone && (
              <a className="ros-dispatch-phone" href={`tel:${lead.phone.replace(/\D/g, '')}`}>
                <Phone size={14}/> {lead.phone}
              </a>
            )}

            <div className="ros-dispatch-facts">
              <div><span>Area</span><strong>{leadSummaryValue(location)}</strong></div>
              <div><span>Bedrooms</span><strong>{leadSummaryValue(lead.bedrooms)}</strong></div>
              <div><span>Budget</span><strong>{leadSummaryValue(lead.budget)}</strong></div>
              <div><span>Move-in</span><strong>{leadSummaryValue(lead.move_in)}</strong></div>
              <div><span>Pets</span><strong>{leadSummaryValue(lead.pets)}</strong></div>
              <div><span>Credit</span><strong>{leadSummaryValue(lead.credit)}</strong></div>
              <div><span>Income</span><strong>{leadSummaryValue(lead.income)}</strong></div>
              <div><span>Eviction / criminal</span><strong>{leadSummaryValue(lead.criminal_eviction_status)}</strong></div>
            </div>

            {lead.notes_crm && (
              <div className="ros-dispatch-summary">
                <span>AI summary</span>
                <p>{lead.notes_crm}</p>
              </div>
            )}
          </div>
        </aside>

        <section className="ros-dispatch-agents">
          <header className="ros-dispatch-head">
            <div>
              <div className="ros-dispatch-title">Choose the best agent</div>
              <div className="ros-dispatch-sub">Ranked from live profile data, availability and coverage.</div>
            </div>
            <button className="ros-btn ros-icon-btn" onClick={onClose} aria-label="Close"><X size={16}/></button>
          </header>

          <div className="ros-dispatch-search">
            <Search size={14}/>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search agents or showing areas…" />
          </div>

          <div className="ros-agent-rank-list">
            {ranked.map((agent, index) => {
              const current = lead.assigned_agent === agent.email
              const busy = assigning === agent.email
              const bestMatch = index === 0 && agent.score > 0
              const activeDays = DAY_ORDER.filter(day => agent.availability?.[day]?.active)

              return (
                <article key={agent.id} className={`ros-agent-rank ${bestMatch ? 'is-best' : ''}`}>
                  <div className="ros-agent-rank-avatar">
                    {agent.avatar_url
                      ? <img src={agent.avatar_url} alt="" />
                      : (agent.full_name ?? agent.email).slice(0, 2).toUpperCase()}
                  </div>

                  <div className="ros-agent-rank-main">
                    <div className="ros-agent-rank-name-row">
                      <strong>{agent.full_name || agent.email.split('@')[0]}</strong>
                      {bestMatch && <span className="ros-best-pill"><Sparkles size={10}/> Best match</span>}
                    </div>
                    <div className="ros-agent-rank-email">{agent.email}</div>

                    <div className="ros-agent-reasons">
                      {agent.reasons.map(reason => (
                        <span key={reason}>
                          {reason === 'Area match' && <MapPin size={10}/>} 
                          {reason === 'Available today' && <CalendarCheck2 size={10}/>} 
                          {reason === 'Available tomorrow' && <Clock3 size={10}/>} 
                          {reason === 'MLS access' && <ShieldCheck size={10}/>} 
                          {reason === 'Full-service lead' && <BadgeCheck size={10}/>} 
                          {reason}
                        </span>
                      ))}
                      {agent.reasons.length === 0 && <span>Profile match not configured</span>}
                    </div>

                    {agent.showing_areas && (
                      <div className="ros-agent-coverage">{agent.showing_areas}</div>
                    )}

                    <div className="ros-agent-days">
                      {DAY_ORDER.map(day => {
                        const slot = agent.availability?.[day]
                        return (
                          <span key={day} className={slot?.active ? 'is-on' : ''} title={slot?.active ? `${DAY_LABELS[day]} ${slot.start}–${slot.end}` : `${DAY_LABELS[day]} off`}>
                            {DAY_LABELS[day]}
                          </span>
                        )
                      })}
                      <span className="ros-agent-meta">{activeDays.length} day{activeDays.length === 1 ? '' : 's'} / wk</span>
                      {agent.mls_affiliation && <span className="ros-agent-meta">{agent.mls_affiliation.replace('_', ' ')}</span>}
                    </div>
                  </div>

                  <div className="ros-agent-rank-action">
                    {current ? (
                      <span className="ros-current-pill"><Check size={11}/> Assigned</span>
                    ) : (
                      <button className="ros-btn ros-btn-primary" disabled={busy} onClick={() => assignTo(agent)}>
                        {busy ? 'Assigning…' : <>Assign <ChevronRight size={14}/></>}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}

            {ranked.length === 0 && (
              <div className="ros-agent-empty"><UserRoundCheck size={24}/><span>No matching agents found.</span></div>
            )}
          </div>
        </section>
      </div>

      <style>{`
        .ros-dispatch-backdrop{position:fixed;inset:0;z-index:300;padding:18px;display:grid;place-items:center;background:rgba(0,6,13,.72);backdrop-filter:blur(12px)}
        .ros-dispatch{width:min(1020px,100%);max-height:92dvh;display:grid;grid-template-columns:minmax(280px,.8fr) minmax(0,1.55fr);overflow:hidden;border:1px solid var(--ros-line-strong);border-radius:22px;background:var(--ros-panel-solid);box-shadow:0 35px 100px rgba(0,0,0,.42)}
        .ros-dispatch-lead{min-width:0;display:flex;flex-direction:column;border-right:1px solid var(--ros-line);background:linear-gradient(180deg,color-mix(in srgb,var(--ros-brand) 5%,var(--ros-panel-solid)),var(--ros-panel-solid))}
        .ros-dispatch-lead-head{padding:24px 22px;border-bottom:1px solid var(--ros-line)}
        .ros-dispatch-kicker{display:flex;align-items:center;gap:6px;margin-bottom:9px;color:var(--ros-brand);font-size:9px;font-weight:780;text-transform:uppercase;letter-spacing:.12em}
        .ros-dispatch-lead h2{margin:0 0 11px;color:var(--ros-text);font-size:24px;letter-spacing:-.04em}
        .ros-dispatch-lead-body{flex:1;min-height:0;overflow:auto;padding:18px 22px 24px}
        .ros-dispatch-phone{display:inline-flex;align-items:center;gap:6px;margin-bottom:14px;color:var(--ros-blue);font-size:13px;font-weight:700;text-decoration:none}
        .ros-dispatch-facts{display:grid;grid-template-columns:1fr 1fr;gap:11px 13px}
        .ros-dispatch-facts span{display:block;margin-bottom:3px;color:var(--ros-muted-2);font-size:8px;font-weight:760;text-transform:uppercase;letter-spacing:.08em}
        .ros-dispatch-facts strong{display:block;color:var(--ros-text-2);font-size:11px;line-height:1.45;overflow-wrap:anywhere}
        .ros-dispatch-summary{margin-top:17px;padding:12px;border:1px solid var(--ros-line);border-radius:12px;background:var(--ros-card)}
        .ros-dispatch-summary span{color:var(--ros-muted-2);font-size:8px;font-weight:760;text-transform:uppercase;letter-spacing:.08em}
        .ros-dispatch-summary p{margin:6px 0 0;color:var(--ros-muted);font-size:10px;line-height:1.55;white-space:pre-wrap}
        .ros-dispatch-agents{min-width:0;display:flex;flex-direction:column;overflow:hidden}
        .ros-dispatch-head{padding:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--ros-line)}
        .ros-dispatch-title{color:var(--ros-text);font-size:15px;font-weight:760;letter-spacing:-.025em}
        .ros-dispatch-sub{margin-top:3px;color:var(--ros-muted-2);font-size:10px}
        .ros-dispatch-search{margin:12px 16px 5px;height:38px;display:flex;align-items:center;gap:8px;padding:0 11px;border:1px solid var(--ros-line);border-radius:11px;color:var(--ros-muted-2);background:var(--ros-card)}
        .ros-dispatch-search input{width:100%;border:0;outline:0;color:var(--ros-text-2);background:transparent;font-size:11px}.ros-dispatch-search input::placeholder{color:var(--ros-muted-2)}
        .ros-agent-rank-list{flex:1;min-height:0;overflow:auto;padding:8px 16px 16px}
        .ros-agent-rank{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:12px;align-items:center;margin-bottom:8px;padding:13px;border:1px solid var(--ros-line);border-radius:14px;background:var(--ros-card);transition:.15s ease}
        .ros-agent-rank:hover{background:var(--ros-card-hover);border-color:var(--ros-line-strong)}.ros-agent-rank.is-best{border-color:color-mix(in srgb,var(--ros-brand) 32%,transparent);background:color-mix(in srgb,var(--ros-brand) 6%,var(--ros-card))}
        .ros-agent-rank-avatar{width:48px;height:48px;overflow:hidden;display:grid;place-items:center;border-radius:14px;color:var(--ros-blue);background:color-mix(in srgb,var(--ros-blue) 12%,transparent);border:1px solid color-mix(in srgb,var(--ros-blue) 22%,transparent);font-size:12px;font-weight:780}.ros-agent-rank-avatar img{width:100%;height:100%;object-fit:cover}
        .ros-agent-rank-main{min-width:0}.ros-agent-rank-name-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.ros-agent-rank-name-row strong{color:var(--ros-text);font-size:13px}.ros-agent-rank-email{margin-top:2px;color:var(--ros-muted-2);font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ros-best-pill,.ros-current-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border-radius:999px;font-size:8px;font-weight:760}.ros-best-pill{color:var(--ros-brand);background:var(--ros-brand-soft);border:1px solid color-mix(in srgb,var(--ros-brand) 24%,transparent)}.ros-current-pill{color:var(--ros-green);background:color-mix(in srgb,var(--ros-green) 10%,transparent);border:1px solid color-mix(in srgb,var(--ros-green) 22%,transparent)}
        .ros-agent-reasons{margin-top:7px;display:flex;gap:5px;flex-wrap:wrap}.ros-agent-reasons span{display:inline-flex;align-items:center;gap:4px;padding:3px 6px;border-radius:999px;color:var(--ros-muted);background:var(--ros-card);border:1px solid var(--ros-line);font-size:8px;font-weight:650}
        .ros-agent-coverage{margin-top:7px;max-width:540px;color:var(--ros-muted);font-size:9px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .ros-agent-days{margin-top:8px;display:flex;align-items:center;gap:3px;flex-wrap:wrap}.ros-agent-days>span:not(.ros-agent-meta){min-width:25px;padding:2px 4px;text-align:center;border-radius:5px;color:var(--ros-muted-2);background:var(--ros-card);border:1px solid var(--ros-line);font-size:7px;font-weight:700}.ros-agent-days>span.is-on{color:var(--ros-green);background:color-mix(in srgb,var(--ros-green) 8%,transparent);border-color:color-mix(in srgb,var(--ros-green) 18%,transparent)}.ros-agent-meta{margin-left:4px;color:var(--ros-muted-2);font-size:8px;text-transform:capitalize}
        .ros-agent-rank-action{display:flex;justify-content:flex-end}.ros-agent-empty{padding:48px 20px;display:flex;flex-direction:column;align-items:center;gap:9px;color:var(--ros-muted-2);font-size:10px}
        @media(max-width:760px){.ros-dispatch-backdrop{padding:0;place-items:stretch}.ros-dispatch{width:100%;height:100dvh;max-height:none;grid-template-columns:1fr;border:0;border-radius:0;overflow:auto}.ros-dispatch-lead{border-right:0;border-bottom:1px solid var(--ros-line)}.ros-dispatch-lead-body{overflow:visible}.ros-dispatch-agents{overflow:visible}.ros-agent-rank-list{overflow:visible}.ros-agent-rank{grid-template-columns:42px minmax(0,1fr);align-items:start}.ros-agent-rank-avatar{width:42px;height:42px;border-radius:12px}.ros-agent-rank-action{grid-column:1/-1}.ros-agent-rank-action .ros-btn{width:100%}}
      `}</style>
    </div>
  )
}
