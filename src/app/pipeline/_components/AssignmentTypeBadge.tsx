import { Eye, Handshake } from 'lucide-react'
import { ASSIGNMENT_TYPES, AssignmentType } from '@/types/lead'
import styles from './board.module.css'

/** "Full" / "Showing" pill; renders nothing for leads assigned before types existed. */
export function AssignmentTypeBadge({ type, long = false }: { type?: AssignmentType | null; long?: boolean }) {
  if (!type || !ASSIGNMENT_TYPES[type]) return null
  const info = ASSIGNMENT_TYPES[type]
  return (
    <span className={styles.type} style={{ '--type': info.color } as React.CSSProperties} title={`${info.label}: ${info.pay}`}>
      {type === 'full' ? <Handshake size={11} aria-hidden="true"/> : <Eye size={11} aria-hidden="true"/>}
      {long ? info.label : info.short}
    </span>
  )
}
