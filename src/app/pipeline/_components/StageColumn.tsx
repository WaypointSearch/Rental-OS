'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Lead, STAGE_COLORS, parseBudget, formatCommission } from '@/types/lead'
import { LeadCard } from './LeadCard'

interface StageColumnProps {
  stage: string
  leads: Lead[]
  isAdmin: boolean
  agentAvatarMap: Record<string, string | null>
  onLeadClick: (lead: Lead) => void
}

export function StageColumn({
  stage,
  leads,
  isAdmin,
  agentAvatarMap,
  onLeadClick,
}: StageColumnProps) {
  const { setNodeRef } = useDroppable({ id: stage })
  const accent = STAGE_COLORS[stage] ?? '#6e7681'

  const commission = isAdmin
    ? leads.reduce((sum, l) => sum + parseBudget(l.budget), 0) / 2
    : 0

  return (
    <div
      style={{
        width: 222,
        flexShrink: 0,
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        maxHeight: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px 9px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#c9d1d9', lineHeight: 1.3 }}>
            {stage}
          </span>
          <span
            style={{
              fontSize: 11,
              background: `${accent}22`,
              color: accent,
              padding: '2px 8px',
              borderRadius: 20,
              fontWeight: 600,
            }}
          >
            {leads.length}
          </span>
        </div>

        {/* Admin-only commission total */}
        {isAdmin && commission > 0 && (
          <div
            style={{
              marginTop: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'rgba(63,185,80,0.1)',
              border: '0.5px solid rgba(63,185,80,0.25)',
              borderRadius: 6,
              padding: '3px 8px',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="#3fb950" strokeWidth="1.2" />
              <path d="M5 2.5v5M3.5 3.8h2a.7.7 0 010 1.4H4a.7.7 0 000 1.4h2.5"
                stroke="#3fb950" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 11, color: '#3fb950', fontWeight: 600 }}>
              {formatCommission(commission)}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(63,185,80,0.6)' }}>eligible</span>
          </div>
        )}
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        style={{
          padding: 8,
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
          minHeight: 60,
        }}
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              agentAvatarMap={agentAvatarMap}
              isAdmin={isAdmin}
              onClick={() => onLeadClick(lead)}
            />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.2)',
              textAlign: 'center',
              padding: '1.5rem 0',
            }}
          >
            Empty
          </div>
        )}
      </div>
    </div>
  )
}
