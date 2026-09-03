import { Card } from '@/components/ui/card'
import { Eyebrow } from '@/components/ui/eyebrow'

export interface Fact {
  /** Stable key — a title is unique within either list this renders. */
  id: string
  title: string
  /** Who issued it. Absent for languages, where the level says everything. */
  note?: string
  /** The right-hand column: a date, or a level. */
  meta: string
}

/**
 * Certifications and languages: two short label/value lists in the rail.
 *
 * One component rather than two because the difference between them is a
 * single optional line, and two files that render the same hairline-separated
 * rows would drift the way four hand-written eyebrows once did.
 */
export function FactList({ label, facts }: { label: string; facts: Fact[] }) {
  return (
    <Card as="section">
      <Eyebrow>{label}</Eyebrow>
      <ul>
        {facts.map((fact, index) => (
          <li
            key={fact.id}
            className={`flex items-baseline justify-between gap-3 py-2 ${
              index === 0 ? 'pt-0' : 'border-t border-edge'
            }`}
          >
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">{fact.title}</span>
              {fact.note ? (
                <span className="mt-px block text-[11px] text-muted">{fact.note}</span>
              ) : null}
            </span>
            <span className="font-mono text-[11.5px] tabular-nums whitespace-nowrap text-muted">
              {fact.meta}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
