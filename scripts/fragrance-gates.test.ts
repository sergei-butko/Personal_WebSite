/**
 * Pins the gates that decide which post a hand-entered bottle lands on.
 * `npm run test:fragrance-gates`.
 *
 * Naming a bottle rewrites the Cloudinary public ids of a post's pictures, so
 * the expensive mistake is a mistyped id landing on a post that was already
 * right. `resolveTarget` is what refuses that, and it is pure so the rule can
 * be checked without writing to a live store.
 *
 * The fixtures are real. Every text fragment below is quoted from a post in
 * data/threads.json, and the handle forms are the reason the comparison
 * squashes punctuation at all — measured across the 96 hand-named rows, the
 * house is written as prose in fewer than four cases in five.
 *
 * This file replaces the half of `name-fragrances.test.ts` that outlived the
 * automatic naming removed on 2026-09-05; the gates it covered (`decide`,
 * `knownLines`) went with it.
 */

import { grounded, resolveTarget, squash } from './fragrance-gates'
import type { ThreadsPost } from '../src/lib/threads/types'

let failed = 0

function check(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`✓ ${label}`)
  } else {
    failed += 1
    console.error(`✗ ${label}\n    expected ${e}\n    actual   ${a}`)
  }
}

/** A post that already carries a bottle, for the overwrite cases. */
const NAMED: ThreadsPost = {
  id: 'Tom Ford-Oud Wood',
  permalink: 'https://example.invalid',
  timestamp: '2026-09-02T09:00:00.000Z',
  mediaType: 'TEXT_POST',
  text: 'Oud Wood від @tomford.',
  images: [],
  isQuotePost: false,
  fragrance: { brand: 'Tom Ford', name: 'Oud Wood', collection: 'Private Blend' },
}

function main(): void {
  // ---- squashing ----------------------------------------------------------
  check('punctuation and case go', squash('Pana Dora'), 'panadora')
  check('so do the dots in a handle', squash('@pana.dora.sweden'), 'panadorasweden')
  check('Cyrillic survives — the posts are Ukrainian', squash('Аромат'), 'аромат')

  // ---- grounding ----------------------------------------------------------
  // The house is usually a tag, not prose. This is the case that forced the
  // squash: "Tom Ford" is nowhere in this sentence as written.
  check(
    'a handle grounds the house it names',
    grounded('Tom Ford', 'Справжній фаворит багатьох – Oud Wood від @tomford.'),
    true
  )
  check(
    'a dotted handle does too',
    grounded('Pana Dora', 'аромат – Opuluxe від @pana.dora.sweden.'),
    true
  )
  check(
    'and a parenthesised qualifier does not break the scent',
    grounded('Gentle Fluidity Gold', 'з ароматом Gentle Fluidity (Gold edition).'),
    true
  )
  check(
    'an absent house is not grounded',
    grounded('Chanel', 'Oud Wood від @tomford.'),
    false
  )
  check('an empty needle grounds nothing', grounded('', 'anything at all'), false)

  // ---- resolveTarget: which post a hand-entered bottle lands on -----------
  const BOTTLE = { brand: 'Filippo Sorcinelli', scent: 'But Not Today' }

  /** A post with no bottle yet, at a given time. */
  const unnamed = (id: string, timestamp: string, text = ''): ThreadsPost => ({
    id,
    permalink: 'https://example.invalid',
    timestamp,
    mediaType: 'TEXT_POST',
    text,
    images: [],
    isQuotePost: false,
  })

  const FEED: ThreadsPost[] = [
    unnamed('older', '2026-09-01T09:00:00.000Z', 'But Not Today від @filipposorcinelli'),
    unnamed('newest', '2026-09-03T09:00:00.000Z', 'But Not Today від @filipposorcinelli'),
    NAMED, // Tom Ford — Oud Wood, already named
  ]

  check(
    'a blank id takes the NEWEST post without a bottle',
    resolveTarget(FEED, undefined, BOTTLE, false).post?.id,
    'newest'
  )
  check(
    'whitespace counts as blank, not as an id',
    resolveTarget(FEED, '   ', BOTTLE, false).post?.id,
    'newest'
  )
  check(
    'an explicit id wins over the default',
    resolveTarget(FEED, 'older', BOTTLE, false).post?.id,
    'older'
  )
  check(
    'an id nobody has is refused by name',
    resolveTarget(FEED, 'nope', BOTTLE, false).error,
    'no post has the id nope'
  )

  // The expensive mistake: landing on a post that was already right. Refused
  // by default, and the message says what is there and how to proceed.
  check(
    'an already-named post is refused unless overwrite is set',
    resolveTarget(FEED, NAMED.id, BOTTLE, false).error,
    'Tom Ford-Oud Wood already reads Tom Ford — Oud Wood · Private Blend. ' +
      'Set overwrite to replace it.'
  )
  check(
    'overwrite allows it and reports what is being replaced',
    resolveTarget(FEED, NAMED.id, BOTTLE, true).replacing,
    { brand: 'Tom Ford', name: 'Oud Wood', collection: 'Private Blend' }
  )

  check(
    'a feed with nothing left to name says so',
    resolveTarget([NAMED], undefined, BOTTLE, false).error,
    'every post already has a bottle — pass an id to replace one'
  )

  // Grounding survives as a warning only: a person outranks the check, but a
  // wrong id looks exactly like this.
  check(
    'a grounded hand edit warns about nothing',
    resolveTarget(FEED, 'newest', BOTTLE, false).ungrounded,
    undefined
  )
  check(
    'an ungrounded one warns without refusing',
    resolveTarget(FEED, 'newest', { brand: 'Chanel', scent: 'No 5' }, false).ungrounded,
    "the house and scent does not appear in this post's text"
  )

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`)
    process.exit(1)
  }
  console.log('\nAll fragrance-gate checks passed.')
}

main()
