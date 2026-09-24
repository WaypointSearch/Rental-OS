import { FloatingActions } from './_components/FloatingActions'

export default function PipelineLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <FloatingActions />
    </>
  )
}
