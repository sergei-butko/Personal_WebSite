/**
 * Puts every Cloudinary asset in the right folder under the right name.
 *
 *     npm run media:organise              # do it
 *     SYNC_DRY_RUN=1 npm run media:organise   # say what it would do
 *
 * Idempotent by construction: it compares the store against what
 * `media-name.ts` says the layout should be and touches only the difference.
 * Running it twice in a row does nothing the second time, which is what makes
 * it safe to run after every round of naming bottles.
 *
 * ## What it is for
 *
 * Two jobs, and they are the same job:
 *
 * 1. **Folders.** This cloud is in dynamic-folder mode, so an asset's
 *    `asset_folder` is a separate field from its `public_id` and neither the
 *    upload nor a rename sets it. Every asset these scripts have ever uploaded
 *    therefore sat in the ROOT of the Media Library — 653 of them in one
 *    undifferentiated list — while their ids said `telegram/…` and `threads/…`.
 * 2. **Names.** A Threads image called `threads/17956459470243614-0` tells a
 *    human nothing. `threads/images/Tom_Ford-Oud_Wood-1` tells them everything.
 *    The brand and scent are hand-written and absent when the sync runs, so
 *    the renaming cannot happen there; it happens here, afterwards.
 *
 * ## The order matters, and so does the snapshot
 *
 * A public id IS the delivery URL. Renaming an asset without rewriting the
 * snapshot that points at it produces a page of broken images, so the two must
 * agree — and since the snapshot is a single document, it is written ONCE, at
 * the end, after every rename has come back. A run that dies halfway leaves
 * some assets moved and the snapshot untouched, which the next run finishes:
 * it finds the target already occupied by the right asset and records it.
 * That is why the store is listed first and compared against, rather than the
 * snapshot being trusted about where things are.
 *
 * ## Deleting
 *
 * Nothing is deleted unless MEDIA_PRUNE=1 is passed, and then only assets under
 * `telegram/` and `threads/` that no snapshot references. The snapshots
 * themselves (`data/`), Cloudinary's own demo files and anything else outside
 * those two namespaces are never candidates, whatever the flag says.
 *
 * Opt-in because it is irreversible in a way the photo prune is not: a Telegram
 * photo can be fetched again from the channel — that is what SYNC_REPAIR does —
 * but Meta's media URLs are signed and expire, so a deleted Threads image is
 * gone for good. Read the list it prints before passing the flag.
 */

import {
  type AssetRow,
  type ResourceType,
  deleteAssets,
  fetchJson,
  listAssets,
  renameAsset,
  setAssetFolder,
  uploadJson,
} from './cloudinary'
import {
  DATA_FOLDER,
  TELEGRAM_AUDIO_FOLDER,
  TELEGRAM_IMAGE_FOLDER,
  THREADS_IMAGE_FOLDER,
  displayNameOf,
  folderOf,
  threadsImageId,
} from './media-name'
import type { PhotoSnapshot } from '../src/lib/photos/types'
import type { ThreadsSnapshot } from '../src/lib/threads/types'

const PHOTOS = 'data/photos.json'
const HASHES = 'data/photo-hashes.json'
const THREADS = 'data/threads.json'

/** Say what would happen and touch nothing. */
const DRY_RUN = process.env.SYNC_DRY_RUN === '1'

/**
 * Delete assets under telegram/ and threads/ that no snapshot references.
 *
 * Off by default. See the note on deleting in the header: a Threads image
 * cannot be re-fetched, so this is the one irreversible thing here.
 */
const PRUNE = process.env.MEDIA_PRUNE === '1'

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

/**
 * Whatever Cloudinary threw, as a sentence.
 *
 * The SDK is not consistent about this. Some failures arrive as an Error with
 * `message` and `http_code`, some as `{ error: { message } }`, and at least one
 * arrives as an object with neither — which is how a run once aborted printing
 * the word `undefined` and nothing else. Anything unrecognised is JSON so that
 * the next surprise is legible rather than blank.
 */
function describeError(error: unknown): string {
  if (typeof error === 'string') return error
  const e = error as { message?: unknown; error?: { message?: unknown } }
  if (typeof e?.message === 'string' && e.message) return e.message
  if (typeof e?.error?.message === 'string' && e.error.message) return e.error.message
  if (error instanceof Error && error.message) return error.message
  try {
    return JSON.stringify(error) ?? String(error)
  } catch {
    return String(error)
  }
}

/** Was this a 404 — i.e. the thing being renamed is not there any more? */
function isMissing(error: unknown): boolean {
  const e = error as { http_code?: unknown; error?: { http_code?: unknown } }
  if (e?.http_code === 404 || e?.error?.http_code === 404) return true
  return /not found/i.test(describeError(error))
}

