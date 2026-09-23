'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CircleDollarSign } from 'lucide-react'
import { Lead, STAGE_COLORS, parseBudget, formatCommission } from '@/types/lead'
import { LeadCard } from './LeadCard'
import styles from './board.module.css'
import { useI18n } from '@/lib/i18n'

interface StageColumnProps {
  stage: string
  leads: Lead[]
  isAdmin: boolean
  agentAvatarMap: Record<string, string | null>
  onLeadClick: (lead: Lead) => void
}

export function StageColumn({ stage, leads, isAdmin, agentAvatarMap, onLeadClick }: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const { t, stage: stageName } = useI18n()
  const accent = STAGE_COLORS[stage] ?? '#6e7681'
  const commission = isAdmin ? leads.reduce((sum, l) => sum + parseBudget(l.budget), 0) / 2 : 0

  return (
    <section
      className={`${styles.column} ${isOver ? styles.over : ''}`}
      style={{ '--accent': accent } as React.CSSProperties}
      aria-label={`${stageName(stage)}, ${leads.length}`}
    >
      <header className={styles.columnHead}>
        <div className={styles.columnTitle}>
          <h2>{stageName(stage)}</h2>
          <span className={styles.columnCount}>{leads.length}</span>
        </div>
        {isAdmin && commission > 0 && (
          <div className={styles.eligible}>
            <CircleDollarSign size={13} aria-hidden="true"/> {formatCommission(commission)} <span>{t('board.eligible')}</span>
          </div>
        )}
      </header>

      <div ref={setNodeRef} className={styles.cards}>
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <LeadCard key={lead.id} lead={lead} agentAvatarMap={agentAvatarMap} isAdmin={isAdmin} onClick={() => onLeadClick(lead)} />
          ))}
        </SortableContext>
        {leads.length === 0 && <div className={styles.empty}>{t('board.dragHere')}</div>}
      </div>
    </section>
  )
}
