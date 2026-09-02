/**
 * Pins what `media:verify` counts as broken. `npm run test:media-audit`.
 *
 * The case that matters is `stranded`. On 2026-09-02 seven bottle photographs
 * were uploaded through the Cloudinary Media Library, which files an asset in
 * the folder you pick but names it with a generated UUID unless you set the
 * public id yourself. Delivery is by public id, so all seven rows 404'd while
 * the Media Library showed the pictures sitting exactly where they belonged —
 * and nothing anywhere said so. A checker that cannot see that state is not
 * worth running, and "it passed against a healthy store" does not prove it can.
 */

import { inspect, photoReferences, threadsReferences } from './media-audit'
import type { TypedAsset } from './media-audit'
import type { ThreadsSnapshot } from '../src/lib/threads/types'
import type { PhotoSnapshot } from '../src/lib/photos/types'

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

function asset(
  publicId: string,
  assetFolder: string,
  resourceType: 'image' | 'video' = 'image'
): TypedAsset {
  // The version is what a delivery URL is built from; this audit does not read
  // it, but AssetRow carries one, so a fixture has to supply it.
  return { publicId, assetFolder, bytes: 1, resourceType, version: 1 }
}

const threads = {
  syncedAt: '2026-09-02T00:00:00.000Z',
  username: 'sergei_butko',
  posts: [
    {
      id: '1',
      permalink: 'https://www.threads.com/p/1',
      timestamp: '2026-09-01T00:00:00.000Z',
      mediaType: 'IMAGE' as const,
      text: '',
      images: [
        { publicId: 'threads/images/Tom_Ford-Oud_Wood-1', width: 1, height: 1, alt: '' },
        { publicId: 'threads/images/Tom_Ford-Oud_Wood-2', width: 1, height: 1, alt: '' },
      ],
      isQuotePost: false,
      fragrance: { brand: 'Tom Ford', name: 'Oud Wood' },
    },
  ],
} satisfies ThreadsSnapshot

const photos = {
  syncedAt: '2026-09-02T00:00:00.000Z',
  channel: 'just_my_photos',
  photos: [
    {
      messageId: 1,
      publicId: 'telegram/images/1-0',
      width: 1,
      height: 1,
      date: '2026-09-01T00:00:00.000Z',
      // A track the sync could not fetch carries a title and no publicId. That
      // is a supported state, so it must not be counted as a missing asset.
      audio: { title: 'Unfetched', artist: 'Nobody' },
    },
  ],
} as unknown as PhotoSnapshot

function main(): void {
  const references = [...threadsReferences(threads), ...photoReferences(photos)]
  check('a track with no publicId is not a reference', references.length, 3)

  // A healthy store: everything referenced is present and filed by its id.
  const healthy: TypedAsset[] = [
    asset('threads/images/Tom_Ford-Oud_Wood-1', 'threads/images'),
    asset('threads/images/Tom_Ford-Oud_Wood-2', 'threads/images'),
    asset('telegram/images/1-0', 'telegram/images'),
  ]
  const ok = inspect(references, healthy)
  check(
    'healthy store is clean',
    [ok.missing.length, ok.stranded.length, ok.orphaned.length, ok.misfiled.length],
    [0, 0, 0, 0]
  )

  // The 2026-09-02 failure, exactly: the bytes are in the folder, under a UUID.
  const strandedStore: TypedAsset[] = [
    asset('threads/images/Tom_Ford-Oud_Wood-1', 'threads/images'),
    asset('d192a3a6-4a37-4ffc-af92-2068dc9af3e2', 'threads/images'),
    asset('telegram/images/1-0', 'telegram/images'),
  ]
  const bad = inspect(references, strandedStore)
  check(
    'a Media Library upload is reported as stranded',
    bad.stranded.map((a) => a.publicId),
    ['d192a3a6-4a37-4ffc-af92-2068dc9af3e2']
  )
  check(
    'and the row it should have filled is reported as missing',
    bad.missing.map((r) => r.where),
    ['Tom Ford – Oud Wood, image 2']
  )

  // Demo assets sit in the root with no folder, and are none of this script's
  // business — flagging them would make a clean run impossible to keep clean.
  const withDemo = inspect(references, [...healthy, asset('samples/waves', '')])
  check('a rootless demo asset is ignored', withDemo.stranded.length, 0)

  // Neither of these breaks a page, so they are reported and do not fail a run.
  // The song IS referenced here, so that "misfiled" is tested on its own rather
  // than on an asset that is also an orphan.
  const untidy = inspect(
    [
      ...references,
      {
        publicId: 'telegram/audio/554',
        resourceType: 'video',
        where: 'song "Referenced"',
      },
    ],
    [
      ...healthy,
      asset('threads/images/Orphan-1', 'threads/images'),
      asset('telegram/audio/554', '', 'video'),
    ]
  )
  check('an unreferenced managed asset is an orphan', untidy.orphaned, [
    'threads/images/Orphan-1',
  ])
  check(
    'an asset filed away from its id is misfiled',
    untidy.misfiled.map((a) => a.publicId),
    ['telegram/audio/554']
  )

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`)
    process.exit(1)
  }
  console.log('\nAll media-audit checks passed.')
}

main()
