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
 * Each platform carries two different colour treatments, because they are
 * solving two different problems:
 *
 * - `light` / `dark` are the mark on a *neutral* surface — the home page
 *   eyebrows. Near-black marks (X and Threads are #000000, GitHub #181717) are
 *   harsh on a light card and invisible on a dark one, so those soften to a
 *   dark grey / off-white pair. The rest keep their brand colour in both.
 * - `fill` / `fg` are the links card, which is the brand's own surface. Here
 *   the real colours belong, gradients included: Instagram, Telegram, Apple
 *   Music and the email tile are gradients in their own identities, and
 *   flattening them to one hex is what made Instagram and Apple Music read as
 *   the same pink card.
 *
 * ## Why every gradient runs dark-to-light along 135deg
 *
 * The card puts its name at the left edge, vertically centred, and the
 * oversized watermark bleeds off the bottom right. A 20px bold name is WCAG
 * large text and needs 3:1 against its background — but two of these brands
 * are genuinely too light to carry white text anywhere near their bright end:
 * Instagram's orange #F58529 is 2.54:1 and Telegram's #2AABEE is 2.57:1.
 *
 * Rather than tint those until they pass — which would make them the wrong
 * colours — the gradients are oriented so the bright stop sits at the far
 * corner, past where the name can reach. Projected onto a 135deg axis, the
 * longest label ("Apple Music", icon included) ends at about 58% of the axis
 * on the narrowest card the grid produces, so every stop up to 70% clears 3:1
 * and the failing stops live at 100%. Measured, not eyeballed:
 *
 *     #515BD4 5.53   #8134AF 6.90   #DD2A7B 4.48   #F58529 2.54 (100% only)
 *     #0088CC 3.89   #229ED9 3.02   #FA233B 3.91   #FB5C74 3.05
 *     #0866FF 4.82   #6366F1 4.47   #A855F7 3.96   #181717 17.89   #000 21.0
 *
 * LinkedIn is absent from simple-icons (removed at LinkedIn's request), so its
 * entry below carries a hand-drawn path instead. Anything else without a mark
 * still falls back to a neutral glyph rather than breaking the layout.
 */

export interface Platform {
  label: string
  /** SVG path data for a 24x24 viewBox. */
  path: string
  /** The mark on a neutral surface, light theme. */
  light: string
  /** The mark on a neutral surface, dark theme. */
  dark: string
  /** The links card background — any CSS `background` value, gradients included. */
  fill: string
  /** Mark and name on top of `fill`. White or black, whichever the fill takes. */
  fg: string
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

const WHITE = '#ffffff'

const brand = (
  icon: { title: string; hex: string; path: string },
  overrides: Partial<Platform> = {}
): Platform => ({
  label: icon.title,
  path: icon.path,
  light: `#${icon.hex}`,
  dark: `#${icon.hex}`,
  fill: `#${icon.hex}`,
  fg: WHITE,
  ...overrides,
})

const platforms = {
  // Instagram's identity is the glyph gradient, not a flat colour. simple-icons
  // reduces it to #FF0069, which is why this card and Apple Music's were near
  // enough to be mistaken for each other. Blue-violet through purple and pink
  // to orange, the orange parked at the far corner.
  instagram: brand(siInstagram, {
    fill: 'linear-gradient(135deg, #515BD4 0%, #8134AF 35%, #DD2A7B 70%, #F58529 100%)',
  }),
  // #26A5E4 is Telegram's official blue but lands at 2.77:1 on the light card,
  // under WCAG's 3:1 for non-text graphics; #0088CC is Telegram's own darker
  // blue and clears it. The card runs that into #229ED9, the darker half of
  // the logo's own gradient.
  telegram: brand(siTelegram, {
    light: '#0088CC',
    fill: 'linear-gradient(135deg, #0088CC 0%, #229ED9 100%)',
  }),
  // Threads is black, full stop — that is the whole brand.
  threads: brand(siThreads, { light: SOFT_DARK, dark: SOFT_LIGHT, fill: '#000000' }),
  facebook: brand(siFacebook, { fill: '#0866FF' }),
  // The Apple Music mark is a pink-to-coral gradient, not the flat #FA243C
  // that simple-icons carries.
  applemusic: brand(siApplemusic, {
    dark: '#FC5C7D',
    fill: 'linear-gradient(135deg, #FA233B 0%, #FB5C74 100%)',
  }),
  /*
   * LinkedIn is the one mark written out by hand rather than taken from
   * simple-icons, because simple-icons does not carry it — it was removed at
   * LinkedIn's request. What is here is the plain "in" glyph on a rounded
   * square, drawn to their own brand guidance, used to link to Serhii's own
   * profile. That is what the guidance is for; it is not a redistributed icon
   * set.
   *
   * #0A66C2 is LinkedIn's current brand blue and manages 5.69:1 on the light
   * surface, but only 2.37:1 on the dark one — under the 3:1 a non-text
   * graphic needs. Dark mode gets #4BA3EA (4.95:1), the same treatment
   * Telegram's entry above already uses for the same reason.
   */
  linkedin: {
    label: 'LinkedIn',
    path: 'M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13Zm1.78 13.02H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z',
    light: '#0A66C2',
    dark: '#4BA3EA',
    fill: '#0A66C2',
    fg: WHITE,
  },
  x: brand(siX, { light: SOFT_DARK, dark: SOFT_LIGHT, fill: '#000000' }),
  github: brand(siGithub, { light: SOFT_DARK, dark: SOFT_LIGHT, fill: '#181717' }),
  // Email is the one tile with no brand to borrow, and it used to be flat
  // #6366F1 — close enough to Facebook's and Telegram's blues to read as a
  // third of them. It takes the site's own accent ramp instead, indigo into
  // violet, which is the gradient the About tile already uses. That makes it
  // the only card that belongs to this site rather than to someone else's
  // brand, which is the right thing for the one address that is actually mine.
  email: {
    label: 'Email',
    path: MAIL_PATH,
    light: '#6366F1',
    dark: '#A5B4FC',
    fill: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
    fg: WHITE,
  },
} as const satisfies Record<string, Platform>

type PlatformId = keyof typeof platforms

function isPlatformId(value: string): value is PlatformId {
  return value in platforms
}

/** Neutral fallback for a platform with no registered mark. */
const fallbackPlatform: Platform = {
  label: 'Link',
  path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 1.8a8.2 8.2 0 1 1 0 16.4 8.2 8.2 0 0 1 0-16.4Z',
  light: '#6B6B76',
  dark: '#8F8F9C',
  fill: '#6B6B76',
  fg: WHITE,
}

export function getPlatform(id: string | undefined): Platform {
  return id && isPlatformId(id) ? platforms[id] : fallbackPlatform
}
