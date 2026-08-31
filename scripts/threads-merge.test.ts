/**
 * Pins the Threads merge rule. `npm run test:merge`.
 *
 * The case that matters is the third one: a stored post carries hand-written
 * work — the bottle it names, its alt text, any edited body — and a freshly
 * fetched copy carries none of it. If the fetched copy ever won, naming a
 * bottle would be undone the next time its post came back around, silently,
 * with nothing in the log to say so.
 */

import { mergePosts } from './threads-merge'
import type { ThreadsPost } from '../src/lib/threads/types'

let failed = 0

function check(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a === b) {
    console.log(`✓ ${label}`)
  } else {
    failed += 1
    console.error(`✗ ${label}\n    expected ${b}\n    actual   ${a}`)
  }
}

function post(
  id: string,
  timestamp: string,
  extra: Partial<ThreadsPost> = {}
): ThreadsPost {
  return {
    id,
    permalink: `https://www.threads.com/p/${id}`,
    timestamp,
    mediaType: 'IMAGE',
    text: '',
    images: [],
    isQuotePost: false,
    ...extra,
  }
}

const a = post('1', '2026-01-01T00:00:00.000Z')
const b = post('2', '2026-02-01T00:00:00.000Z')
const c = post('3', '2026-03-01T00:00:00.000Z')

// --- the ordinary path ----------------------------------------------------

check(
  'nothing stored, everything is taken',
  mergePosts([], [a, b]).posts.map((p) => p.id),
  ['2', '1']
)
check(
  'nothing fetched, the snapshot is untouched',
  mergePosts([a, b], []).posts.map((p) => p.id),
  ['2', '1']
)
check(
  'new posts join the stored ones',
  mergePosts([a], [b, c]).posts.map((p) => p.id),
  ['3', '2', '1']
)
check('no collisions in the ordinary path', mergePosts([a], [b, c]).collisions, 0)

// --- newest first, deterministically --------------------------------------

check(
  'the result is newest first',
  mergePosts([a, c, b], []).posts.map((p) => p.id),
  ['3', '2', '1']
)
const tie1 = post('10', '2026-01-01T00:00:00.000Z')
const tie2 = post('20', '2026-01-01T00:00:00.000Z')
check(
  'a timestamp tie breaks on id rather than by luck',
  mergePosts([tie1, tie2], []).posts.map((p) => p.id),
  ['20', '10']
)
check(
  'and breaks the same way whatever order it is handed',
  mergePosts([tie2, tie1], []).posts.map((p) => p.id),
  ['20', '10']
)

// --- the rule that protects hand-written work -----------------------------

const named = post('1', '2026-01-01T00:00:00.000Z', {
  text: 'the review, as edited',
  fragrance: { brand: 'Tom Ford', name: 'Oud Wood' },
  images: [
    {
      publicId: 'threads/images/Tom_Ford-Oud_Wood-1',
      width: 1,
      height: 1,
      alt: 'a bottle',
    },
  ],
})
const refetched = post('1', '2026-01-01T00:00:00.000Z', {
  text: 'the raw body from the API',
})

const collision = mergePosts([named], [refetched])
check('a collision keeps exactly one copy', collision.posts.length, 1)
const [kept] = collision.posts
check('the stored post wins, not the fetched one', kept?.text, 'the review, as edited')
check('the bottle survives', kept?.fragrance, { brand: 'Tom Ford', name: 'Oud Wood' })
check('so does the alt text', kept?.images[0]?.alt, 'a bottle')
check('and the collision is counted so the caller can say so', collision.collisions, 1)

// --- duplicates inside one fetch ------------------------------------------

// Cursor pagination can hand the same post back on two pages. Nothing upstream
// looks for this, which is the gap the stored-id filter does not cover.
const twice = mergePosts(
  [],
  [b, post('2', '2026-02-01T00:00:00.000Z', { text: 'second copy' })]
)
check('the same post twice in one batch yields one', twice.posts.length, 1)
check('the first copy is the one kept', twice.posts[0]?.text, '')
check('and it counts as a collision', twice.collisions, 1)

// --- the output does not depend on the input order ------------------------

/*
 * The strong property, and the one that separates this merge from the photo
 * one. Every post has a unique (timestamp, id), so the comparator totally
 * orders them and the result is the same however the rows arrive — at any
 * split, interleaved, or shuffled. Checked against the live 94-post snapshot
 * at all 95 split points and over 200 shuffles; pinned here offline.
 *
 * mergePhotos deliberately does NOT have this: album rows tie on both fields,
 * so their order comes from the input. See photo-merge.ts.
 */
function shuffle<T>(xs: readonly T[], seed: number): T[] {
  let s = seed
  const rand = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j] as T, out[i] as T]
  }
  return out
}

// Five timestamps across twenty-five posts, so every one of them is a tie and
// the id comparator is what does the ordering. With distinct timestamps this
// test passes even with the tie-break deleted, which makes it worth nothing.
const many = Array.from({ length: 25 }, (_, i) =>
  post(String(100 + i), `2026-01-0${(i % 5) + 1}T00:00:00.000Z`)
)
const canonical = JSON.stringify(mergePosts(many, []).posts)

let orderDependent = 0
for (let seed = 1; seed <= 50; seed++) {
  const s = shuffle(many, seed)
  const cut = seed % (many.length + 1)
  if (JSON.stringify(mergePosts(s.slice(cut), s.slice(0, cut)).posts) !== canonical) {
    orderDependent += 1
  }
}
check('50 shuffles and splits all give the same answer', orderDependent, 0)

// --- the inputs are not mutated -------------------------------------------

const stored = [a, b]
const fresh = [c]
mergePosts(stored, fresh)
check(
  'the stored array is left alone',
  stored.map((p) => p.id),
  ['1', '2']
)
check(
  'the fetched array is left alone',
  fresh.map((p) => p.id),
  ['3']
)

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll checks passed.')
