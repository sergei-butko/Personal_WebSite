/**
 * Pins the photo merge rule. `npm run test:photo-merge`.
 *
 * Two of these are the reason the file exists. Keying on `publicId` alone would
 * delete a photo from an album the first time the channel repeated an image,
 * and adding a `publicId` tie-break to the sort would scramble any album of
 * more than ten photos. Both look like tidying up; both lose content.
 */

import { mergePhotos } from './photo-merge'
import type { Photo } from '../src/lib/photos/types'

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

function photo(
  id: number,
  publicId: string,
  timestamp: string,
  extra: Partial<Photo> = {}
): Photo {
  return {
    id,
    permalink: `https://t.me/just_my_photos/${id}`,
    timestamp,
    caption: '',
    alt: {},
    publicId,
    width: 100,
    height: 100,
    ...extra,
  }
}

const T1 = '2026-01-01T00:00:00.000Z'
const T2 = '2026-02-01T00:00:00.000Z'

// --- the ordinary path ----------------------------------------------------

const a0 = photo(10, 'telegram/images/10-0', T1)
const b0 = photo(20, 'telegram/images/20-0', T2)

check('nothing stored, everything is taken', mergePhotos([], [a0, b0]).photos.length, 2)
check('nothing fresh, the snapshot is untouched', mergePhotos([a0], []).photos.length, 1)
check(
  'newest post first',
  mergePhotos([a0], [b0]).photos.map((p) => p.id),
  [20, 10]
)
check('no collisions in the ordinary path', mergePhotos([a0], [b0]).collisions, 0)

// --- album order survives -------------------------------------------------

// Eleven photos, so slot 10 exists. A publicId tie-break would put it second.
const album = Array.from({ length: 11 }, (_, i) =>
  photo(30, `telegram/images/30-${i}`, T1)
)
check(
  'album order is slot order, not alphabetical',
  mergePhotos([], album).photos.map((p) => p.publicId.split('-').pop()),
  ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
)
check(
  'and it survives a merge with stored rows',
  mergePhotos(album.slice(0, 5), album.slice(5)).photos.map((p) =>
    p.publicId.split('-').pop()
  ),
  ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
)

// --- two posts sharing one timestamp --------------------------------------

const same1 = photo(40, 'telegram/images/40-0', T1)
const same2 = photo(41, 'telegram/images/41-0', T1)
check(
  'two posts at the same instant order by id, not by luck',
  mergePhotos([same1, same2], []).photos.map((p) => p.id),
  [41, 40]
)
check(
  'and the same way whatever order they arrive in',
  mergePhotos([same2, same1], []).photos.map((p) => p.id),
  [41, 40]
)

// --- deduplication across posts must NOT collapse -------------------------

// The channel posted the same image twice. sha256 dedup stores it once, so the
// second post's row points at the first post's asset. These are two photos.
const original = photo(50, 'telegram/images/50-0', T1)
const reposted = photo(60, 'telegram/images/50-0', T2)
const shared = mergePhotos([original], [reposted])
check('a shared asset in two posts stays two rows', shared.photos.length, 2)
check('neither is counted as a collision', shared.collisions, 0)
check(
  'both posts are still represented',
  shared.photos.map((p) => p.id),
  [60, 50]
)

// --- the same row twice DOES collapse -------------------------------------

const again = mergePhotos([original], [photo(50, 'telegram/images/50-0', T1)])
check('the same (post, asset) twice yields one row', again.photos.length, 1)
check('and counts as a collision', again.collisions, 1)

// The same asset twice inside one album is one row: the album repeated an
// identical image and dedup folded it onto one asset.
const twiceInAlbum = mergePhotos(
  [],
  [photo(70, 'telegram/images/70-0', T1), photo(70, 'telegram/images/70-0', T1)]
)
check('one asset twice in one album is one row', twiceInAlbum.photos.length, 1)
check('counted', twiceInAlbum.collisions, 1)

// --- a half-fresh album: an input a sync cannot produce -------------------

/*
 * Pinned so the behaviour is known rather than discovered. Album rows all carry
 * their post's timestamp and the cursor filters whole posts, so an album is
 * always wholly stored or wholly fresh — but if one were ever split, every row
 * still survives and only the ORDER goes: stored rows first, then fresh. No
 * photo is lost, which is the property worth guaranteeing.
 */
const half = mergePhotos(
  [photo(90, 'telegram/images/90-2', T1), photo(90, 'telegram/images/90-3', T1)],
  [photo(90, 'telegram/images/90-0', T1), photo(90, 'telegram/images/90-1', T1)]
)
check('a split album loses no rows', half.photos.length, 4)
check('no false collisions', half.collisions, 0)
check(
  'though the order follows insertion, stored before fresh',
  half.photos.map((p) => p.publicId.split('-').pop()),
  ['2', '3', '0', '1']
)

// --- stored wins, so hand-written work survives ---------------------------

const edited = photo(80, 'telegram/images/80-0', T1, {
  caption: 'the caption, as edited',
  alt: { en: 'a lake at dusk', uk: 'озеро на світанку' },
  audio: {
    id: 81,
    permalink: 'https://t.me/just_my_photos/81',
    title: 'a song',
    performer: 'someone',
    publicId: 'telegram/audio/81',
  },
  hidden: true,
})
const raw = photo(80, 'telegram/images/80-0', T1)
const kept = mergePhotos([edited], [raw]).photos[0]
check('the stored row wins, not the fresh one', kept?.caption, 'the caption, as edited')
check('alt text survives', kept?.alt, { en: 'a lake at dusk', uk: 'озеро на світанку' })
check('the song survives', kept?.audio?.publicId, 'telegram/audio/81')
check('and so does hidden', kept?.hidden, true)

// --- the inputs are not mutated -------------------------------------------

const stored = [a0]
const fresh = [b0]
mergePhotos(stored, fresh)
check('the stored array is left alone', stored.length, 1)
check('the fresh array is left alone', fresh.length, 1)

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll checks passed.')
