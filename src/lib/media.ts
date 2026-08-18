/**
 * Externally-hosted media.
 *
 * Images live in Cloudinary, not in git. Everything that builds a media URL
 * goes through here, so swapping provider later — to R2, or back to local
 * files — is one module rather than a search across components.
 *
 * Cloudinary does the resizing and format negotiation on its own CDN, which
 * is why there is no sharp pipeline for uploaded content: `f_auto` serves
 * AVIF to browsers that take it and WebP to the rest, and `q_auto` picks a
 * quality per image rather than a blanket number.
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD ?? ''

export interface MediaImage {
  /** Cloudinary public id, e.g. "photos/kyiv-morning". Not a URL. */
  publicId: string
  /** Intrinsic size, stored so the browser can reserve space before loading. */
  width: number
  height: number
  alt?: Partial<Record<'en' | 'uk', string>>
}

/** Widths generated for srcset. Cloudinary makes these on demand. */
export const MEDIA_WIDTHS = [400, 800, 1200, 1600] as const

export function isConfigured(): boolean {
  return CLOUD_NAME.length > 0
}

/**
 * A delivery URL at a given width. Returns an empty string when Cloudinary is
 * not configured, so a missing env var shows as a broken image locally rather
 * than a URL pointing at "undefined" in production.
 */
export function mediaUrl(publicId: string, width: number): string {
  if (!CLOUD_NAME) return ''
  const transform = `f_auto,q_auto,c_limit,w_${width}`
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${publicId}`
}

export function mediaSrcSet(publicId: string, intrinsicWidth: number): string {
  return MEDIA_WIDTHS.filter((w) => w <= intrinsicWidth)
    .map((w) => `${mediaUrl(publicId, w)} ${w}w`)
    .join(', ')
}

/** Largest sensible single URL, for the src attribute and OG images. */
export function mediaSrc(image: MediaImage): string {
  const widest =
    [...MEDIA_WIDTHS].reverse().find((w) => w <= image.width) ?? MEDIA_WIDTHS[0]
  return mediaUrl(image.publicId, widest)
}
