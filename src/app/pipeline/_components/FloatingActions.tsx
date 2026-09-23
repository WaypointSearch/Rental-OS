'use client'

import Link from 'next/link'
import { BriefcaseBusiness, FileUp, HandCoins } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import styles from '../pipeline-layout.module.css'

/** Desktop shortcuts to the agent's deal tools (the phone uses the bottom tab bar). */
export function FloatingActions() {
  const { t } = useI18n()
  return (
    <div className={styles.actions} aria-label={t('nav.myDeals')}>
      <Link href="/deals"><BriefcaseBusiness size={14}/> {t('nav.myDeals')}</Link>
      <Link href="/transactions"><FileUp size={14}/> {t('nav.submitDocs')}</Link>
      <Link href="/commission"><HandCoins size={14}/> {t('nav.requestCommission')}</Link>
    </div>
  )
}
