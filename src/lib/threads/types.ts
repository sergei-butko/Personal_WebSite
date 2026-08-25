/**
 * Types for the Threads mirror.
 *
 * The API returns far more than we need, and Meta's media URLs are signed
 * and expire. We normalise at the sync boundary and re-host images in
 * Cloudinary, so the rest of the app never sees Meta's shape and never
 * depends on their CDN. If they rename a field, exactly one file changes.
 *
 * Image bytes are not in this repository — see lib/photos.ts for why.
 */

export type ThreadsMediaType =
  'TEXT_POST' | 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'AUDIO' | 'REPOST_FACADE'

export interface ThreadsImage {
  /** Cloudinary public id, e.g. "threads/17900000000000000-0". Not a URL. */
  publicId: string
  /** Intrinsic size, for aspect-ratio and CLS. */
  width: number
  height: number
  /**
   * From Meta's alt_text. Often empty — Threads does not require alt text.
   * Empty means the image is decorative-by-omission, not decorative by
   * intent, so the UI must handle it (see ThreadsPostCard).
   */
  alt: string
}

/**
 * One post as it appears on this site — NOT as it appears on Threads.
 *
 * A perfumery review is written there as a post plus one follow-up comment.
 * Here the two are a single post: the sync joins the text and concatenates the
 * images at capture time, and nothing downstream knows there were ever two
 * pieces.
 *
 * Every field below is EDITABLE. The snapshot in Cloudinary is the canonical
 * copy, not a mirror that the sync regenerates — a sync only ever appends
 * posts newer than the newest one already stored, so edits made here are never
 * overwritten. Editing `timestamp` is the one thing to avoid: it is the
 * high-water mark the next sync reads.
 */
export interface ThreadsPost {
  id: string
  /** Canonical URL on threads.com. Always link back; it is the source. */
  permalink: string
  /** ISO 8601 UTC, from the source. Doubles as the incremental-sync cursor. */
  timestamp: string
  mediaType: ThreadsMediaType
  /** Post body, with the follow-up comment already joined on. Editable. */
  text: string
  /** Post images followed by the follow-up's, in that order. Editable. */
  images: ThreadsImage[]
  isQuotePost: boolean
}

/** Shape of src/content/threads.generated.ts. */
export interface ThreadsSnapshot {
  /** When the sync last succeeded, ISO 8601. Epoch means "never". */
  syncedAt: string
  username: string
  posts: ThreadsPost[]
}

/** True when no successful sync has run yet. */
export function isUnsynced(snapshot: ThreadsSnapshot): boolean {
  return snapshot.posts.length === 0
}
