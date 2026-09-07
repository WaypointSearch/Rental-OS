'use client'

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
  return email.split('@')[0].split(/[._-]/).map(p => p[0]?.toUpperCase() ?? '').slice(0, 2).join('')
}

export function LeadCard({ lead, onClick, agentAvatarMap, isAdmin = false }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })
  const accent = STAGE_COLORS[lead.stage] ?? '#6e7681'
  const avatarUrl = lead.assigned_agent ? (agentAvatarMap[lead.assigned_agent] ?? null) : null
  const agentLabel = lead.assigned_agent && lead.assigned_agent !== 'Unassigned'
    ? lead.assigned_agent.split('@')[0] : 'Unassigned'
  const hasDocs = (lead.documents ?? []).length > 0

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, cursor: isDragging ? 'grabbing' : 'grab' }}
      {...attributes} {...listeners} onClick={onClick}
    >
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 12, padding: '12px 14px',
        transition: 'border-color .15s, background .15s',
        userSelect: 'none', position: 'relative', overflow: 'hidden',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLDivElement).style.borderColor = `${accent}55` }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.09)' }}
      >
        {/* Left accent */}
        <div style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, background: accent, opacity: 0.8 }} />

        {/* Name + Phone */}
        <div style={{ paddingLeft: 10, marginBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6fc', letterSpacing: '-0.2px' }}>
            {lead.name ?? 'Unknown'}
          </div>
          {lead.phone && (
            <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
              style={{ fontSize: 12, color: '#388bfd', textDecoration: 'none', fontWeight: 500 }}>
              {lead.phone}
            </a>
          )}
        </div>

        {/* Info grid */}
        <div style={{ paddingLeft: 10, display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
          {lead.budget && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#6e7681', width: 42, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Budget</span>
              <span style={{ fontSize: 12, color: accent, fontWeight: 600 }}>{lead.budget}</span>
            </div>
          )}
          {lead.area && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#6e7681', width: 42, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Area</span>
              <span style={{ fontSize: 11, color: '#c9d1d9', lineHeight: 1.4, wordBreak: 'break-word' }}>{lead.area}</span>
            </div>
          )}
          {lead.move_in && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#6e7681', width: 42, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Move</span>
              <span style={{ fontSize: 11, color: '#8b949e' }}>{lead.move_in}</span>
            </div>
          )}
          {(lead.bedrooms || lead.bathrooms) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#6e7681', width: 42, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Bd/Ba</span>
              <span style={{ fontSize: 11, color: '#8b949e' }}>{lead.bedrooms ?? '?'}/{lead.bathrooms ?? '?'}</span>
            </div>
          )}
        </div>

        {/* Bottom row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          paddingLeft: 10, paddingTop: 7,
          borderTop: '0.5px solid rgba(255,255,255,0.06)',
        }}>
          {isAdmin && (
            <>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: avatarUrl ? 'transparent' : 'rgba(56,139,253,0.2)',
                border: '1px solid rgba(56,139,253,0.3)', overflow: 'hidden', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, fontWeight: 600, color: '#388bfd',
              }}>
                {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : agentInitials(lead.assigned_agent ?? '')}
              </div>
              <span style={{ fontSize: 10, color: '#6e7681', fontWeight: 500 }}>{agentLabel}</span>
            </>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center' }}>
            {hasDocs && (
              <span style={{ fontSize: 10, background: 'rgba(56,139,253,0.12)', color: '#388bfd', borderRadius: 20, padding: '2px 7px', fontWeight: 600, border: '0.5px solid rgba(56,139,253,0.25)' }}>
                {(lead.documents ?? []).length} doc{(lead.documents ?? []).length !== 1 ? 's' : ''}
              </span>
            )}
            {lead.notes.length > 0 && (
              <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.07)', borderRadius: 20, padding: '2px 7px', color: '#6e7681' }}>{lead.notes.length}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
