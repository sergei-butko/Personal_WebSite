import { PlatformIcon } from '@/components/links/platform-icon'

/**
 * "View on Telegram" — the way out to the channel itself.
 *
 * Outlined rather than filled. Filled, it was the loudest thing on a page whose
 * subject is photographs, and it sat next to the view switch competing with it;
 * an outline says "this leaves the site" without shouting over the grid.
 *
 * ## The colour is not Telegram's headline blue, and that is deliberate
 *
 * Filled, the blue was a background and the text on it was white — the text
 * carried the contrast. Outlined, the blue IS the text, and it has to clear
 * 4.5:1 on its own. Telegram's #2AABEE manages 2.57:1 on white and #229ED9 only
 * 3.02:1, so both fail as 13px text. Measured against this palette:
 *
 *     light  #0077B3 → 4.90 on surface, 4.74 on canvas
 *     dark   #2AABEE → 5.23 on surface, 6.00 on canvas
 *
 * So light mode gets a darkened Telegram blue and dark mode gets Telegram's
 * actual brand blue, which is legible there precisely because the ground is
 * dark. Same trick platforms.ts uses for near-black marks, same reason.
 *
 * The mark inherits `currentColor`, so it tracks whichever of the two is live.
 *
 * The hover tint is `bg-chip`, a palette token, and not `bg-current/8`. Tailwind
 * compiles that to `color-mix(currentcolor 8%, transparent)` — no colour space,
 * which Chrome fills in but the spec does not require an engine to. Where it is
 * rejected the declaration is dropped and the preceding fallback wins, and that
 * fallback is a flat `currentColor` background: a solid Telegram-blue block with
 * Telegram-blue text on it. A neutral token cannot fail that way, and it is what
 * the density buttons already use.
 */
export function ChannelButton({ channel, label }: { channel: string; label: string }) {
  return (
    <a
      href={`https://t.me/${channel}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ ['--tg' as string]: '#0077B3', ['--tg-dark' as string]: '#2AABEE' }}
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-current px-4 py-2 text-[13px] font-medium text-[var(--tg)] transition hover:bg-chip focus-visible:bg-chip dark:text-[var(--tg-dark)]"
    >
      <PlatformIcon platform="telegram" className="h-4 w-4" forceColor="currentColor" />
      {label}
    </a>
  )
}
