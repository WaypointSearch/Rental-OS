'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import {
  Download,
  LayoutGrid,
  List,
  LogOut,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Lead, STAGES } from '@/types/lead'
import { AgentProfile } from '@/types/agent'
import { StageColumn } from './StageColumn'
import { LeadPanel } from './LeadPanel'
import { LeadCard } from './LeadCard'
import { ListView } from './ListView'
import { FocusKey, StatsBar } from './StatsBar'
import { FilterBar } from './FilterBar'
import { LeadCreateModal } from './LeadCreateModal'
import { DispatchModal } from './DispatchModal'
import { useLeadsRealtime } from '@/lib/useLeadsRealtime'
import { useLeadFilter } from '@/lib/useLeadFilter'
import { useToast, ToastProvider } from '@/lib/useToast'
import { exportLeadsToCSV } from '@/lib/exportCSV'
import { getSupabase } from '@/lib/supabase'

interface KanbanBoardProps {
  initialLeads: Lead[]
  agentEmail: string
  agentId: string
  isAdmin: boolean
  agentProfile: AgentProfile | null
  agentAvatarMap: Record<string, string | null>
}

function isUnassigned(lead: Lead) {
  return !lead.assigned_agent || lead.assigned_agent === 'Unassigned'
}

function isStale(lead: Lead) {
  if (lead.stage === 'Move in / Deposit') return false
  return (Date.now() - new Date(lead.created_at).getTime()) / 86_400_000 > 10
}

