import { ViewSwitch, type ViewTab } from '@/components/ui/view-switch'
import { BrandButton } from '@/components/ui/brand-button'

/**
 * Threads' mark is #000000, which is harsh on a light card and invisible on a
 * dark one. These are the softened pair `platforms.ts` already uses for its
 * near-black marks, and as 13px text they measure 9.79:1 on the light surface
 * and 10.4:1 on the dark one — comfortably past the 4.5:1 the outlined button
 * needs, since there the colour IS the text rather than a background behind it.
 */
const THREADS_FG = '#3F3F46'
const THREADS_FG_DARK = '#E4E4E7'

/**
 * The one row the perfumery pages open with: views on the left, the way out on
 * the right.
 *
 * No heading and no standfirst, for the same reason the photos page has none —
 * a large word above a grid of the thing it names only pushes the grid down.
 * The h1 survives as screen-reader-only: deleting it outright would leave the
 * page with no heading at all, which breaks heading-based navigation and is a
 * real loss rather than a cosmetic one.
 */
export function PerfumeryHeader({
  title,
  tabs,
  current,
  threadsHref,
  viewOnThreads,
}: {
  title: string
  tabs: ViewTab[]
  current: string
  threadsHref: string
  viewOnThreads: string
}) {
  return (
    <>
      <h1 className="sr-only">{title}</h1>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <ViewSwitch tabs={tabs} current={current} />
        <BrandButton
          href={threadsHref}
          platform="threads"
          label={viewOnThreads}
          light={THREADS_FG}
          dark={THREADS_FG_DARK}
        />
      </div>
    </>
  )
}
