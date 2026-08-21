import {
  siApplemusic,
  siFacebook,
  siGithub,
  siInstagram,
  siTelegram,
  siThreads,
  siX,
} from 'simple-icons'

/**
 * Platform identity for the links cards.
 *
 * Icon paths and hex values come from simple-icons rather than being
 * hand-copied, so they are the official marks and stay correct when the
 * package updates. This module is imported only by Server Components, so the
 * paths are inlined into the HTML at build time and the package never reaches
 * the browser.
 *
 * Two things the raw brand data cannot give us:
 *
 * 1. Several marks are near-black — X and Threads are #000000, GitHub is
 *    #181717 — harsh on a light card and invisible on a dark one. Those are
 *    softened to a dark grey / off-white pair. The rest keep their brand
 *    colour in both themes.
 * 2. LinkedIn is absent from simple-icons entirely (removed at LinkedIn's
 *    request), so anything without a mark falls back to a neutral glyph
 *    rather than breaking the layout.
 * 3. Telegram's official blue fails contrast on a light card, so it uses
 *    Telegram's darker blue instead. Every colour here is measured against
 *    the card surface it sits on, not assumed.
 */

export interface Platform {
  label: string
  /** SVG path data for a 24x24 viewBox. */
  path: string
  /** Brand colour, used for the icon and hover accents. */
  light: string
  /** Dark-theme colour — the brand colour unless it is too dark to see. */
  dark: string
}

/** A plain envelope, since email is not a brand. */
const MAIL_PATH =
  'M1.5 4.5h21v15h-21v-15Zm1.8 1.8v.4l8.7 5.8 8.7-5.8v-.4H3.3Zm17.4 3.1-8.7 5.8-8.7-5.8v8.3h17.4V9.4Z'

/**
 * Near-black marks (X #000000, Threads #000000, GitHub #181717) are harsh
 * against a light card and invisible against a dark one. They use a soft dark
 * grey in light mode and a soft off-white in dark, rather than either extreme.
 */
const SOFT_DARK = '#3F3F46'
const SOFT_LIGHT = '#E4E4E7'

const brand = (
  icon: { title: string; hex: string; path: string },
  dark?: string
): Platform => ({
  label: icon.title,
  path: icon.path,
  light: `#${icon.hex}`,
  dark: dark ?? `#${icon.hex}`,
})

export const platforms = {
  facebook: brand(siFacebook),
  x: { ...brand(siX), light: SOFT_DARK, dark: SOFT_LIGHT },
  instagram: brand(siInstagram),
  // #26A5E4 is Telegram's official blue but lands at 2.77:1 on the light
  // card — under WCAG's 3:1 for non-text graphics. #0088CC is Telegram's own
  // darker blue and clears it at 3.89:1, keeping the mark recognisable.
  telegram: { ...brand(siTelegram), light: '#0088CC' },
  threads: { ...brand(siThreads), light: SOFT_DARK, dark: SOFT_LIGHT },
  applemusic: brand(siApplemusic, '#FC5C7D'),
  github: { ...brand(siGithub), light: SOFT_DARK, dark: SOFT_LIGHT },
  email: { label: 'Email', path: MAIL_PATH, light: '#6366F1', dark: '#A5B4FC' },
} as const

export type PlatformId = keyof typeof platforms

export function isPlatformId(value: string): value is PlatformId {
  return value in platforms
}

/** Neutral fallback for a platform with no registered mark. */
export const fallbackPlatform: Platform = {
  label: 'Link',
  path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 1.8a8.2 8.2 0 1 1 0 16.4 8.2 8.2 0 0 1 0-16.4Z',
  light: '#6B6B76',
  dark: '#8F8F9C',
}

export function getPlatform(id: string | undefined): Platform {
  return id && isPlatformId(id) ? platforms[id] : fallbackPlatform
}
