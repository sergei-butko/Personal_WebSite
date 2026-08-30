import { PlatformIcon } from '@/components/links/platform-icon'

/**
 * An outlined link out to the platform a page mirrors.
 *
 * Outlined rather than filled. Filled, it was the loudest thing on a page whose
 * subject is photographs; an outline says "this leaves the site" without
 * shouting over the grid.
 *
 * ## Why the colour is a prop and not read from platforms.ts
 *
 * `getPlatform` returns colours tuned for a MARK — a 16px glyph, which only has
 * to be recognisable. Here the same colour is also 13px TEXT, which has to
 * clear 4.5:1, and the two requirements disagree for exactly the brands whose
 * identity is a bright or a near-black colour. Telegram's #2AABEE reads fine as
 * a glyph and manages 2.57:1 as text on white.
 *
 * So each caller passes a measured pair instead. Against this palette:
 *
 *     telegram   light #0077B3 → 4.90 on surface   dark #2AABEE → 5.23
 *     threads    light #3F3F46 → 9.79 on surface   dark #E4E4E7 → 10.4
 *
 * Threads' mark is #000000, which is harsh on a light card and invisible on a
 * dark one, so it uses the same softened pair platforms.ts gives its near-black
 * marks rather than the raw brand black.
 *
 * The mark inherits `currentColor`, so it tracks whichever of the two is live.
 *
 * The hover tint is `bg-chip`, a palette token, and not `bg-current/8`.
 * Tailwind compiles that to `color-mix(currentcolor 8%, transparent)` — no
 * colour space, which Chrome fills in but the spec does not require an engine
 * to. Where it is rejected the declaration is dropped and the preceding
 * fallback wins, and that fallback is a flat `currentColor` background: a solid
 * block with same-coloured text on it.
 */
export function BrandButton({
  href,
  platform,
  label,
  light,
  dark,
}: {
  href: string
  /** Key into platforms.ts, for the mark. */
  platform: string
  label: string
  /** Measured against --color-surface. Must clear 4.5:1 as 13px text. */
  light: string
  dark: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ ['--brand-fg' as string]: light, ['--brand-fg-dark' as string]: dark }}
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-current px-4 py-2 text-[13px] font-medium text-[var(--brand-fg)] transition hover:bg-chip focus-visible:bg-chip dark:text-[var(--brand-fg-dark)]"
    >
      <PlatformIcon platform={platform} className="h-4 w-4" forceColor="currentColor" />
      {label}
    </a>
  )
}
