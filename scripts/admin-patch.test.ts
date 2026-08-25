/**
 * Pins the rules that decide what an /admin save may change.
 *
 * This is the code that can silently lose content: it rewrites the canonical
 * snapshot, and a mistake here is not a crash but a quietly wrong site. Same
 * reasoning as photo-dedup.test.ts.
 */

import { patchPhotos, patchThreads } from '../workers/admin-api/src/patch'

let failures = 0
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  if (!ok) {
    failures++
    console.log(`    expected ${JSON.stringify(expected)}`)
    console.log(`    actual   ${JSON.stringify(actual)}`)
  }
}

const post = (id: string, text: string) => ({
  id,
  text,
  permalink: `https://threads.com/p/${id}`,
  timestamp: '2026-08-01T00:00:00.000Z',
})

const photo = (publicId: string, caption = '') => ({
  publicId,
  caption,
  alt: {} as { en?: string; uk?: string },
  hidden: undefined as boolean | undefined,
  id: 1,
  timestamp: '2026-08-01T00:00:00.000Z',
})

// --- threads ---
{
  const snapshot = { posts: [post('a', 'one'), post('b', 'two')] }
  const r = patchThreads(snapshot, { a: { text: 'edited' } })
  check(
    'edits only the named post',
    r.next.posts.map((p) => p.text),
    ['edited', 'two']
  )
  check('reports one applied', r.applied, 1)
  check('leaves the original untouched', snapshot.posts[0]!.text, 'one')
}
{
  const snapshot = { posts: [post('a', 'one')] }
  const r = patchThreads(snapshot, { a: { text: 'one' } })
  check('an identical value is not a change', r.applied, 0)
}
{
  const snapshot = { posts: [post('a', 'one')] }
  const r = patchThreads(snapshot, { ghost: { text: 'x' } })
  check('an unknown id is reported, not invented', r.unknownIds, ['ghost'])
  check('and changes nothing', r.applied, 0)
}
{
  // The guard that matters most: timestamp is the sync's high-water mark, so a
  // patch must never move it or the sync would skip real posts forever.
  const snapshot = { posts: [post('a', 'one')] }
  const r = patchThreads(snapshot, {
    a: { text: 'edited', timestamp: '1999-01-01T00:00:00.000Z', id: 'evil' },
  } as never)
  check(
    'ignores timestamp in a patch',
    r.next.posts[0]!.timestamp,
    '2026-08-01T00:00:00.000Z'
  )
  check('ignores id in a patch', r.next.posts[0]!.id, 'a')
}

// --- photos ---
{
  const snapshot = { photos: [photo('telegram/1-0'), photo('telegram/2-0')] }
  const r = patchPhotos(snapshot, {
    'telegram/1-0': { caption: 'hi', alt: { en: 'a cat' }, hidden: true },
  })
  check('applies caption', r.next.photos[0]!.caption, 'hi')
  check('applies alt for one locale only', r.next.photos[0]!.alt, { en: 'a cat' })
  check('applies hidden', r.next.photos[0]!.hidden, true)
  check('leaves the other photo alone', r.next.photos[1]!.caption, '')
}
{
  const snapshot = {
    photos: [{ ...photo('telegram/1-0'), alt: { en: 'old', uk: 'старе' } }],
  }
  const r = patchPhotos(snapshot, { 'telegram/1-0': { alt: { en: '' } } })
  check('an empty alt clears that locale', r.next.photos[0]!.alt, { uk: 'старе' })
}
{
  const snapshot = { photos: [{ ...photo('telegram/1-0'), hidden: true }] }
  const r = patchPhotos(snapshot, { 'telegram/1-0': { hidden: false } })
  check(
    'unhiding removes the flag rather than storing false',
    'hidden' in r.next.photos[0]!,
    false
  )
}
{
  const snapshot = { photos: [photo('telegram/1-0')] }
  const r = patchPhotos(snapshot, {
    'telegram/1-0': {
      publicId: 'telegram/hacked',
      timestamp: '1999-01-01T00:00:00.000Z',
    },
  } as never)
  check('ignores publicId in a patch', r.next.photos[0]!.publicId, 'telegram/1-0')
  check(
    'ignores timestamp in a patch',
    r.next.photos[0]!.timestamp,
    '2026-08-01T00:00:00.000Z'
  )
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
