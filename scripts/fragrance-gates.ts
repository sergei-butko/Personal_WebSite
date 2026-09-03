/**
 * The gates that decide what a model may write to the Threads store.
 *
 * Pure, and separate from `name-fragrances.ts` for the reason
 * `telegram-parse.ts` is separate from the sync that uses it: the runner talks
 * to Cloudinary and to the Claude API, and a rule that can only be exercised by
 * spending money on both is a rule nobody exercises. Everything here is a
 * function of its arguments, and `npm run test:threads-name` runs it directly.
 *
 * ## What these gates are for
 *
 * `name-fragrances.ts` lets a model fill in the bottle a Threads post reviews.
 * A wrong bottle is expensive: `fragrance` names the shelf a post files under,
 * the card's title, and — through `media:organise` — the public ids of its
 * pictures, so a wrong house renames Cloudinary assets, changes their delivery
 * URLs, and needs a second rename plus a deploy to undo. An absent fragrance
 * costs nothing; the post renders as its picture alone, which the site has
 * always supported.
 *
 * So the rule is: propose freely, write only what can be corroborated, report
 * the rest.
 *
 * ## The measurements behind them
 *
 * Across the 96 posts named by hand before this existed:
 *
 * - The HOUSE and the SCENT appear in the post 88 and 93 times out of 96 — but
 *   the house is usually an @handle rather than prose (`@tomford`,
 *   `@pana.dora.sweden`), which is why the comparison squashes punctuation
 *   before checking containment.
 *
 * - The LINE is a different problem. Of the 39 rows that carry one, only 6 name
 *   it in the text. `UNUM`, `Private Blend`, `Les Exclusifs` are facts about a
 *   house, not about a post, so nothing in the prose can confirm them — and a
 *   line is written only when the store already records it for that house. The
 *   first bottle from a new line is left for Serhii, with the suggestion
 *   printed. That is the reasoning he used by hand on 2026-09-03: `But Not
 *   Today` was filed under UNUM because the two posts before it were.
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

/** The lines this store already records for a house, lowercased for matching. */
export function knownLines(posts: ThreadsPost[]): Map<string, Map<string, string>> {
  const byHouse = new Map<string, Map<string, string>>()
  for (const post of posts) {
    const f = post.fragrance
    if (!f?.collection) continue
    const house = f.brand.toLowerCase()
    const lines = byHouse.get(house) ?? new Map<string, string>()
    // Keyed lowercase, valued as written, so the spelling already in the store
    // is the one that gets reused rather than the model's capitalisation.
    lines.set(f.collection.toLowerCase(), f.collection)
    byHouse.set(house, lines)
  }
  return byHouse
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

export interface Decision {
  /** The row to write, or null when the gates held it back. */
  fragrance: { brand: string; name: string; collection?: string } | null
  /** Why it was held, for the report. */
  held?: string
  /** A line the model offered that the store could not corroborate. */
  unconfirmedLine?: string
}

/**
 * The two gates, and nothing else — no network, no I/O.
 *
 * The whole safety argument for letting a model write to the canonical store
 * lives in this function.
 */
export function decide(
  proposal: { brand: string; name: string; collection?: string | null },
  text: string,
  lines: Map<string, Map<string, string>>
): Decision {
  const houseOk = grounded(proposal.brand, text)
  const scentOk = grounded(proposal.name, text)

  // Dropped whole, not trimmed: if the model reached past the text for the
  // house, its scent is not evidence of anything either.
  if (!houseOk || !scentOk) {
    const missing = [!houseOk && 'house', !scentOk && 'scent']
      .filter(Boolean)
      .join(' and ')
    return { fragrance: null, held: `${missing} not found in the text` }
  }

  if (!proposal.collection) {
    return { fragrance: { brand: proposal.brand, name: proposal.name } }
  }

  const known = lines
    .get(proposal.brand.toLowerCase())
    ?.get(proposal.collection.toLowerCase())

  // The spelling already in the store wins over the model's capitalisation.
  if (known) {
    return {
      fragrance: { brand: proposal.brand, name: proposal.name, collection: known },
    }
  }

  return {
    fragrance: { brand: proposal.brand, name: proposal.name },
    unconfirmedLine: proposal.collection,
  }
}
