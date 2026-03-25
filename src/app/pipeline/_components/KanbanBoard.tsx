'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent,
  PointerSensor, useSensor, useSensors, DragOverlay, closestCorners,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { Lead, STAGES } from '@/types/lead'
import { AgentProfile } from '@/types/agent'
import { StageColumn } from './StageColumn'
import { LeadPanel } from './LeadPanel'
import { LeadCard } from './LeadCard'
import { ListView } from './ListView'
import { StatsBar } from './StatsBar'
import { FilterBar } from './FilterBar'
import { LeadCreateModal } from './LeadCreateModal'
import { DispatchModal } from './DispatchModal'
import { useLeadsRealtime } from '@/lib/useLeadsRealtime'
import { useLeadFilter } from '@/lib/useLeadFilter'
import { useToast, ToastProvider } from '@/lib/useToast'
import { exportLeadsToCSV } from '@/lib/exportCSV'
import { getSupabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface KanbanBoardProps {
  initialLeads: Lead[]
  agentEmail: string
  agentId: string
  isAdmin: boolean
  agentProfile: AgentProfile | null
  agentAvatarMap: Record<string, string | null>
}

function BoardInner({
  initialLeads, agentEmail, agentId, isAdmin, agentProfile, agentAvatarMap: initAvatarMap,
}: KanbanBoardProps) {
  const supabase = getSupabase()
  const router   = useRouter()
  const { push: toast } = useToast()

  const [leads,       setLeads]       = useState<Lead[]>(initialLeads)
  const [selected,    setSelected]    = useState<Lead | null>(null)
  const [activeId,    setActiveId]    = useState<string | null>(null)
  const [showCreate,  setShowCreate]  = useState(false)
  const [viewMode,    setViewMode]    = useState<'kanban' | 'list'>('kanban')
  const [avatarMap,   setAvatarMap]   = useState(initAvatarMap)
  const [isMobile,    setIsMobile]    = useState(false)
  // Dispatch modal state (admin-only)
  const [dispatchLead, setDispatchLead] = useState<Lead | null>(null)
  const [allAgents,    setAllAgents]    = useState<AgentProfile[]>([])

  // Detect mobile + auto-switch to list view
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile && viewMode === 'kanban') setViewMode('list')
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, []) // eslint-disable-line

  // Lazy-load agents when dispatch modal needs them (admin only)
  async function openDispatch(lead: Lead) {
    if (!isAdmin) return
    if (allAgents.length === 0) {
      const { data } = await supabase
        .from('agent_profiles').select('*').order('created_at')
      if (data) setAllAgents(data as AgentProfile[])
    }
    setDispatchLead(lead)
    setSelected(null)  // close panel while dispatch modal is open
  }

  // ── Realtime ─────────────────────────────────────────────────────────────
  const handleInsert = useCallback((lead: Lead) => {
    setLeads(p => p.find(l => l.id === lead.id) ? p : [lead, ...p])
    toast({
      type: 'lead',
      title: 'New lead arrived',
      body: `${lead.name ?? lead.id}`,
      duration: 8000,
    })
    // Auto-open dispatch if admin and lead is unassigned
    if (isAdmin && (!lead.assigned_agent || lead.assigned_agent === 'Unassigned')) {
      openDispatch(lead)
    }
  }, [toast, isAdmin]) // eslint-disable-line

  const handleUpdate = useCallback((lead: Lead) => {
    setLeads(p => p.map(l => l.id === lead.id ? lead : l))
    setSelected(p => p?.id === lead.id ? lead : p)
    // Update avatar map if agent profile changed
    if (lead.assigned_agent) {
      setAvatarMap(p => ({ ...p })) // trigger re-render; full refresh handled by pipeline page
    }
  }, [])

  const handleDelete = useCallback((id: string) => {
    setLeads(p => p.filter(l => l.id !== id))
    setSelected(p => p?.id === id ? null : p)
  }, [])

  useLeadsRealtime({ onInsert: handleInsert, onUpdate: handleUpdate, onDelete: handleDelete })

  // ── Filter ────────────────────────────────────────────────────────────────
  const { filter, update: setFilter, reset: resetFilter, filtered, agents, isFiltered } =
    useLeadFilter(leads)

  // ── DnD ───────────────────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const leadsForStage = useCallback((s: string) => filtered.filter(l => l.stage === s), [filtered])
  const activeLead = activeId ? leads.find(l => l.id === activeId) ?? null : null

  function handleDragStart(e: DragStartEvent) { setActiveId(e.active.id as string) }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const aId = active.id as string, oId = over.id as string
    const aLead = leads.find(l => l.id === aId)
    if (!aLead) return
    const overStage = STAGES.includes(oId as typeof STAGES[number])
      ? oId : leads.find(l => l.id === oId)?.stage
    if (!overStage || aLead.stage === overStage) return
    setLeads(p => p.map(l => l.id === aId ? { ...l, stage: overStage } : l))
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveId(null)
    if (!over) return
    const aId = active.id as string, oId = over.id as string
    const aLead = leads.find(l => l.id === aId)
    if (!aLead) return
    const overStage = STAGES.includes(oId as typeof STAGES[number])
      ? oId : leads.find(l => l.id === oId)?.stage ?? aLead.stage

    if (aLead.stage === overStage && aId !== oId) {
      const sl = leadsForStage(overStage)
      const oi = sl.findIndex(l => l.id === aId)
      const ni = sl.findIndex(l => l.id === oId)
      if (oi !== -1 && ni !== -1)
        setLeads(p => [...p.filter(l => l.stage !== overStage), ...arrayMove(sl, oi, ni)])
    }
    if (aLead.stage !== overStage) {
      await supabase.from('leads').update({ stage: overStage }).eq('id', aId)
      toast({ type: 'success', title: 'Stage updated', body: `→ ${overStage}` })
    }
    if (selected?.id === aId) setSelected(p => p ? { ...p, stage: overStage } : p)
  }

  function handleLeadUpdated(updated: Lead) {
    setLeads(p => p.map(l => l.id === updated.id ? updated : l))
    setSelected(updated)
  }

  function handleLeadCreated(lead: Lead) {
    setLeads(p => [lead, ...p])
    toast({ type: 'success', title: 'Lead created', body: lead.name ?? lead.id })
    // If admin, auto-open dispatch for new manual lead if unassigned
    if (isAdmin && (!lead.assigned_agent || lead.assigned_agent === 'Unassigned')) {
      openDispatch(lead)
    } else {
      setSelected(lead)
    }
  }

  function handleDeleteLead(id: string) {
    setLeads(p => p.filter(l => l.id !== id))
    setSelected(null)
    toast({ type: 'info', title: 'Lead deleted' })
  }

  function handleAssigned(updatedLead: Lead, agentEmail: string) {
    setLeads(p => p.map(l => l.id === updatedLead.id ? updatedLead : l))
    setDispatchLead(null)
    setSelected(updatedLead)
    toast({ type: 'success', title: 'Lead assigned', body: `→ ${agentEmail.split('@')[0]}` })
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const avatarUrl = agentProfile?.avatar_url ?? avatarMap[agentEmail] ?? null

  return (
    <div style={{
      background: '#0a0d14',
      color: '#e6edf3',
      fontFamily: 'var(--font-geist-sans, system-ui)',
      height: '100dvh',
      display: 'flex', flexDirection: 'column',
      fontSize: 14, overflow: 'hidden',
    }}>
      {/* Background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56,139,253,0.07) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(163,113,247,0.04) 0%, transparent 60%)',
      }} />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'relative', zIndex: 10,
        background: 'rgba(13,16,28,0.9)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: isMobile ? '0 0.75rem' : '0 1.25rem', height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, gap: 8,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, cursor: 'pointer' }} onClick={() => router.push('/pipeline')}>
          <div style={{
            width: 30, height: 30,
            background: 'linear-gradient(135deg, #e87c2a, #f5a623)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(245,166,35,0.25)',
          }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="8" r="5" fill="white" opacity="0.9"/>
              <path d="M2 14 Q10 10 18 14" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
              <path d="M4 17 Q10 13 16 17" stroke="white" strokeWidth="1.5" fill="none" opacity="0.6" strokeLinecap="round"/>
            </svg>
          </div>
          {!isMobile && (
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.3px', color: '#f0f6fc' }}>
              Sun Ocean<span style={{ color: '#f5a623', marginLeft: 4 }}>Realty</span>
            </span>
          )}
          {isAdmin && (
            <span style={{
              fontSize: 10, background: 'rgba(163,113,247,0.2)', color: '#a371f7',
              border: '0.5px solid rgba(163,113,247,0.35)',
              borderRadius: 20, padding: '2px 8px', fontWeight: 700, letterSpacing: '0.3px',
            }}>ADMIN</span>
          )}
        </div>

        {/* Centre: view toggle — hide on mobile */}
        {!isMobile && (
          <div style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: 3, gap: 2,
          }}>
            {(['kanban', 'list'] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{
                background: viewMode === mode ? 'rgba(56,139,253,0.22)' : 'transparent',
                border: viewMode === mode ? '0.5px solid rgba(56,139,253,0.4)' : '0.5px solid transparent',
                color: viewMode === mode ? '#388bfd' : '#6e7681',
                borderRadius: 5, padding: '4px 12px',
                fontSize: 12, fontWeight: viewMode === mode ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
              }}>
                {mode === 'kanban' ? '⊞ Kanban' : '☰ List'}
              </button>
            ))}
          </div>
        )}

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8, flexShrink: 0 }}>
          {!isMobile && <span style={{ fontSize: 12, color: '#6e7681' }}>{leads.length} leads</span>}

          {isAdmin && !isMobile && (
            <button onClick={() => router.push('/admin')} style={{
              background: 'rgba(163,113,247,0.1)',
              border: '0.5px solid rgba(163,113,247,0.3)',
              color: '#a371f7', padding: '5px 11px', borderRadius: 6,
              fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              God Mode
            </button>
          )}

          <button onClick={() => setShowCreate(true)} style={{
            background: 'linear-gradient(135deg, #0550ae, #388bfd)',
            color: '#fff', border: 'none', borderRadius: 6,
            padding: '5px 13px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: '0 2px 8px rgba(56,139,253,0.28)',
          }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>{isMobile ? '' : ' New Lead'}
          </button>

          {isAdmin && !isMobile && (
            <button onClick={() => exportLeadsToCSV(filtered)} style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#8b949e', padding: '5px 11px', borderRadius: 6,
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              ↓ CSV
            </button>
          )}

          <div onClick={() => router.push('/profile')} title="My Profile" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            cursor: 'pointer', padding: '4px 8px',
            borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: avatarUrl ? 'transparent' : 'rgba(56,139,253,0.18)',
              border: '1.5px solid rgba(56,139,253,0.35)',
              overflow: 'hidden', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#388bfd',
            }}>
              {avatarUrl
                ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : agentEmail.slice(0, 2).toUpperCase()
              }
            </div>
            {!isMobile && <span style={{ fontSize: 11, color: '#8b949e' }}>Profile</span>}
          </div>

          {!isMobile && (
            <button onClick={signOut} style={{
              background: 'none', border: 'none', color: '#6e7681',
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Sign out
            </button>
          )}

          {/* Dark/Light mode toggle */}
          <button onClick={() => {
            const body = document.body
            const isLight = body.getAttribute('data-theme') === 'light'
            if (isLight) {
              body.removeAttribute('data-theme')
              body.style.filter = ''
            } else {
              body.setAttribute('data-theme', 'light')
              body.style.filter = 'invert(0.92) hue-rotate(180deg)'
            }
          }} style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#8b949e', width: 28, height: 28, borderRadius: 6,
            cursor: 'pointer', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }} title="Toggle light/dark mode">
            ◐
          </button>
        </div>
      </nav>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 9, flexShrink: 0 }}>
        <StatsBar leads={leads} isAdmin={isAdmin} />
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 8, flexShrink: 0 }}>
        <FilterBar
          filter={filter} agents={agents} isFiltered={isFiltered}
          onUpdate={setFilter} onReset={resetFilter}
          totalVisible={filtered.length} totalAll={leads.length}
        />
      </div>

      {/* ── Board + Panel ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, position: 'relative', zIndex: 1 }}>
        {viewMode === 'kanban' ? (
          <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '12px 12px 0', minWidth: 0 }}>
            <DndContext
              sensors={sensors} collisionDetection={closestCorners}
              onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}
            >
              <div style={{
                display: 'flex', gap: 10, height: '100%',
                minWidth: 'max-content', alignItems: 'stretch', paddingBottom: 12,
              }}>
                {STAGES.map(stage => (
                  <StageColumn key={stage} stage={stage}
                    leads={leadsForStage(stage)}
                    isAdmin={isAdmin} agentAvatarMap={avatarMap}
                    onLeadClick={lead => setSelected(p => p?.id === lead.id ? null : lead)}
                  />
                ))}
              </div>
              <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
                {activeLead ? <LeadCard lead={activeLead} agentAvatarMap={avatarMap} isAdmin={isAdmin} onClick={() => {}} /> : null}
              </DragOverlay>
            </DndContext>
          </div>
        ) : (
          <ListView
            leads={filtered} agentAvatarMap={avatarMap} isAdmin={isAdmin}
            onLeadClick={lead => setSelected(p => p?.id === lead.id ? null : lead)}
            onDeleteLead={handleDeleteLead}
          />
        )}

        {/* Slide-out panel — full screen overlay on mobile, side panel on desktop */}
        {isMobile && selected && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: '#0d1117',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Mobile back bar */}
            <div style={{
              padding: '10px 16px', flexShrink: 0,
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              background: 'rgba(13,16,28,0.95)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <button onClick={() => setSelected(null)} style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#e6edf3', borderRadius: 8, padding: '8px 16px',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                ← Back
              </button>
              <span style={{ fontSize: 14, color: '#f0f6fc', fontWeight: 600 }}>{selected.name ?? 'Lead'}</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <LeadPanel
                lead={selected} agentEmail={agentEmail} isAdmin={isAdmin}
                onClose={() => setSelected(null)}
                onLeadUpdated={handleLeadUpdated}
                onDeleteLead={handleDeleteLead}
                onDispatch={() => openDispatch(selected)}
              />
            </div>
          </div>
        )}
        {!isMobile && (
          <div style={{
            maxWidth: selected ? 380 : 0, width: 380,
            overflow: 'hidden',
            transition: 'max-width .28s cubic-bezier(0.4,0,0.2,1)',
            borderLeft: '1px solid rgba(255,255,255,0.07)',
            flexShrink: 0,
          }}>
            {selected && (
              <LeadPanel
                lead={selected} agentEmail={agentEmail} isAdmin={isAdmin}
                onClose={() => setSelected(null)}
                onLeadUpdated={handleLeadUpdated}
                onDeleteLead={handleDeleteLead}
                onDispatch={() => openDispatch(selected)}
              />
            )}
          </div>
        )}
      </div>

      {/* Modals */}
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

      {/* Live dot */}
      <div style={{
        position: 'fixed', bottom: 14, right: 16, zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(13,16,28,0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20, padding: '4px 10px',
        fontSize: 11, color: '#6e7681', pointerEvents: 'none',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: '#3fb950',
          display: 'inline-block', animation: 'livePulse 2.4s ease infinite',
        }} />
        Live
        <style>{`@keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.8)}}`}</style>
      </div>
    </div>
  )
}

export function KanbanBoard(props: KanbanBoardProps) {
  return <ToastProvider><BoardInner {...props} /></ToastProvider>
}
