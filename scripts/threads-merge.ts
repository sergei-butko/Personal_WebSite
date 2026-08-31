/**
 * Merging freshly fetched Threads posts into the stored snapshot, kept pure so
 * it can be tested without a token, a network or a Cloudinary account.
 *
 * ## Why this is a module and not a line
 *
 * It used to be `[...stored, ...posts]`. That is correct only while every
 * caller upstream keeps its side of a bargain the merge itself never states:
 * `sync-threads.ts` filters fetched posts against the stored ids before
 * re-hosting them, so by the time they arrive here a collision "cannot happen".
 *
 * Two things are wrong with leaving it there. The invariant lives fifty lines
 * away from the code that depends on it, so a refactor that moves or loosens
 * that filter breaks this silently. And it says nothing about duplicates
 * WITHIN one fetch — cursor-based pagination can hand back the same post on
 * two pages, and nothing upstream looks for that.
 *
 * ## Stored always wins
 *
 * This is the load-bearing rule. The snapshot is canonical, not a mirror: the
 * `fragrance` block, the alt text and any edited `text` or `images` are
 * hand-written and exist nowhere else. A freshly fetched copy of a post has
 * none of them. So on a collision the stored row is kept and the fetched one
 * is dropped — the opposite choice would quietly erase the naming of a bottle
 * the first time a post came back around.
 */

import type { ThreadsPost } from '../src/lib/threads/types'

export interface MergeResult {
  /** Every post, newest first. */
  posts: ThreadsPost[]
  /**
   * Fetched posts dropped because their id was already present — either in the
   * snapshot or earlier in the same batch. Normally 0; a non-zero count means
   * an upstream filter is not doing what it used to, so the caller logs it.
   */
  collisions: number
}

/**
 * @param stored posts already in the snapshot, hand-edits included
 * @param fresh  posts normalised from this run's fetch
 */
export function mergePosts(
  stored: readonly ThreadsPost[],
  fresh: readonly ThreadsPost[]
): MergeResult {
  const byId = new Map<string, ThreadsPost>()
  for (const post of stored) byId.set(post.id, post)

  let collisions = 0
  for (const post of fresh) {
    if (byId.has(post.id)) {
      collisions++
      continue
    }
    byId.set(post.id, post)
  }

  const posts = [...byId.values()]
  // Newest first, which is the order every view renders in. Ties break on id
  // so the result is deterministic — two posts can share a timestamp to the
  // second, and an unstable order there would churn the snapshot diff.
  posts.sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id))

  return { posts, collisions }
}
