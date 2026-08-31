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
  /**
   * Cloudinary public id, e.g. "threads/images/Tom_Ford-Oud_Wood-1". Not a URL.
   *
   * The sync writes "threads/images/<postId>-<slot>" — the fragrance below is
   * hand-written and does not exist yet at capture time — and
   * `npm run media:organise` renames it after the bottle once one is named.
   * A post with no bottle keeps the id-shaped form.
   */
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
 * The bottle a post is about.
 *
 * Hand-written, always. Threads has no such field and never will — the API
 * returns a body of text, and which fragrance it reviews is a judgement only a
 * reader makes. So this is absent on everything the sync captures and is filled
 * in through `npm run content:pull` / `content:push`, like alt text on a photo.
 *
 * Absent is a normal state, not a gap to be filled before shipping: a post with
 * no bottle named renders as its picture alone.
 */
export interface Fragrance {
  /** House or brand, e.g. "Guerlain". */
  brand: string
  /** The scent, e.g. "Vetiver". */
  name: string
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
 * posts newer than the snapshot's `syncedThrough`, so edits made here are never
 * overwritten — and a post deleted by hand stays deleted, because that cursor
 * does not depend on what the posts array still contains.
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
  /** The bottle, written by hand. Absent until someone names it. */
  fragrance?: Fragrance
}

export interface ThreadsSnapshot {
  /** When the sync last succeeded, ISO 8601. Epoch means "never". */
  syncedAt: string
  username: string
  /**
   * The newest post timestamp the sync has EVER seen. Monotonic: it only moves
   * forward, and nothing in the posts array can move it back.
   *
   * This exists so a post can be deleted by hand and stay deleted. The cursor
   * used to be derived — the newest timestamp among stored posts — which made
   * curating the archive quietly destructive in one specific case: deleting the
   * most recent post lowered the cursor, so the next sync considered that post
   * new again and re-imported it. Deleting an old post already worked; the
   * newest one silently came back.
   *
   * Absent on a snapshot written before this field existed, in which case the
   * sync falls back to deriving it and writes it out for next time.
   *
   * Do not edit this by hand, and do not lower it. It is the one field in the
   * file that is machinery rather than content.
   */
  syncedThrough?: string
  posts: ThreadsPost[]
}

/** True when no successful sync has run yet. */
export function isUnsynced(snapshot: ThreadsSnapshot): boolean {
  return snapshot.posts.length === 0
}
