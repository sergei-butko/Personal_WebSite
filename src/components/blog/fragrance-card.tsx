import type { FragranceMeta } from '@/lib/blog/types'

interface FragranceCardProps {
  fragrance: FragranceMeta
  labels: {
    title: string
    house: string
    name: string
    perfumer: string
    concentration: string
    year: string
    batchCode: string
  }
}

/**
 * The specimen sheet for a post about one bottle. Every field except the
 * house is optional and omitted rows simply do not render — an unknown
 * perfumer should read as absent, not as an empty dash.
 */
export function FragranceCard({ fragrance, labels }: FragranceCardProps) {
  const rows: Array<{ label: string; value: string }> = []
  const push = (label: string, value: string | number | undefined) => {
    if (value !== undefined) rows.push({ label, value: String(value) })
  }

  push(labels.house, fragrance.house)
  push(labels.name, fragrance.name)
  push(labels.perfumer, fragrance.perfumer)
  push(labels.concentration, fragrance.concentration)
  push(labels.year, fragrance.year)
  push(labels.batchCode, fragrance.batchCode)

  return (
    <aside className="mb-10 rounded-[var(--radius-card)] border border-edge bg-surface p-5">
      <p className="mb-3 font-mono text-[10.5px] font-semibold tracking-[0.1em] text-muted uppercase">
        {labels.title}
      </p>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-4 border-b border-edge pb-2 last:border-0"
          >
            <dt className="text-[12px] text-muted">{row.label}</dt>
            <dd className="text-right font-mono text-[12.5px] font-medium">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}
