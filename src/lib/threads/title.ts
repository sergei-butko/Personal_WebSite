import type { Fragrance } from './types'

/**
 * A post's title: `Brand - Scent`.
 *
 * One function rather than the same template literal in the card and again in
 * the dialog, because the two are read side by side — a card opens into the
 * dialog it came from, and a separator that disagreed between them would look
 * like two different records of the same bottle.
 *
 * Returns '' when the bottle has not been named, which is a real state: the
 * field is hand-written and a post can arrive before anyone fills it in. The
 * callers fall back to the post's own text.
 */
export function fragranceTitle(fragrance: Fragrance | undefined): string {
  if (!fragrance) return ''
  const parts = [fragrance.brand.trim(), fragrance.name.trim()].filter(Boolean)
  return parts.join(' - ')
}
