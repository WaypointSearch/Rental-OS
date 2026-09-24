'use client'

import { Eye, Handshake } from 'lucide-react'
import { ASSIGNMENT_TYPES, AssignmentType } from '@/types/lead'
import styles from './board.module.css'
import { useI18n } from '@/lib/i18n'

/** "Full" / "Showing" pill; renders nothing for leads assigned before types existed. */
export function AssignmentTypeBadge({ type, long = false }: { type?: AssignmentType | null; long?: boolean }) {
  const { t } = useI18n()
  if (!type || !ASSIGNMENT_TYPES[type]) return null
  const info = ASSIGNMENT_TYPES[type]
  const label = type === 'full' ? t(long ? 'type.full' : 'type.fullShort') : t(long ? 'type.showing' : 'type.showingShort')
  const pay = t(type === 'full' ? 'type.fullPay' : 'type.showingPay')
  return (
    <span className={styles.type} style={{ '--type': info.color } as React.CSSProperties} title={`${label}: ${pay}`}>
      {type === 'full' ? <Handshake size={11} aria-hidden="true"/> : <Eye size={11} aria-hidden="true"/>}
      {label}
    </span>
  )
}
