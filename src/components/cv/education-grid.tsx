import type { Locale } from '@/lib/i18n'
import { type CvEducation, text } from '@/lib/cv'
import { Card } from '@/components/ui/card'

/** The two degrees, side by side. */
export function EducationGrid({
  entries,
  locale,
}: {
  entries: CvEducation[]
  locale: Locale
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {entries.map((entry) => (
        <Card key={text(entry.title, 'en')} as="article" className="p-4">
          <h3 className="text-sm font-semibold tracking-tight">
            {text(entry.title, locale)}
          </h3>
          <p className="mt-0.5 text-xs text-muted">{text(entry.org, locale)}</p>
          <span className="mt-2 block font-mono text-[11.5px] tabular-nums text-muted">
            {text(entry.from, locale)} — {text(entry.to, locale)}
          </span>
        </Card>
      ))}
    </div>
  )
}
