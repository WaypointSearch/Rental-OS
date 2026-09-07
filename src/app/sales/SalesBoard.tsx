'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2, CalendarClock, DollarSign, Mail, MapPin, Phone, Plus, Search, X } from 'lucide-react'
import { getSupabase } from '@/lib/supabase'
import styles from './sales.module.css'

const STAGES = ['New Lead', 'Contacted', 'Appointment Set', 'Active Client', 'Offer / Listing', 'Under Contract', 'Closed Won', 'Closed Lost'] as const

type AgentLite = { id: string; email: string; full_name: string | null; avatar_url: string | null }

type SalesLead = {
  id: number
  agent_id: string
  agent_email: string
  stage: string
  client_name: string
  phone: string | null
  email: string | null
  client_type: string | null
  lead_status: string | null
  target_areas: string | null
  budget_max: number | null
  property_address: string | null
  desired_price: string | null
  lead_source: string | null
  next_action: string | null
  notes: string | null
  created_at: string
  updated_at: string | null
}

function money(value: number | null) {
  if (!value) return null
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function age(date: string) {
  const hours = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 3_600_000))
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`
}

function stageTone(stage: string) {
  if (stage === 'Closed Won') return 'green'
  if (stage === 'Closed Lost') return 'red'
  if (stage === 'Under Contract') return 'gold'
  if (stage === 'Offer / Listing') return 'purple'
  return 'blue'
}

export function SalesBoard({ initialLeads, agentEmail, agentId, isAdmin, agents }: {
  initialLeads: SalesLead[]
  agentEmail: string
  agentId: string
  isAdmin: boolean
  agents: AgentLite[]
}) {
  const supabase = useMemo(() => getSupabase(), [])
  const [leads, setLeads] = useState<SalesLead[]>(initialLeads)
  const [selected, setSelected] = useState<SalesLead | null>(null)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState({ client_name: '', client_type: 'buyer', phone: '', email: '', target_areas: '', property_address: '', budget_max: '', desired_price: '', lead_source: '', next_action: '', notes: '', agent_email: agentEmail })

  useEffect(() => {
    const channel = supabase
      .channel(`sales-realtime-${agentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_leads' }, payload => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: number }).id
          if (id) {
            setLeads(previous => previous.filter(lead => lead.id !== id))
            setSelected(previous => previous?.id === id ? null : previous)
          }
          return
        }
        const lead = payload.new as SalesLead
        const visible = isAdmin || lead.agent_email === agentEmail
        if (!visible) {
          setLeads(previous => previous.filter(item => item.id !== lead.id))
          setSelected(previous => previous?.id === lead.id ? null : previous)
          return
        }
        setLeads(previous => previous.some(item => item.id === lead.id)
          ? previous.map(item => item.id === lead.id ? lead : item)
          : [lead, ...previous])
        setSelected(previous => previous?.id === lead.id ? lead : previous)
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [agentEmail, agentId, isAdmin, supabase])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return leads
    return leads.filter(lead => [lead.client_name, lead.phone, lead.email, lead.target_areas, lead.property_address, lead.agent_email]
      .some(value => String(value ?? '').toLowerCase().includes(needle)))
  }, [leads, search])

  async function createLead(event: React.FormEvent) {
    event.preventDefault()
    if (!draft.client_name.trim()) return
    setSaving(true)
    const assignedEmail = isAdmin ? draft.agent_email || agentEmail : agentEmail
    const assignedAgent = agents.find(agent => agent.email === assignedEmail)
    const payload = {
      agent_id: assignedAgent?.id ?? agentId,
      agent_email: assignedEmail,
      stage: 'New Lead',
      client_name: draft.client_name.trim(),
      client_type: draft.client_type,
      phone: draft.phone.trim() || null,
      email: draft.email.trim() || null,
      target_areas: draft.target_areas.trim() || null,
      property_address: draft.property_address.trim() || null,
      budget_max: draft.budget_max ? Number(draft.budget_max.replace(/[$,\s]/g, '')) || null : null,
      desired_price: draft.desired_price.trim() || null,
      lead_source: draft.lead_source.trim() || null,
      next_action: draft.next_action.trim() || null,
      notes: draft.notes.trim() || null,
      lead_status: 'warm',
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('sales_leads').insert(payload).select('*').single()
    setSaving(false)
    if (error) { window.alert(error.message); return }
    if (data) setLeads(previous => previous.some(item => item.id === data.id) ? previous : [data as SalesLead, ...previous])
    setDraft({ client_name: '', client_type: 'buyer', phone: '', email: '', target_areas: '', property_address: '', budget_max: '', desired_price: '', lead_source: '', next_action: '', notes: '', agent_email: agentEmail })
    setCreating(false)
  }

  async function updateLead(id: number, patch: Partial<SalesLead>) {
    const next = { ...patch, updated_at: new Date().toISOString() }
    setLeads(previous => previous.map(lead => lead.id === id ? { ...lead, ...next } as SalesLead : lead))
    setSelected(previous => previous?.id === id ? { ...previous, ...next } as SalesLead : previous)
    const { error } = await supabase.from('sales_leads').update(next).eq('id', id)
    if (error) window.alert(error.message)
  }

  async function reassign(lead: SalesLead, email: string) {
    const agent = agents.find(item => item.email === email)
    if (agent) await updateLead(lead.id, { agent_email: agent.email, agent_id: agent.id })
  }

  const activeCount = leads.filter(lead => !['Closed Won', 'Closed Lost'].includes(lead.stage)).length
  const wonCount = leads.filter(lead => lead.stage === 'Closed Won').length
  const buyers = leads.filter(lead => lead.client_type !== 'seller').length
  const sellers = leads.filter(lead => lead.client_type === 'seller').length

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.brand}><span className={styles.mark}><Building2 size={15}/></span><strong>Sun Ocean <b>Realty</b></strong>{isAdmin && <em>ADMIN</em>}</div>
        <div className={styles.mode}><Link href="/pipeline">Rentals</Link><span>Sales</span></div>
        <div className={styles.navRight}><span>{leads.length} leads</span><button onClick={() => setCreating(true)}><Plus size={14}/> New Sales Lead</button><Link href="/profile">Profile</Link></div>
      </nav>

      <section className={styles.stats}>
        <div><small>Total</small><strong>{leads.length}</strong></div><div><small>Active</small><strong>{activeCount}</strong></div><div><small>Buyers</small><strong>{buyers}</strong></div><div><small>Sellers</small><strong>{sellers}</strong></div><div><small>Closed Won</small><strong className={styles.green}>{wonCount}</strong></div>
      </section>

      <section className={styles.filters}>
        <label><Search size={14}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search sales leads…"/></label>
        <Link href="/pipeline"><ArrowLeft size={13}/> Rental Pipeline</Link>
      </section>

      <section className={styles.board}>
        {STAGES.map(stage => {
          const stageLeads = filtered.filter(lead => lead.stage === stage)
          return (
            <div className={styles.column} key={stage}>
              <header><span>{stage}</span><b>{stageLeads.length}</b></header>
              <div className={styles.columnBody}>
                {stageLeads.map(lead => (
                  <button key={lead.id} className={`${styles.card} ${styles[stageTone(stage)]}`} onClick={() => setSelected(lead)}>
                    <div className={styles.cardTop}><strong>{lead.client_name}</strong><small>{age(lead.created_at)}</small></div>
                    <div className={styles.chips}><span>{lead.client_type || 'buyer'}</span><span>{lead.lead_status || 'warm'}</span></div>
                    {lead.target_areas && <p><MapPin size={12}/>{lead.target_areas}</p>}
                    {lead.property_address && <p><Building2 size={12}/>{lead.property_address}</p>}
                    {(money(lead.budget_max) || lead.desired_price) && <p><DollarSign size={12}/>{money(lead.budget_max) || lead.desired_price}</p>}
                    {lead.next_action && <p><CalendarClock size={12}/>{lead.next_action}</p>}
                    {isAdmin && <footer>{lead.agent_email.split('@')[0]}</footer>}
                  </button>
                ))}
                {!stageLeads.length && <div className={styles.empty}>Empty</div>}
              </div>
            </div>
          )
        })}
      </section>

      {selected && (
        <aside className={styles.panel}>
          <div className={styles.panelHead}><div><small>{selected.client_type || 'client'}</small><h2>{selected.client_name}</h2></div><button onClick={() => setSelected(null)}><X size={16}/></button></div>
          <div className={styles.stagePicker}>{STAGES.map(stage => <button key={stage} className={selected.stage === stage ? styles.stageActive : ''} onClick={() => void updateLead(selected.id, { stage })}>{stage}</button>)}</div>
          <section className={styles.panelCard}>
            <h3>Contact</h3>
            {selected.phone && <a href={`tel:${selected.phone}`}><Phone size={13}/>{selected.phone}</a>}
            {selected.email && <a href={`mailto:${selected.email}`}><Mail size={13}/>{selected.email}</a>}
            {!selected.phone && !selected.email && <p>No contact details yet.</p>}
          </section>
          <section className={styles.panelCard}>
            <h3>Opportunity</h3>
            <label>Lead status<select value={selected.lead_status || 'warm'} onChange={event => void updateLead(selected.id, { lead_status: event.target.value })}><option>warm</option><option>hot</option><option>cold</option><option>nurture</option></select></label>
            <label>{selected.client_type === 'seller' ? 'Property address' : 'Target areas'}<input value={selected.client_type === 'seller' ? selected.property_address || '' : selected.target_areas || ''} onChange={event => setSelected(previous => previous ? { ...previous, ...(selected.client_type === 'seller' ? { property_address: event.target.value } : { target_areas: event.target.value }) } : previous)} onBlur={event => void updateLead(selected.id, selected.client_type === 'seller' ? { property_address: event.target.value } : { target_areas: event.target.value })}/></label>
            <label>Next action<input value={selected.next_action || ''} onChange={event => setSelected(previous => previous ? { ...previous, next_action: event.target.value } : previous)} onBlur={event => void updateLead(selected.id, { next_action: event.target.value })}/></label>
            <label>Notes<textarea value={selected.notes || ''} onChange={event => setSelected(previous => previous ? { ...previous, notes: event.target.value } : previous)} onBlur={event => void updateLead(selected.id, { notes: event.target.value })}/></label>
          </section>
          {isAdmin && <section className={styles.panelCard}><h3>Assigned Agent</h3><select value={selected.agent_email} onChange={event => void reassign(selected, event.target.value)}>{agents.map(agent => <option key={agent.id} value={agent.email}>{agent.full_name || agent.email}</option>)}</select></section>}
        </aside>
      )}

      {creating && (
        <div className={styles.modalBackdrop} onMouseDown={() => setCreating(false)}>
          <form className={styles.modal} onSubmit={createLead} onMouseDown={event => event.stopPropagation()}>
            <div className={styles.modalHead}><div><small>SALES CRM</small><h2>New Sales Lead</h2></div><button type="button" onClick={() => setCreating(false)}><X size={16}/></button></div>
            <div className={styles.grid2}>
              <label>Client name<input required value={draft.client_name} onChange={event => setDraft(previous => ({ ...previous, client_name: event.target.value }))}/></label>
              <label>Client type<select value={draft.client_type} onChange={event => setDraft(previous => ({ ...previous, client_type: event.target.value }))}><option value="buyer">Buyer</option><option value="seller">Seller</option></select></label>
              <label>Phone<input value={draft.phone} onChange={event => setDraft(previous => ({ ...previous, phone: event.target.value }))}/></label>
              <label>Email<input type="email" value={draft.email} onChange={event => setDraft(previous => ({ ...previous, email: event.target.value }))}/></label>
              {draft.client_type === 'seller' ? <label className={styles.full}>Property address<input value={draft.property_address} onChange={event => setDraft(previous => ({ ...previous, property_address: event.target.value }))}/></label> : <label className={styles.full}>Target areas<input value={draft.target_areas} onChange={event => setDraft(previous => ({ ...previous, target_areas: event.target.value }))}/></label>}
              {draft.client_type === 'seller' ? <label>Desired price<input value={draft.desired_price} onChange={event => setDraft(previous => ({ ...previous, desired_price: event.target.value }))}/></label> : <label>Budget max<input inputMode="decimal" value={draft.budget_max} onChange={event => setDraft(previous => ({ ...previous, budget_max: event.target.value }))}/></label>}
              <label>Lead source<input value={draft.lead_source} onChange={event => setDraft(previous => ({ ...previous, lead_source: event.target.value }))} placeholder="Referral, Zillow, past client…"/></label>
              <label className={styles.full}>Next action<input value={draft.next_action} onChange={event => setDraft(previous => ({ ...previous, next_action: event.target.value }))} placeholder="Call, send lender intro, schedule listing appointment…"/></label>
              <label className={styles.full}>Notes<textarea value={draft.notes} onChange={event => setDraft(previous => ({ ...previous, notes: event.target.value }))}/></label>
              {isAdmin && <label className={styles.full}>Assign to<select value={draft.agent_email} onChange={event => setDraft(previous => ({ ...previous, agent_email: event.target.value }))}>{agents.map(agent => <option key={agent.id} value={agent.email}>{agent.full_name || agent.email}</option>)}</select></label>}
            </div>
            <button className={styles.createButton} disabled={saving}>{saving ? 'Creating…' : 'Create Sales Lead'}</button>
          </form>
        </div>
      )}
    </main>
  )
}
