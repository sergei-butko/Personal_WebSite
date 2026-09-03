/**
 * Pins the gates that decide what a model is allowed to write to the store.
 * `npm run test:threads-name`.
 *
 * `name-fragrances.ts` lets Claude fill in the bottle a Threads post is about,
 * and the whole argument for letting it near the canonical store is these two
 * gates: the house and the scent must appear in the post, and a house line is
 * written only when the store already records it for that house. Everything
 * else is a report.
 *
 * That argument has to be checkable without spending money on the API, or it
 * is an argument nobody ever checks. `decide()` is pure for exactly that
 * reason, and this is what runs against it.
 *
 * The fixtures are real. Every text fragment below is quoted from a post in
 * data/threads.json, and the handle forms are the reason the comparison
 * squashes punctuation at all — measured across the 96 hand-named rows, the
 * house is written as prose in fewer than four cases in five.
 */

import { decide, grounded, knownLines, resolveTarget, squash } from './fragrance-gates'
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

/** Enough of a post for `knownLines`; the rest of the shape is irrelevant here. */
function post(brand: string, name: string, collection?: string): ThreadsPost {
  return {
    id: `${brand}-${name}`,
    permalink: 'https://example.invalid',
    timestamp: '2026-01-01T00:00:00.000Z',
    mediaType: 'TEXT_POST',
    text: '',
    images: [],
    isQuotePost: false,
    fragrance: { brand, name, ...(collection ? { collection } : {}) },
  }
}

/** Already named, and the post an overwrite has to be deliberate about. */
const NAMED = post('Tom Ford', 'Oud Wood', 'Private Blend')

const STORE = [
  post('Filippo Sorcinelli', 'LAVS', 'UNUM'),
  post('Filippo Sorcinelli', 'Reliqvia', 'UNUM'),
  NAMED,
  post('Pana Dora', 'Opuluxe'),
]

const LINES = knownLines(STORE)

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

  // ---- gate one: the house and the scent must be in the post --------------
  const text = 'аромат металу і крові – But Not Today від @filipposorcinelli.'

  check(
    'a grounded proposal is written',
    decide(
      { brand: 'Filippo Sorcinelli', name: 'But Not Today', collection: null },
      text,
      LINES
    ),
    { fragrance: { brand: 'Filippo Sorcinelli', name: 'But Not Today' } }
  )

  // The failure this gate exists for: a plausible house that the post never
  // names. Writing it would rename two Cloudinary assets after the wrong
  // bottle and change their delivery URLs.
  check(
    'an ungrounded house holds the whole row',
    decide({ brand: 'Chanel', name: 'But Not Today', collection: null }, text, LINES),
    { fragrance: null, held: 'house not found in the text' }
  )
  check(
    'an ungrounded scent holds it too',
    decide(
      { brand: 'Filippo Sorcinelli', name: 'Bergamot', collection: null },
      text,
      LINES
    ),
    { fragrance: null, held: 'scent not found in the text' }
  )
  // Dropped whole rather than trimmed: a model that reached past the text for
  // one field has not earned the other.
  check(
    'both missing names both',
    decide({ brand: 'Chanel', name: 'No 5', collection: null }, text, LINES),
    { fragrance: null, held: 'house and scent not found in the text' }
  )

  // ---- gate two: a line needs corroboration from the store ----------------
  // The case from 2026-09-03. UNUM is nowhere in the post; it is written only
  // because the two Filippo Sorcinelli posts before it carry it.
  check(
    'a line the store already knows is written',
    decide(
      { brand: 'Filippo Sorcinelli', name: 'But Not Today', collection: 'UNUM' },
      text,
      LINES
    ),
    {
      fragrance: {
        brand: 'Filippo Sorcinelli',
        name: 'But Not Today',
        collection: 'UNUM',
      },
    }
  )
  check(
    'and it is matched case-insensitively, but written as the store spells it',
    decide(
      { brand: 'filippo sorcinelli', name: 'But Not Today', collection: 'unum' },
      text,
      LINES
    ),
    {
      fragrance: {
        brand: 'filippo sorcinelli',
        name: 'But Not Today',
        collection: 'UNUM',
      },
    }
  )

  // A line the store has never seen is the model's recall alone. Of the 39
  // hand-named rows carrying a line, only 6 state it in the post — so there is
  // nothing in the text to check it against, and absent is a supported state.
  check(
    'an unknown line is dropped, the bottle is still written, the suggestion survives',
    decide(
      { brand: 'Filippo Sorcinelli', name: 'But Not Today', collection: 'Sauf' },
      text,
      LINES
    ),
    {
      fragrance: { brand: 'Filippo Sorcinelli', name: 'But Not Today' },
      unconfirmedLine: 'Sauf',
    }
  )
  // A line belonging to a DIFFERENT house must not leak across.
  check(
    "another house's line does not count as corroboration",
    decide(
      { brand: 'Filippo Sorcinelli', name: 'But Not Today', collection: 'Private Blend' },
      text,
      LINES
    ),
    {
      fragrance: { brand: 'Filippo Sorcinelli', name: 'But Not Today' },
      unconfirmedLine: 'Private Blend',
    }
  )
  check(
    'a house with no lines recorded corroborates nothing',
    decide(
      { brand: 'Pana Dora', name: 'Opuluxe', collection: 'Royal' },
      'аромат Opuluxe від @pana.dora.sweden',
      LINES
    ),
    { fragrance: { brand: 'Pana Dora', name: 'Opuluxe' }, unconfirmedLine: 'Royal' }
  )

  // ---- resolveTarget: which post a hand-entered bottle lands on -----------
  //
  // The stakes are the same as gate one's, from the other direction: this is
  // what stops a mistyped id renaming the pictures of a post that was already
  // right.
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

  // Grounding survives here as a warning only: a person outranks the check,
  // but a wrong id looks exactly like this.
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
  console.log('\nAll fragrance-naming checks passed.')
}

main()
