/**
 * Types for the Threads mirror.
 *
 * The API returns far more than we need, and Meta's media URLs are signed
 * and expire. We normalise at the sync boundary and download images locally,
 * so the rest of the app never sees Meta's shape and never depends on their
 * CDN. If they rename a field, exactly one file changes.
 */

export type ThreadsMediaType =
  'TEXT_POST' | 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'AUDIO' | 'REPOST_FACADE'

export interface ThreadsImageVariant {
  /** Path under /images/threads/, relative to the site root (no basePath). */
  src: string
  width: number
}

export interface ThreadsImage {
  /** Largest WebP variant — the src attribute. */
  src: string
  /** Smaller WebP variants for srcset. */
  webp: ThreadsImageVariant[]
  /** Matching AVIF variants, served first via <picture>. */
  avif: ThreadsImageVariant[]
  /** Intrinsic size of the largest variant, for aspect-ratio and CLS. */
  width: number
  height: number
  /**
   * From Meta's alt_text. Often empty — Threads does not require alt text.
   * Empty means the image is decorative-by-omission, not decorative by
   * intent, so the UI must handle it (see ThreadsPostCard).
   */
  alt: string
}

export interface ThreadsPost {
  id: string
  /** Canonical URL on threads.com. Always link back; it is the source. */
  permalink: string
  /** ISO 8601 UTC. */
  timestamp: string
  mediaType: ThreadsMediaType
  /** Post body. Empty for image-only posts. */
  text: string
  images: ThreadsImage[]
  isQuotePost: boolean
  hasReplies: boolean
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
