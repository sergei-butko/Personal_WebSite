/**
 * The gates that decide which post a hand-entered bottle lands on.
 *
 * Pure, and separate from `set-fragrance.ts` for the reason
 * `telegram-parse.ts` is separate from the sync that uses it: the runner talks
 * to Cloudinary, and a rule that can only be exercised by writing to a live
 * store is a rule nobody exercises. Everything here is a function of its
 * arguments, and `npm run test:fragrance-gates` runs it directly.
 *
 * ## What these gates are for
 *
 * A wrong bottle is expensive: `fragrance` names the shelf a post files under,
 * the card's title, and — through `media:organise` — the public ids of its
 * pictures, so a wrong house renames Cloudinary assets, changes their delivery
 * URLs, and needs a second rename plus a deploy to undo. An absent fragrance
 * costs nothing; the post renders as its picture alone, which the site has
 * always supported. So the expensive mistake is a mistyped id landing on a
 * post that was already right, and `resolveTarget` refuses that by default.
 *
 * ## Why grounding is only a warning here
 *
 * Across the 96 posts named by hand, the HOUSE and the SCENT appear in the
 * post 88 and 93 times out of 96 — but the house is usually an @handle rather
 * than prose (`@tomford`, `@pana.dora.sweden`), which is why the comparison
 * squashes punctuation before checking containment. Eight of those rows would
 * fail the check outright, so a person saying what a bottle is outranks it:
 * `resolveTarget` reports `ungrounded` and writes anyway. Its real job is to
 * flag the shape a wrong id makes.
 *
 * This file once also held `decide()` and `knownLines()`, the gates that let a
 * model write to the store. The automatic naming they guarded was removed on
 * 2026-09-05; git history has them if it ever comes back.
 */

import type { ThreadsPost } from '../src/lib/threads/types'

/** Punctuation-insensitive containment: "@pana.dora.sweden" holds "Pana Dora". */
export function squash(value: string): string {
  return value.toLowerCase().replace(/[^0-9a-zЀ-ӿ]/g, '')
}

export function grounded(needle: string, haystack: string): boolean {
  const n = squash(needle)
  return n.length > 0 && squash(haystack).includes(n)
}

/** A bottle as someone typed it, before it is known to be usable. */
export interface BottleInput {
  brand: string
  scent: string
  collection?: string
}

export interface Target {
  /** The post to write to, or null when nothing usable was found. */
  post: ThreadsPost | null
  /** Why not, when post is null. */
  error?: string
  /** What is already on that post, when this call would replace it. */
  replacing?: { brand: string; name: string; collection?: string }
  /**
   * The house or the scent is not in the post's text. Not fatal — a person
   * saying what a bottle is outranks anything this file can check, and 8 of
   * the 96 rows named by hand would fail it — but it is the shape a wrong
   * post id makes, so the caller prints it prominently.
   */
  ungrounded?: string
}

/**
 * Which post a hand-entered bottle belongs to.
 *
 * The default — newest post with no bottle — is the case worth optimising:
 * the daily sync lands a post, and the thing Serhii wants to name is almost
 * always that one. Naming it should not start with hunting for an id.
 *
 * Replacing an existing bottle needs `overwrite`, because the expensive
 * mistake here is a mistyped id landing on a post that was already right:
 * `fragrance` drives the Cloudinary public ids of the post's pictures, so a
 * wrong write renames real assets and costs a second rename and a second
 * deploy to undo. Refusing by default makes that a message rather than an
 * incident.
 */
export function resolveTarget(
  posts: ThreadsPost[],
  wantedId: string | undefined,
  bottle: BottleInput,
  overwrite: boolean
): Target {
  const id = wantedId?.trim()

  let post: ThreadsPost | undefined
  if (id) {
    post = posts.find((p) => p.id === id)
    if (!post) return { post: null, error: `no post has the id ${id}` }
  } else {
    // Newest first, so "the one that just arrived" is what a blank id means.
    post = [...posts]
      .filter((p) => !p.fragrance)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
    if (!post) {
      return {
        post: null,
        error: 'every post already has a bottle — pass an id to replace one',
      }
    }
  }

  if (post.fragrance && !overwrite) {
    const f = post.fragrance
    const has = `${f.brand} — ${f.name}${f.collection ? ` · ${f.collection}` : ''}`
    return {
      post: null,
      error: `${post.id} already reads ${has}. Set overwrite to replace it.`,
    }
  }

  const houseOk = grounded(bottle.brand, post.text)
  const scentOk = grounded(bottle.scent, post.text)
  const missing = [!houseOk && 'house', !scentOk && 'scent'].filter(Boolean).join(' and ')

  return {
    post,
    replacing: post.fragrance,
    ungrounded: missing
      ? `the ${missing} does not appear in this post's text`
      : undefined,
  }
}
