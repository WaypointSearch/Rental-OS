import Link from 'next/link'
import { FileUp, HandCoins } from 'lucide-react'
import styles from './pipeline-layout.module.css'

export default function PipelineLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div className={styles.actions} aria-label="Agent transaction actions">
        <Link href="/transactions"><FileUp size={14}/> Submit Docs</Link>
        <Link href="/commission"><HandCoins size={14}/> Request Commission</Link>
      </div>
    </>
  )
}
