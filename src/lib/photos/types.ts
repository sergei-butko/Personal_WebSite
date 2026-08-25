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

/**
 * One photo as it appears on this site.
 *
 * Every field below is EDITABLE. The snapshot in Cloudinary is the canonical
 * copy, not a mirror the sync regenerates — a sync only appends photos newer
 * than the newest one already stored, so edits survive. Editing `timestamp`
 * is the one thing to avoid: it is the high-water mark the next sync reads.
 *
 * These fields replace the old content/photo-meta.ts overrides, which lived in
 * the code and so could not be edited anywhere but an editor with a checkout.
 */
export interface Photo {
  /** Telegram message id. Several photos of one post share it. */
  id: number
  /** Canonical URL of the post on Telegram. */
  permalink: string
  /** ISO 8601 UTC. Doubles as the incremental-sync cursor. */
  timestamp: string
  /** Caption as posted, in whatever language. Often empty. Editable. */
  caption: string
  /**
   * Alt text per locale. Empty until written.
   *
   * This matters more here than anywhere else on the site: the channel
   * captions almost nothing and, unlike a Threads post, there is no adjacent
   * body text carrying the meaning — the image IS the content.
   */
  alt: Partial<Record<'en' | 'uk', string>>
  /** Keep this one out of the gallery without deleting it. */
  hidden?: boolean
  /** Cloudinary public id, e.g. "telegram/571-0". Not a URL, not a path. */
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

export function isUnsynced(snapshot: PhotoSnapshot): boolean {
  return snapshot.photos.length === 0
}
