import type { Photo } from './types'

/**
 * Grouping the flat photo snapshot back into Telegram posts.
 *
 * The snapshot is one row per image because that is what the gallery roll
 * needs and what the sync's dedup works on. A Telegram album, though, is one
 * post carrying up to ten images: every row of it shares `id` (the message
 * id), `permalink`, `timestamp` and `caption`, and differs only in `publicId`
 * and its dimensions. Checked against the live snapshot — across 235 posts,
 * no post's rows disagreed on caption or timestamp — so reading those four
 * fields off the first row of a group is sound rather than a guess.
 *
 * Pure, and importing nothing but a type, so the "by post" page can be
 * rendered from a fixture and the rule can be reasoned about without a
 * network or a Cloudinary account.
 */

export interface PhotoPost {
  /** Telegram message id — the identity of the post itself. */
  id: number
  permalink: string
  /** ISO 8601 UTC, shared by every image in the post. */
  timestamp: string
  /** The post's text as written on Telegram. Often empty. */
  caption: string
  /** In the order they appear in the post, never the order they synced in. */
  photos: Photo[]
}

/** The `-<n>` suffix of a public id, e.g. "telegram/516-7" -> 7. */
const SLOT = /-(\d+)$/

/**
 * Position within its post, from the public id.
 *
 * The public id is `telegram/<messageId>-<slot>`, and the slot is the only
 * record of running order — the snapshot carries no index field, and the
 * rows of an album all share one timestamp, so sorting by anything else would
 * shuffle a photo essay into arbitrary order.
 *
 * Returns Infinity for an id that does not parse, which sorts it to the end
 * rather than to the front. Nothing in the live snapshot fails to parse; this
 * is here so a future id scheme degrades into "last" instead of throwing.
 */
function slot(photo: Photo): number {
  const match = SLOT.exec(photo.publicId)
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY
}

/**
 * Groups photos into posts, newest post first.
 *
 * Post order follows the order photos arrive in — the snapshot is already
 * newest-first — so this never re-sorts by timestamp and cannot disagree with
 * the roll about what "recent" means. Within a post, images are ordered by
 * slot.
 */
export function groupByPost(photos: readonly Photo[]): PhotoPost[] {
  const posts = new Map<number, PhotoPost>()

  for (const photo of photos) {
    const existing = posts.get(photo.id)
    if (existing) {
      existing.photos.push(photo)
      continue
    }
    posts.set(photo.id, {
      id: photo.id,
      permalink: photo.permalink,
      timestamp: photo.timestamp,
      caption: photo.caption,
      photos: [photo],
    })
  }

  for (const post of posts.values()) {
    post.photos.sort((a, b) => slot(a) - slot(b))
  }

  return [...posts.values()]
}
