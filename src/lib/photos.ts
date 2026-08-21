/**
 * Types for the Telegram photo mirror.
 *
 * Telegram's CDN URLs are signed and expire, so nothing here ever points at
 * telesco.pe. The sync re-hosts each photo in Cloudinary and stores only its
 * public id; delivery URLs are built at render time by lib/media.ts.
 *
 * Image bytes are deliberately NOT in this repository. An earlier version
 * downloaded and re-encoded every photo into public/images/photos/, keyed on a
 * hash of the signed Telegram URL — which rotates on every fetch, so the cache
 * never hit and each run left another full copy behind. The public id below is
 * derived from the Telegram message id and slot instead: stable across runs,
 * so a re-sync overwrites in place rather than accumulating.
 */

export interface Photo {
  /** Telegram message id. Stable, and the key for manual overrides. */
  id: number
  /** Canonical URL of the post on Telegram. */
  permalink: string
  /** ISO 8601 UTC, from the post's <time datetime>. */
  timestamp: string
  /** Caption as written, in whatever language. Often empty. */
  caption: string
  /** Cloudinary public id, e.g. "telegram/571-0". Not a URL, and not a path. */
  publicId: string
  /** Intrinsic size, so the grid can reserve space before the image loads. */
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
