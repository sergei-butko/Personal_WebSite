/**
 * Merging freshly re-hosted photos into the stored snapshot, kept pure so it
 * can be tested without a network or a Cloudinary account. The Threads
 * equivalent is `threads-merge.ts`; this one is NOT the same rule, and the
 * differences are the whole reason it is its own file.
 *
 * ## A photo row is not identified by its post
 *
 * One Telegram message is an album, and an album is many rows — up to ten in
 * this channel — all sharing an `id` and a `timestamp`. So `id` cannot be the
 * key the way a Threads post id can.
 *
 * ## Nor by its asset
 *
 * `publicId` is unique across all 443 rows today, and keying on it would still
 * be wrong. Deduplication is by sha256 of the bytes, so a photo posted twice to
 * the channel is stored ONCE and the second row points at the first row's
 * asset — two different posts, legitimately sharing one `publicId`. Collapsing
 * on that would silently delete a photo from an album.
 *
 * The identity is the PAIR. One row per (post, asset): the same asset in two
 * different albums is two rows, and the same asset twice in one album is one.
 *
 * ## Why this matters more than it looks
 *
 * `sync-telegram.ts` skips a photo whose DERIVED id — `telegram/images/<post>-<slot>`
 * — is already stored. A deduplicated row does not carry its derived id; it
 * carries the id of the asset it was folded onto. So the guard cannot see it,
 * and the only thing stopping that row being appended a second time is the
 * cursor happening never to revisit its post. That is a real invariant held in
 * an entirely different part of the file. Here it is local: a row already
 * present is not added again, whatever route it took.
 */

import type { Photo } from '../src/lib/photos/types'

export interface PhotoMergeResult {
  /** Every row, newest post first, album order preserved within a post. */
  photos: Photo[]
  /** Fresh rows dropped because that (post, asset) pair was already present. */
  collisions: number
}

/** One row per post-and-asset. */
function key(photo: Photo): string {
  return `${photo.id}:${photo.publicId}`
}

/**
 * @param stored rows already in the snapshot, hand-edits and songs included
 * @param fresh  rows built from this run's re-hosting
 */
export function mergePhotos(
  stored: readonly Photo[],
  fresh: readonly Photo[]
): PhotoMergeResult {
  const byKey = new Map<string, Photo>()
  for (const photo of stored) byKey.set(key(photo), photo)

  let collisions = 0
  for (const photo of fresh) {
    if (byKey.has(key(photo))) {
      collisions++
      continue
    }
    byKey.set(key(photo), photo)
  }

  const photos = [...byKey.values()]

  /*
   * Newest post first, and NOTHING breaks the tie within a post.
   *
   * Every row of an album shares both a timestamp and an id, so this
   * comparator returns 0 for them and Array#sort — stable since ES2019 —
   * leaves them in the order they were inserted, which is slot order. That is
   * load-bearing: a tie-break on `publicId` would look tidier and would sort
   * `<post>-10` between `<post>-1` and `<post>-2`, scrambling any album with
   * more than ten photos into a plausible-looking wrong order.
   *
   * The id tie-break is not decoration either — one timestamp in this channel
   * is shared by two different posts, so without it their relative order would
   * depend on the input.
   *
   * ## The precondition, stated rather than assumed
   *
   * Relying on stability means relying on the input: album rows must arrive
   * contiguous and in slot order, and an album must be wholly in `stored` or
   * wholly in `fresh`. A HALF-FRESH album would come out with its stored rows
   * before its fresh ones — every photo present, in the wrong order.
   *
   * A sync cannot produce that. Every row of a post carries the post's
   * timestamp (checked: 0 of 235 posts in this channel have rows disagreeing
   * about it) and the cursor filters whole posts by that timestamp, so a post
   * is entirely new or entirely old. `stored` is the previous snapshot, whose
   * albums are contiguous, and `fresh` is built by iterating each new post's
   * images in order.
   *
   * This is written down because a replay of the live snapshot split at an
   * arbitrary row DOES trip it, and that looked like a bug for a few minutes.
   * It is not one; it is an input a sync cannot hand over.
   */
  photos.sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id - a.id)

  return { photos, collisions }
}
