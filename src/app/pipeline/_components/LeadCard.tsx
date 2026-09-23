'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MessageSquareText, Paperclip } from 'lucide-react'
import { Lead, STAGE_COLORS } from '@/types/lead'
import { AssignmentTypeBadge } from './AssignmentTypeBadge'
import styles from './board.module.css'

interface LeadCardProps {
  lead: Lead
  onClick: () => void
  agentAvatarMap: Record<string, string | null>
  isAdmin?: boolean
}

function agentInitials(email: string): string {
  return email.split('@')[0].split(/[._-]/).map(p => p[0]?.toUpperCase() ?? '').slice(0, 2).join('')
}

function ageInfo(createdAt: string) {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  const label = days <= 0 ? 'Today' : `${days}d`
  const color = days <= 3 ? '#3fb950' : days <= 10 ? '#e3b341' : '#f85149'
  return { label, color, days }
}

export function LeadCard({ lead, onClick, agentAvatarMap, isAdmin = false }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })
  const accent = STAGE_COLORS[lead.stage] ?? '#6e7681'
  const isUnassigned = !lead.assigned_agent || lead.assigned_agent === 'Unassigned'
  const avatarUrl = !isUnassigned ? (agentAvatarMap[lead.assigned_agent] ?? null) : null
  const agentLabel = isUnassigned ? 'Unassigned' : lead.assigned_agent.split('@')[0]
  const docs = (lead.documents ?? []).length
  const notes = (lead.notes ?? []).length
  const age = ageInfo(lead.created_at)
  const name = lead.name ?? 'Unknown'

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); onClick() }
        listeners?.onKeyDown?.(event)
      }}
      aria-label={`Open lead ${name}, stage ${lead.stage}`}
      data-lead-id={lead.id}
      data-stage={lead.stage}
      className={styles.card}
      style={{
        '--accent': accent,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      } as React.CSSProperties}
    >
      <div className={styles.cardTop}>
        <div className={styles.cardName}>{name}</div>
        <span className={styles.age} style={{ '--age': age.color } as React.CSSProperties} title={`Created ${age.days} day${age.days === 1 ? '' : 's'} ago`}>{age.label}</span>
      </div>
      {lead.phone && (
        <a className={styles.phone} href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
          {lead.phone}
        </a>
      )}

      <div className={styles.chips}>
        {lead.budget && <span className={`${styles.chip} ${styles.chipBudget}`}>{lead.budget}</span>}
        {(lead.bedrooms || lead.bathrooms) && <span className={styles.chip}>{lead.bedrooms ?? '?'} bd · {lead.bathrooms ?? '?'} ba</span>}
        {lead.move_in && <span className={styles.chip}>Move {lead.move_in}</span>}
      </div>
      {lead.area && <div className={styles.area}>{lead.area}</div>}

      <div className={styles.foot}>
        {isAdmin && (
          <>
            {!isUnassigned && (
              <span className={styles.avatar} aria-hidden="true">
                {avatarUrl ? <img src={avatarUrl} alt="" /> : agentInitials(lead.assigned_agent)}
              </span>
            )}
            <span className={`${styles.agent} ${isUnassigned ? styles.unassigned : ''}`}>{agentLabel}</span>
          </>
        )}
        {!isUnassigned && <AssignmentTypeBadge type={lead.assignment_type} />}
        <span className={styles.meta}>
          {docs > 0 && <span className={styles.count} title={`${docs} document${docs === 1 ? '' : 's'}`}><Paperclip size={12} aria-hidden="true"/>{docs}</span>}
          {notes > 0 && <span className={styles.count} title={`${notes} note${notes === 1 ? '' : 's'}`}><MessageSquareText size={12} aria-hidden="true"/>{notes}</span>}
        </span>
      </div>
    </div>
  )
}