function closedThisMonth(lead: Lead) {
  if (lead.stage !== 'Move in / Deposit') return false
  const d = new Date(lead.created_at)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

function BoardInner({
  initialLeads,
  agentEmail,
  agentId: _agentId,
  isAdmin,
  agentProfile,
  agentAvatarMap: initAvatarMap,
}: KanbanBoardProps) {
  const supabase = getSupabase()
  const router = useRouter()
  const { push: toast } = useToast()

  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [focus, setFocus] = useState<FocusKey>('all')
  const [avatarMap, setAvatarMap] = useState(initAvatarMap)
  const [isMobile, setIsMobile] = useState(false)
  const [lightTheme, setLightTheme] = useState(false)
  const [dispatchLead, setDispatchLead] = useState<Lead | null>(null)
  const [allAgents, setAllAgents] = useState<AgentProfile[]>([])

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setViewMode('list')
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem('rental-os-theme')
    const light = saved === 'light'
    setLightTheme(light)
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark')
  }, [])

  function toggleTheme() {
    const next = !lightTheme
    setLightTheme(next)
    document.documentElement.setAttribute('data-theme', next ? 'light' : 'dark')
    window.localStorage.setItem('rental-os-theme', next ? 'light' : 'dark')
  }

  async function openDispatch(lead: Lead) {
    if (!isAdmin) return
    if (allAgents.length === 0) {
      const { data } = await supabase.from('agent_profiles').select('*').order('created_at')
      if (data) setAllAgents(data as AgentProfile[])
    }
    setDispatchLead(lead)
    setSelected(null)
  }

  const handleInsert = useCallback((lead: Lead) => {
    setLeads(previous => previous.find(item => item.id === lead.id) ? previous : [lead, ...previous])
    toast({ type: 'lead', title: 'New lead arrived', body: `${lead.name ?? lead.id}`, duration: 8000 })
    if (isAdmin && isUnassigned(lead)) openDispatch(lead)
  }, [toast, isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdate = useCallback((lead: Lead) => {
    setLeads(previous => previous.map(item => item.id === lead.id ? lead : item))
    setSelected(previous => previous?.id === lead.id ? lead : previous)
    if (lead.assigned_agent) setAvatarMap(previous => ({ ...previous }))
  }, [])

  const handleDelete = useCallback((id: string) => {
    setLeads(previous => previous.filter(lead => lead.id !== id))
    setSelected(previous => previous?.id === id ? null : previous)
  }, [])

  useLeadsRealtime({ onInsert: handleInsert, onUpdate: handleUpdate, onDelete: handleDelete })

  const {
    filter,
    update: setFilter,
    reset: resetFilter,
    filtered,
    agents,
    isFiltered,
  } = useLeadFilter(leads)

  const focusedLeads = useMemo(() => filtered.filter(lead => {
    switch (focus) {
      case 'ready':
        return lead.stage === 'Waiting for contact' && (isAdmin ? isUnassigned(lead) : true)
      case 'active':
        return !['Waiting for contact', 'Move in / Deposit'].includes(lead.stage)
      case 'showings':
        return ['Set showings', 'Showings complete'].includes(lead.stage)
      case 'applications':
        return ['Completed Rentspree', 'Offer Sent'].includes(lead.stage)
      case 'closing':
        return ['Offer Sent', 'Offer Approved', 'HOA Approved'].includes(lead.stage)
      case 'stale':
        return isStale(lead)
      case 'closed':
        return closedThisMonth(lead)
      default:
        return true
    }
  }), [filtered, focus, isAdmin])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const leadsForStage = useCallback(
    (stage: string) => focusedLeads.filter(lead => lead.stage === stage),
    [focusedLeads],
  )
  const activeLead = activeId ? leads.find(lead => lead.id === activeId) ?? null : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string
    const activeLead = leads.find(lead => lead.id === activeId)
    if (!activeLead) return
    const overStage = STAGES.includes(overId as typeof STAGES[number])
      ? overId
      : leads.find(lead => lead.id === overId)?.stage
    if (!overStage || activeLead.stage === overStage) return
    setLeads(previous => previous.map(lead => lead.id === activeId ? { ...lead, stage: overStage } : lead))
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string
    const activeLead = leads.find(lead => lead.id === activeId)
    if (!activeLead) return

    const overStage = STAGES.includes(overId as typeof STAGES[number])
      ? overId
      : leads.find(lead => lead.id === overId)?.stage ?? activeLead.stage

    if (activeLead.stage === overStage && activeId !== overId) {
      const stageLeads = leadsForStage(overStage)
      const oldIndex = stageLeads.findIndex(lead => lead.id === activeId)
      const newIndex = stageLeads.findIndex(lead => lead.id === overId)
      if (oldIndex !== -1 && newIndex !== -1) {
        setLeads(previous => [
          ...previous.filter(lead => lead.stage !== overStage),
          ...arrayMove(stageLeads, oldIndex, newIndex),
        ])
      }
    }

    if (activeLead.stage !== overStage) {
      await supabase.from('leads').update({ stage: overStage }).eq('id', activeId)
      toast({ type: 'success', title: 'Stage updated', body: `→ ${overStage}` })
    }

    if (selected?.id === activeId) {
      setSelected(previous => previous ? { ...previous, stage: overStage } : previous)
    }
  }

  function handleLeadUpdated(updated: Lead) {
    setLeads(previous => previous.map(lead => lead.id === updated.id ? updated : lead))
    setSelected(updated)
  }

  function handleLeadCreated(lead: Lead) {
    setLeads(previous => [lead, ...previous])
    toast({ type: 'success', title: 'Lead created', body: lead.name ?? lead.id })
    if (isAdmin && isUnassigned(lead)) openDispatch(lead)
    else setSelected(lead)
  }

  function handleDeleteLead(id: string) {
    setLeads(previous => previous.filter(lead => lead.id !== id))
    setSelected(null)
    toast({ type: 'info', title: 'Lead deleted' })
  }

  function handleAssigned(updatedLead: Lead, assignedEmail: string) {
    setLeads(previous => previous.map(lead => lead.id === updatedLead.id ? updatedLead : lead))
    setDispatchLead(null)
    setSelected(updatedLead)
    toast({ type: 'success', title: 'Lead assigned', body: `→ ${assignedEmail.split('@')[0]}` })
  }

  function resetWorkspaceFilters() {
    resetFilter()
    setFocus('all')
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const avatarUrl = agentProfile?.avatar_url ?? avatarMap[agentEmail] ?? null
  const displayName = agentProfile?.full_name || agentEmail.split('@')[0] || 'Agent'
  const readyCount = leads.filter(lead => lead.stage === 'Waiting for contact' && isUnassigned(lead)).length

  return (
    <div className="ros-app">
      <nav className="ros-nav">
        <div className="ros-brand" onClick={() => router.push('/pipeline')}>
          <div className="ros-logo" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M3 14.5c3.3-2.4 6.2-3.4 9-3.4 3 0 5.9 1 9 3.4" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"/>
              <path d="M5.5 18c2.4-1.6 4.6-2.3 6.5-2.3 2 0 4.1.7 6.5 2.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity=".7"/>
              <circle cx="12" cy="6.7" r="3.1" fill="currentColor"/>
            </svg>
          </div>
          <div className="ros-brand-copy">
            <div className="ros-brand-title">Rental OS</div>
            <div className="ros-brand-sub">Sun Ocean Realty</div>
          </div>
          {isAdmin && <span className="ros-admin-pill"><ShieldCheck size={11}/> Broker</span>}
        </div>

        <div className="ros-view-switch" aria-label="View mode">
          <button
            type="button"
            className={`ros-view-btn ${viewMode === 'kanban' ? 'is-active' : ''}`}
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid size={14}/> Pipeline
          </button>
          <button
            type="button"
            className={`ros-view-btn ${viewMode === 'list' ? 'is-active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <List size={14}/> List
          </button>
        </div>

        <div className="ros-nav-actions">
          {isAdmin && readyCount > 0 && (
            <button className="ros-ready-pill ros-hide-mobile" onClick={() => setFocus('ready')}>
              <span className="ros-ready-dot" /> {readyCount} ready
            </button>
          )}

          {isAdmin && (
            <button className="ros-btn ros-btn-purple ros-hide-mobile" onClick={() => router.push('/admin')}>
              <UsersRound size={14}/> Broker Center
            </button>
          )}

          <button className="ros-btn ros-btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={15}/><span className="ros-hide-mobile">New lead</span>
          </button>

          {isAdmin && (
            <button className="ros-btn ros-icon-btn ros-hide-mobile" onClick={() => exportLeadsToCSV(focusedLeads)} title="Export current view to CSV">
              <Download size={15}/>
            </button>
          )}

          <button className="ros-user" onClick={() => router.push('/profile')} title="My profile">
            <span className="ros-user-avatar">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : displayName.slice(0, 2).toUpperCase()}
            </span>
            <span className="ros-user-copy">
              <span className="ros-user-name">{displayName}</span>
              <span className="ros-user-role">{isAdmin ? 'Broker' : 'Agent'}</span>
            </span>
          </button>

          <button className="ros-btn ros-icon-btn ros-hide-mobile" onClick={toggleTheme} title="Toggle light/dark theme">
            {lightTheme ? <Moon size={15}/> : <Sun size={15}/>} 
          </button>

          <button className="ros-btn ros-icon-btn ros-hide-mobile" onClick={signOut} title="Sign out">
            <LogOut size={14}/>
          </button>
        </div>
      </nav>

      <StatsBar leads={leads} isAdmin={isAdmin} focus={focus} onFocus={setFocus} />

      <FilterBar
        filter={filter}
        agents={agents}
        isFiltered={isFiltered || focus !== 'all'}
        onUpdate={setFilter}
        onReset={resetWorkspaceFilters}
        totalVisible={focusedLeads.length}
        totalAll={leads.length}
      />

      <div className="ros-workspace">
        {!isMobile && viewMode === 'kanban' ? (
          <div className="ros-board-scroll">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="ros-board">
                {STAGES.map(stage => (
                  <StageColumn
                    key={stage}
                    stage={stage}
                    leads={leadsForStage(stage)}
                    isAdmin={isAdmin}
                    agentAvatarMap={avatarMap}
                    onLeadClick={lead => setSelected(previous => previous?.id === lead.id ? null : lead)}
                  />
                ))}
              </div>
              <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
                {activeLead
                  ? <LeadCard lead={activeLead} agentAvatarMap={avatarMap} isAdmin={isAdmin} onClick={() => {}} />
                  : null}
              </DragOverlay>
            </DndContext>
          </div>
        ) : (
          <ListView
            leads={focusedLeads}
            agentAvatarMap={avatarMap}
            isAdmin={isAdmin}
            onLeadClick={lead => setSelected(previous => previous?.id === lead.id ? null : lead)}
            onDeleteLead={handleDeleteLead}
          />
        )}

        {!isMobile && (
          <div className={`ros-panel-slot ${selected ? 'is-open' : ''}`}>
            {selected && (
              <LeadPanel
                lead={selected}
                agentEmail={agentEmail}
                isAdmin={isAdmin}
                onClose={() => setSelected(null)}
                onLeadUpdated={handleLeadUpdated}
                onDeleteLead={handleDeleteLead}
                onDispatch={() => openDispatch(selected)}
              />
            )}
          </div>
        )}
      </div>

      {isMobile && selected && (
        <div className="ros-mobile-panel">
          <div className="ros-mobile-panel-head">
            <button className="ros-btn" onClick={() => setSelected(null)}>← Back</button>
            <div className="ros-mobile-panel-title">{selected.name || 'Lead details'}</div>
          </div>
          <div className="ros-mobile-panel-body">
            <LeadPanel
              lead={selected}
              agentEmail={agentEmail}
              isAdmin={isAdmin}
              onClose={() => setSelected(null)}
              onLeadUpdated={handleLeadUpdated}
              onDeleteLead={handleDeleteLead}
              onDispatch={() => openDispatch(selected)}
            />
          </div>
        </div>
      )}

      <div className="ros-mobile-actions">
        <button className={`ros-mobile-action ${focus === 'all' ? 'is-primary' : ''}`} onClick={() => setFocus('all')}>
          <LayoutGrid/>Leads
        </button>
        <button className={`ros-mobile-action ${focus === 'ready' ? 'is-primary' : ''}`} onClick={() => setFocus('ready')}>
          <UserRound/>Priority
        </button>
        <button className="ros-mobile-action is-primary" onClick={() => setShowCreate(true)}>
          <Plus/>New
        </button>
        <button className="ros-mobile-action" onClick={() => router.push('/profile')}>
          <UserRound/>Profile
        </button>
      </div>

      {showCreate && (
        <LeadCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={handleLeadCreated}
          agentEmail={agentEmail}
        />
      )}

      {dispatchLead && isAdmin && (
        <DispatchModal
          lead={dispatchLead}
          agents={allAgents}
          onClose={() => setDispatchLead(null)}
          onAssigned={handleAssigned}
        />
      )}

      <div className="ros-live-pill"><span className="ros-live-dot"/>Realtime</div>
    </div>
  )
}

export function KanbanBoard(props: KanbanBoardProps) {
  return <ToastProvider><BoardInner {...props} /></ToastProvider>
}