/** One asset's move: where it is now, where it belongs. */
interface Move {
  from: string
  to: string
  resourceType: ResourceType
  /** What it is, for the log: "photo", "song", "bottle", "snapshot". */
  kind: string
}

/**
 * Every id the store currently holds, per resource type.
 *
 * Listed once. The Admin API allows 500 requests an hour on this plan and a
 * full run touches 651 assets, so asking about each one individually is not an
 * option — see listAssets.
 */
async function currentState(): Promise<Map<ResourceType, Map<string, AssetRow>>> {
  const state = new Map<ResourceType, Map<string, AssetRow>>()
  for (const type of ['image', 'video', 'raw'] as const) {
    const rows = await listAssets(type)
    state.set(type, new Map(rows.map((row) => [row.publicId, row])))
  }
  return state
}

/**
 * Refuses to run when two different assets want the same name.
 *
 * Two bottles whose brand and scent slug identically would otherwise have the
 * second rename destroy the first — `renameAsset` passes no `overwrite`, so
 * Cloudinary would reject it, but a clear message beats a 400 from the API
 * halfway through a run. There are none today; there will be the first time a
 * post is named after a scent that differs from another only by an accent.
 */
function assertNoCollisions(moves: Move[]): void {
  const byTarget = new Map<string, string[]>()
  for (const move of moves) {
    byTarget.set(move.to, [...(byTarget.get(move.to) ?? []), move.from])
  }
  const clashes = [...byTarget].filter(([, sources]) => new Set(sources).size > 1)
  if (clashes.length === 0) return

  console.error('✗ two or more assets want the same name:')
  for (const [target, sources] of clashes) {
    console.error(`    ${target}`)
    for (const source of sources) console.error(`      ← ${source}`)
  }
  fail(
    'Renaming would destroy one of each pair. Give the bottles distinguishable ' +
      'names in data/threads.json (npm run content:pull), then run this again.'
  )
}

/**
 * The id an existing asset should have: the same leaf, in the right folder.
 *
 * Re-prefixing rather than re-deriving the name from (post id, slot), which is
 * what the sync does. A DEDUPLICATED photo deliberately carries another post's
 * asset id — two byte-identical images are one asset, mapped in
 * data/photo-hashes.json — so re-deriving would rename that shared asset after
 * whichever row happened to be processed last and leave the other row pointing
 * at nothing. The leaf is the asset's identity; the folder is all that moves.
 */
function reFolder(publicId: string, folder: string): string {
  return `${folder}/${displayNameOf(publicId)}`
}

