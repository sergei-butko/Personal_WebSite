/**
 * Pins the shape of a delivery URL. `npm run test:media-url`.
 *
 * The version segment is the reason this exists. A public id here is
 * POSITIONAL — `<Brand>-<Scent>-<n>`, where n is the image's index in its post
 * — so reordering a post's pictures renames nothing; it swaps the bytes under
 * two stable ids. Cloudinary serves those with `max-age=2592000`, so on
 * 2026-09-02 four bottles were reordered, the store was correct within
 * seconds, and every browser that had already loaded the page went on showing
 * the old order. Nothing was broken; it just could not be seen.
 *
 * So the properties worth pinning are that the version lands in the path where
 * Cloudinary expects it, and that a row without one still produces the URL that
 * worked before — a snapshot predating the field must not start 404ing.
 *
 * The cloud name comes from the npm script rather than from a line up here:
 * lib/media.ts reads it at module scope, and an assignment in this file would
 * run after the import that consumes it.
 */

import { audioUrl, mediaSrcSet, mediaUrl, widestWidth } from '../src/lib/media'

let failed = 0

function check(label: string, actual: unknown, expected: unknown): void {
  if (actual === expected) {
    console.log(`✓ ${label}`)
  } else {
    failed += 1
    console.error(
      `✗ ${label}\n    expected ${String(expected)}\n    actual   ${String(actual)}`
    )
  }
}

const BASE = 'https://res.cloudinary.com/test-cloud'
const ID = 'threads/images/Kajal-Kajal_I-1'

function main(): void {
  check(
    'the version goes after the transform and before the id',
    mediaUrl(ID, 400, 1788381865),
    `${BASE}/image/upload/f_auto,q_auto,c_limit,w_400/v1788381865/${ID}`
  )

  // A snapshot written before the field existed. The URL must still resolve —
  // versionless delivery returns whatever the asset holds now, which is the
  // behaviour the site had for its whole life until this change.
  check(
    'no version means no segment, not an empty one',
    mediaUrl(ID, 400),
    `${BASE}/image/upload/f_auto,q_auto,c_limit,w_400/${ID}`
  )

  // 0 is what `Number(undefined ?? 0)` yields off a listing that omitted it.
  // Emitting `v0/` would 404 every image on the site at once.
  check('version 0 is treated as absent', mediaUrl(ID, 400, 0), mediaUrl(ID, 400))

  check(
    'audio carries it too, before the id and its extension',
    audioUrl('telegram/audio/554', 1788126340),
    `${BASE}/video/upload/v1788126340/telegram/audio/554.mp3`
  )

  // Every candidate must carry the same version, or a browser picking a
  // different width would fetch a different generation of the picture.
  const srcSet = mediaSrcSet(ID, 1000, 1788381865)
  check(
    'every srcset candidate carries the version',
    srcSet.split(', ').every((entry) => entry.includes('/v1788381865/')),
    true
  )
  check(
    'and srcset still stops at the intrinsic width',
    srcSet,
    [400, 800]
      .map(
        (w) => `${BASE}/image/upload/f_auto,q_auto,c_limit,w_${w}/v1788381865/${ID} ${w}w`
      )
      .join(', ')
  )
  check('widestWidth is unaffected by versioning', widestWidth(1000), 800)

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`)
    process.exit(1)
  }
  console.log('\nAll media-url checks passed.')
}

main()
