import { Eyebrow } from '@/components/ui/eyebrow'

/**
 * The label above a section of the CV, with an optional note on the right —
 * the tenure beside Experience, "by area" beside Stack.
 *
 * The note is not decoration: on a page where every section is a list of
 * dated things, it is the one place a total can be stated once instead of
 * being counted off the rows.
 */
export function SectionHead({ label, note }: { label: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-1 pb-0.5">
      <Eyebrow className="mb-0">{label}</Eyebrow>
      {note ? <span className="font-mono text-[11px] text-muted">{note}</span> : null}
    </div>
  )
}
