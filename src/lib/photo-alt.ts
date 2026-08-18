import type { Locale } from '@/lib/i18n'
import type { Photo, PhotoOverride } from '@/lib/photos'

/**
 * Alt text for a mirrored photo.
 *
 * The channel captions almost nothing, and unlike a Threads post there is no
 * adjacent body text carrying the meaning — the image IS the content. So
 * alt="" is never right here; an empty alt would tell a screen reader the
 * image is decorative when it is the entire point of the page.
 *
 * Order: hand-written alt, then any caption, then an honest generic label.
 * Only the last is unsatisfying, and the fix for it is an entry in
 * photo-meta.ts.
 */
export function resolveAlt(
  photo: Photo,
  override: PhotoOverride | undefined,
  locale: Locale,
  genericLabel: string
): string {
  const authored = override?.alt?.[locale]
  if (authored) return authored

  const caption = override?.caption?.[locale] ?? photo.caption
  if (caption) return caption

  return genericLabel
}

/** Visible caption, if there is one worth showing. */
export function resolveCaption(
  photo: Photo,
  override: PhotoOverride | undefined,
  locale: Locale
): string {
  return override?.caption?.[locale] ?? photo.caption
}
