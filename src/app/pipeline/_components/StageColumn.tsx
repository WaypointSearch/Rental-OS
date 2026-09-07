'use client'

import { DollarSign } from 'lucide-react'
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

export function StageColumn({ stage, leads, isAdmin, agentAvatarMap, onLeadClick }: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const accent = STAGE_COLORS[stage] ?? '#6e7681'
  const commission = isAdmin
    ? leads.reduce((sum, lead) => sum + parseBudget(lead.budget), 0) / 2
    : 0

  return (
    <section
      className="ros-column"
      style={{
        '--stage-accent': accent,
        borderColor: isOver ? `color-mix(in srgb, ${accent} 45%, transparent)` : undefined,
      } as React.CSSProperties}
      aria-label={`${stage}, ${leads.length} leads`}
    >
      <header className="ros-column-head">
        <div className="ros-column-title-row">
          <div className="ros-column-title">{stage}</div>
          <div className="ros-column-count">{leads.length}</div>
        </div>
        {isAdmin && commission > 0 && (
          <div className="ros-column-revenue">
            <DollarSign size={12} strokeWidth={2.2} />
            <span>{formatCommission(commission)} potential commission</span>
          </div>
        )}
      </header>

      <div ref={setNodeRef} className="ros-column-list">
        <SortableContext items={leads.map(lead => lead.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              agentAvatarMap={agentAvatarMap}
              isAdmin={isAdmin}
              onClick={() => onLeadClick(lead)}
            />
          ))}
        </SortableContext>

        {leads.length === 0 && <div className="ros-column-empty">Drop a lead here</div>}
      </div>
    </section>
  )
}
