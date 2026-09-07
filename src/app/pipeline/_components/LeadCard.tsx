'use client'

import { formatDistanceToNowStrict } from 'date-fns'
import { BedDouble, CalendarDays, FileText, MapPin, MessageSquare, Phone } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Lead, STAGE_COLORS } from '@/types/lead'

interface LeadCardProps {
  lead: Lead
  onClick: () => void
  agentAvatarMap: Record<string, string | null>
  isAdmin?: boolean
}

function agentInitials(email: string): string {
  return email
    .split('@')[0]
    .split(/[._-]/)
    .map(part => part[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')
}

function cleanAgent(email: string | null | undefined) {
  if (!email || email === 'Unassigned') return 'Unassigned'
  return email.split('@')[0]
}

export function LeadCard({ lead, onClick, agentAvatarMap, isAdmin = false }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })
  const accent = STAGE_COLORS[lead.stage] ?? '#6e7681'
  const avatarUrl = lead.assigned_agent ? (agentAvatarMap[lead.assigned_agent] ?? null) : null
  const notes = lead.notes ?? []
  const documents = lead.documents ?? []
  const source = (lead.source ?? '').toLowerCase()
  const sourceClass = source.includes('facebook') ? 'is-facebook' : 'is-google'
  const age = formatDistanceToNowStrict(new Date(lead.created_at), { addSuffix: true })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
      }}
      {...attributes}
      {...listeners}
      onClick={onClick}
    >
      <article
        className="ros-card"
        style={{ '--stage-accent': accent } as React.CSSProperties}
      >
        <div className="ros-card-accent" />

        <div className="ros-card-head">
          <span className={`ros-source-dot ${sourceClass}`} title={lead.source ?? 'Lead'} />
          <div className="ros-card-identity">
            <div className="ros-card-name">{lead.name || 'Unnamed lead'}</div>
            {lead.phone && (
              <a
                className="ros-card-phone"
                href={`tel:${lead.phone.replace(/\D/g, '')}`}
                onClick={event => event.stopPropagation()}
              >
                <Phone size={11} strokeWidth={2.2} /> {lead.phone}
              </a>
            )}
          </div>
          <span className="ros-mini-tag" title="Lead age">{age}</span>
        </div>

        {lead.budget && (
          <div className="ros-card-budget">
            <span>Budget</span>
            <strong>{lead.budget}</strong>
          </div>
        )}

        <div className="ros-card-facts">
          {lead.area && (
            <div className="ros-card-fact">
              <MapPin size={12} strokeWidth={2} />
              <span className="ros-card-fact-text"><strong>{lead.area}</strong></span>
            </div>
          )}
          {(lead.bedrooms || lead.bathrooms) && (
            <div className="ros-card-fact">
              <BedDouble size={12} strokeWidth={2} />
              <span><strong>{lead.bedrooms ?? '?'} bd</strong> · {lead.bathrooms ?? '?'} ba</span>
            </div>
          )}
          {lead.move_in && (
            <div className="ros-card-fact">
              <CalendarDays size={12} strokeWidth={2} />
              <span>Move: <strong>{lead.move_in}</strong></span>
            </div>
          )}
        </div>

        <div className="ros-card-foot">
          {isAdmin && (
            <div className="ros-agent-chip" title={lead.assigned_agent || 'Unassigned'}>
              <span className="ros-agent-mini">
                {avatarUrl
                  ? <img src={avatarUrl} alt="" />
                  : agentInitials(lead.assigned_agent ?? '') || '—'}
              </span>
              <span>{cleanAgent(lead.assigned_agent)}</span>
            </div>
          )}

          <div className="ros-card-tags">
            {documents.length > 0 && (
              <span className="ros-mini-tag"><FileText size={10} />{documents.length}</span>
            )}
            {notes.length > 0 && (
              <span className="ros-mini-tag"><MessageSquare size={10} />{notes.length}</span>
            )}
          </div>
        </div>
      </article>
    </div>
  )
}
