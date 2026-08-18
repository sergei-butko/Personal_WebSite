/**
 * Types for the Telegram photo mirror.
 *
 * Telegram's CDN URLs are signed and expire, so images are downloaded and
 * re-encoded at build time. Nothing here ever points at telesco.pe.
 */

export interface PhotoVariant {
  /** Path under /images/photos/, relative to the site root (no basePath). */
  src: string
  width: number
}

export interface Photo {
  /** Telegram message id. Stable, and the key for manual overrides. */
  id: number
  /** Canonical URL of the post on Telegram. */
  permalink: string
  /** ISO 8601 UTC, from the post's <time datetime>. */
  timestamp: string
  /** Caption as written, in whatever language. Often empty. */
  caption: string
  /** Largest WebP variant. */
  src: string
  webp: PhotoVariant[]
  avif: PhotoVariant[]
  width: number
  height: number
}

export interface PhotoSnapshot {
  /** When the sync last succeeded, ISO 8601. Epoch means never. */
  syncedAt: string
  /** Channel handle, without the @. */
  channel: string
  /** Newest first. */
  photos: Photo[]
}

/**
 * Per-photo overrides, edited by hand. Telegram captions arrive in one
 * language and cannot be translated automatically, and most posts have no
 * caption at all — so alt text has to come from somewhere.
 */
export interface PhotoOverride {
  /** Replaces the Telegram caption, per locale. */
  caption?: Partial<Record<'en' | 'uk', string>>
  /** Alt text, per locale. Falls back to caption, then to a generic label. */
  alt?: Partial<Record<'en' | 'uk', string>>
  /** Keep this one out of the gallery entirely. */
  hidden?: boolean
}

export function isUnsynced(snapshot: PhotoSnapshot): boolean {
  return snapshot.photos.length === 0
}
