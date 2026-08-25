import type { Locale } from '@/lib/i18n'
import type { Photo } from './types'

/**
 * Alt text for a mirrored photo.
 *
 * The channel captions almost nothing, and unlike a Threads post there is no
 * adjacent body text carrying the meaning — the image IS the content. So
 * alt="" is never right here; an empty alt would tell a screen reader the
 * image is decorative when it is the entire point of the page.
 *
 * Order: written alt for this locale, then the caption, then an honest generic
 * label. Only the last is unsatisfying, and the fix for it is to write alt
 * text — which now lives on the photo itself in the editable snapshot, rather
 * than in a TypeScript file only reachable from a checkout.
 */
export function resolveAlt(photo: Photo, locale: Locale, genericLabel: string): string {
  const authored = photo.alt[locale]
  if (authored) return authored
  if (photo.caption) return photo.caption
  return genericLabel
}

/** Visible caption, if there is one worth showing. */
export function resolveCaption(photo: Photo): string {
  return photo.caption
}