async function main(): Promise<void> {
  console.log(DRY_RUN ? '→ DRY RUN — nothing will be written\n' : '')

  const photos = await fetchJson<PhotoSnapshot>(PHOTOS)
  const threads = await fetchJson<ThreadsSnapshot>(THREADS)
  const hashes = await fetchJson<Record<string, string>>(HASHES)
  if (!photos) fail(`${PHOTOS} is not in Cloudinary. Run npm run sync:photos first.`)
  if (!threads) fail(`${THREADS} is not in Cloudinary. Run npm run sync:threads first.`)

  const state = await currentState()
  const images = state.get('image') ?? new Map()
  const videos = state.get('video') ?? new Map()
  const raws = state.get('raw') ?? new Map()

  const moves: Move[] = []
  /** old public id → new public id, for rewriting the snapshots at the end. */
  const renamed = new Map<string, string>()

  /**
   * Plans one asset. Returns the id it will have afterwards, which is the id
   * the snapshot must carry — whether or not anything needs moving.
   */
  const plan = (
    from: string,
    to: string,
    resourceType: ResourceType,
    kind: string,
    present: Map<string, AssetRow>
  ): string => {
    if (from !== to) {
      if (present.has(from)) {
        moves.push({ from, to, resourceType, kind })
      } else if (!present.has(to)) {
        // Neither the old id nor the new one is in the store. The snapshot
        // references an asset that is simply gone; say so rather than
        // rewriting the row to point somewhere equally empty.
        console.warn(`  ! ${kind}: neither ${from} nor ${to} is in Cloudinary`)
        return from
      }
      // else: already renamed by an earlier, interrupted run — nothing to do.
      renamed.set(from, to)
    }
    return to
  }

  // --- Telegram photos ----------------------------------------------------

  for (const photo of photos.photos) {
    const to = reFolder(photo.publicId, TELEGRAM_IMAGE_FOLDER)
    photo.publicId = plan(photo.publicId, to, 'image', 'photo', images)
  }

  // --- Telegram songs -----------------------------------------------------

  for (const photo of photos.photos) {
    const audio = photo.audio
    if (!audio?.publicId) continue
    audio.publicId = plan(
      audio.publicId,
      reFolder(audio.publicId, TELEGRAM_AUDIO_FOLDER),
      'video',
      'song',
      videos
    )
  }

  // --- Threads images -----------------------------------------------------

  for (const post of threads.posts) {
    post.images.forEach((image, index) => {
      const to = threadsImageId(post.fragrance, post.id, index)
      image.publicId = plan(image.publicId, to, 'image', 'bottle', images)
    })
  }

  /*
   * One asset, one rename. A song repeats on every row of its album and a
   * deduplicated photo is shared between posts, so the same source is planned
   * more than once — and the second rename of an id that has already moved is
   * a 404 from Cloudinary, mid-run.
   */
  const unique = new Map(moves.map((move) => [`${move.resourceType}:${move.from}`, move]))
  moves.length = 0
  moves.push(...unique.values())

  assertNoCollisions(moves)

  // --- Folders ------------------------------------------------------------

  /*
   * Every asset the snapshots reference, with the folder it belongs in. A
   * rename does not move an asset between folders — that is a separate call,
   * and it is the one this whole script exists for.
   */
  const folders: { id: string; folder: string; resourceType: ResourceType }[] = []
  const want = (id: string, resourceType: ResourceType) =>
    folders.push({ id, folder: folderOf(id), resourceType })

  for (const photo of photos.photos) {
    want(photo.publicId, 'image')
    if (photo.audio?.publicId) want(photo.audio.publicId, 'video')
  }
  for (const post of threads.posts) for (const i of post.images) want(i.publicId, 'image')
  for (const id of [PHOTOS, HASHES, THREADS]) want(id, 'raw')

  // De-duplicate: a song repeats on every row of its album, and dedup lets two
  // photos share one asset.
  const uniqueFolders = new Map(folders.map((f) => [`${f.resourceType}:${f.id}`, f]))

  const needsFolder = [...uniqueFolders.values()].filter((f) => {
    const present =
      f.resourceType === 'image' ? images : f.resourceType === 'video' ? videos : raws
    const row = present.get(f.id)
    // Unknown ids are the ones being renamed into place this run; they will
    // need their folder set once they exist under the new name.
    return !row || row.assetFolder !== f.folder
  })

  // --- Report -------------------------------------------------------------

  const byKind = new Map<string, number>()
  for (const move of moves) byKind.set(move.kind, (byKind.get(move.kind) ?? 0) + 1)

  console.log(`store: ${images.size} image(s), ${videos.size} video(s), ${raws.size} raw`)
  console.log(
    `plan : ${moves.length} rename(s) — ` +
      ([...byKind].map(([k, n]) => `${n} ${k}`).join(', ') || 'none') +
      `; ${needsFolder.length} folder move(s)`
  )
  console.log(
    `into : ${TELEGRAM_IMAGE_FOLDER}/  ${TELEGRAM_AUDIO_FOLDER}/  ` +
      `${THREADS_IMAGE_FOLDER}/  ${DATA_FOLDER}/\n`
  )

  for (const move of moves.slice(0, DRY_RUN ? moves.length : 12)) {
    console.log(`  ${move.from}\n    → ${move.to}`)
  }
  if (!DRY_RUN && moves.length > 12) console.log(`  … and ${moves.length - 12} more`)

  /*
   * Assets in the store that no snapshot mentions.
   *
   * Scoped to the two namespaces these scripts own, and that scoping is what
   * makes the prune below safe rather than a nice-to-have: `data/` holds the
   * snapshots themselves, and anything outside both is not this tool's to
   * judge — a new account arrives with Cloudinary's demo assets at the root and
   * in `samples/`, and those are for their owner to remove, not for a sync.
   *
   * Old prefixes count. An unreferenced asset was never renamed — a rename is
   * only planned for something a snapshot points at — so these sit at
   * `threads/<postId>-<slot>`, not under `threads/images/`. Matching on the
   * folder would find none of them.
   */
  const referenced = new Set([...uniqueFolders.values()].map((f) => f.id))
  const owned = (id: string) => id.startsWith('telegram/') || id.startsWith('threads/')
  const orphanImages = [...images.keys()].filter(
    (id) => owned(id) && !referenced.has(id) && !moves.some((m) => m.from === id)
  )
  const orphanVideos = [...videos.keys()].filter(
    (id) => owned(id) && !referenced.has(id) && !moves.some((m) => m.from === id)
  )
  const orphans = [...orphanImages, ...orphanVideos]
  if (orphans.length > 0) {
    console.log(
      `\n  ${orphans.length} asset(s) no snapshot references ` +
        `(${PRUNE ? 'MEDIA_PRUNE=1, these will be DELETED' : 'left alone'}):`
    )
    // Every one of them, always. This is the only record of what a prune
    // removed, and a truncated list is no record at all.
    for (const id of orphans) console.log(`    ${id}`)
  }

  if (DRY_RUN) {
    console.log('\n→ dry run, nothing written')
    return
  }
  if (moves.length === 0 && needsFolder.length === 0 && !(PRUNE && orphans.length > 0)) {
    console.log('\n✓ already organised, nothing to do')
    return
  }

  // --- Do it --------------------------------------------------------------

  console.log('')

  /*
   * A failed rename ABORTS. The snapshots have not been written yet, so
   * stopping here leaves the store partly moved and every id still pointing
   * where it did — which is consistent, if untidy, and re-running finishes the
   * job because an asset already at its target is recognised as done. Pressing
   * on and writing a snapshot describing renames that did not happen is the
   * one outcome that would actually break the site.
   */
  let done = 0
  for (const move of moves) {
    try {
      await renameAsset(move.from, move.to, move.resourceType)
    } catch (error) {
      /*
       * A 404 on the SOURCE means it is already gone, and in this run the only
       * thing that removes a source is this loop — `plan` never queues a move
       * for an id the store did not report. So the rename landed and the
       * failure is on the way back; a run of 629 saw exactly one, where
       * Cloudinary had done the work and the client still threw.
       *
       * Treating it as done is not optimism, it is the same reasoning that
       * makes the whole script resumable: an asset at its destination is
       * finished, however it got there.
       */
      if (isMissing(error)) {
        console.warn(`  ~ ${move.from} was already gone; treating as renamed`)
      } else {
        fail(
          `renaming ${move.from} → ${move.to} failed after ${done} of ` +
            `${moves.length}: ${describeError(error)}\n  Nothing has been ` +
            `written to the snapshots, so the site is unchanged. Run this again ` +
            `to resume — the assets already moved will be recognised as done.`
        )
      }
    }
    done += 1
    if (done % 50 === 0) console.log(`  renamed ${done}/${moves.length}`)
  }
  console.log(`✓ renamed ${done} asset(s)`)

  /*
   * A failed FOLDER move does not abort. It changes nothing a URL depends on —
   * only where the Media Library files the asset — so one refusal should not
   * cost the run the snapshot write that the renames above are waiting for.
   */
  let moved = 0
  const unfiled: string[] = []
  for (const f of needsFolder) {
    try {
      await setAssetFolder(f.id, f.folder, displayNameOf(f.id), f.resourceType)
      moved += 1
    } catch (error) {
      unfiled.push(`${f.id}: ${describeError(error)}`)
    }
    if ((moved + unfiled.length) % 100 === 0) {
      console.log(`  filed ${moved + unfiled.length}/${needsFolder.length}`)
    }
  }
  console.log(`✓ filed ${moved} asset(s) into folders`)
  if (unfiled.length > 0) {
    console.warn(`  ! ${unfiled.length} could not be filed (ids and URLs unaffected):`)
    for (const line of unfiled.slice(0, 10)) console.warn(`    ${line}`)
  }

  if (PRUNE && orphans.length > 0) {
    // After the renames, so nothing still being moved is in this set, and
    // before the snapshot write, so a failure here leaves the ids untouched.
    const removed =
      (await deleteAssets(orphanImages, 'image')) +
      (await deleteAssets(orphanVideos, 'video'))
    console.log(`✓ deleted ${removed} of ${orphans.length} unreferenced asset(s)`)
  }

  /*
   * The snapshots last, and only after every rename has returned. Until this
   * write lands the site still points at the old ids — which is the correct
   * failure: a half-renamed store with an unchanged snapshot renders the
   * assets that have not moved yet and is fixed by running this again.
   */
  if (renamed.size > 0) {
    await uploadJson(PHOTOS, photos)
    await uploadJson(THREADS, threads)

    if (hashes) {
      // The dedup map's VALUES are public ids. Miss these and the next photo
      // sync sees every hash pointing at an id that no longer exists, decides
      // nothing is cached, and re-uploads the entire channel.
      const next: Record<string, string> = {}
      for (const [hash, id] of Object.entries(hashes)) next[hash] = renamed.get(id) ?? id
      await uploadJson(HASHES, next)
    }
    console.log(`✓ rewrote ${renamed.size} id(s) across the snapshots`)
  }

  console.log('\n✓ done. Re-run to confirm it reports nothing left to do.')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
