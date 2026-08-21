import type { ReactNode } from 'react'

/**
 * The bento mosaic. Four columns on desktop, two on tablet, one on phone.
 * Individual tiles declare their own spans via Card className.
 */
export function BentoGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
  )
}
