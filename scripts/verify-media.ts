/**
 * Checks that every asset the live snapshots point at actually exists.
 *
 *     npm run media:verify
 *
 * ## The failure this exists to catch
 *
 * A snapshot row naming an asset that is not in Cloudinary is invisible
 * everywhere it could be caught. `npm run content:push` validates the row's
 * SHAPE, and a public id that is a well-formed string passes. The build fetches
 * the snapshot and reads ids out of it without ever asking whether they resolve.
 * `next build` goes green, CI goes green, and the page ships a broken <img> —
 * the same shape of outcome as a green build with an empty gallery, which the
 * rest of this repo goes out of its way to make impossible.
 *
 * It happened on 2026-09-02. Seven bottle photographs were added by hand
 * through the Cloudinary Media Library, which files an upload in the folder you
 * chose but names it with a generated UUID unless you set the public id
 * yourself. The delivery URL is built from the public id alone, so the bytes
 * were on the account, in the right folder, under the right display name — and
 * every one of the seven rows pointing at them 404'd. Nothing said so.
 *
 * That is the check below: not "is the folder right" but "does the id resolve".
 *
 * ## Why the Admin API and not the delivery URL
 *
 * Asking res.cloudinary.com for each image would also prove the CDN serves it,
 * which is strictly more than this does. It is also 632 assets against four
 * srcset widths each, and a derived URL that has never been requested is
 * generated on demand — so the probe itself would build 2,500 derivatives.
 * Listing the store is a handful of Admin API calls and answers the question
 * that actually differs between a working page and a broken one.
 *
 * The Admin API is capped at 500 requests an hour on this plan. Listing is
 * paginated at 500 assets, so a full run is under ten calls — see the note on
 * `listAssets`, and do not be tempted to look assets up one at a time.
 */

import { type ResourceType, fetchJson, listAssets } from './cloudinary'
import {
  type Reference,
  type TypedAsset,
  inspect,
  photoReferences,
  threadsReferences,
} from './media-audit'
import type { PhotoSnapshot } from '../src/lib/photos/types'
import type { ThreadsSnapshot } from '../src/lib/threads/types'

const PHOTOS = 'data/photos.json'
const THREADS = 'data/threads.json'

/*
 * An asset plus the resource type it was listed under. Carried rather than
 * inferred: audio lives under `video`, and `telegram/audio/554` is
 * indistinguishable from an image by its name alone.
 */
async function collect(resourceType: ResourceType): Promise<TypedAsset[]> {
  const rows = await listAssets(resourceType)
  return rows.map((row) => ({ ...row, resourceType }))
}

async function main(): Promise<void> {
  const [threads, photos] = await Promise.all([
    fetchJson<ThreadsSnapshot>(THREADS),
    fetchJson<PhotoSnapshot>(PHOTOS),
  ])

  const references: Reference[] = [
    // A 404 on a snapshot is not an error anywhere else in this repo — it means
    // that sync has never run — and it is not one here either.
    ...(threads ? threadsReferences(threads) : []),
    ...(photos ? photoReferences(photos) : []),
  ]

  const assets = [...(await collect('image')), ...(await collect('video'))]
  const report = inspect(references, assets)

  console.log(
    `→ ${references.length} references checked against ${assets.length} assets\n`
  )

  if (report.stranded.length > 0) {
    console.error(`✗ ${report.stranded.length} asset(s) filed in a managed folder`)
    console.error(`  under an id nothing can reach. A Media Library upload names`)
    console.error(`  an asset with a UUID unless you set the public id yourself:`)
    for (const asset of report.stranded) {
      console.error(
        `    ${asset.publicId}  [folder ${asset.assetFolder}, name "${asset.publicId}"]`
      )
    }
    console.error('')
  }

  if (report.missing.length > 0) {
    console.error(`✗ ${report.missing.length} reference(s) point at nothing:`)
    for (const ref of report.missing) {
      console.error(`    ${ref.publicId}\n      ${ref.where}`)
    }
    console.error('')
  }

  // Neither of the two below breaks a page, so neither fails the run. They are
  // printed because a run that says nothing about them looks like a run that
  // did not look.
  if (report.misfiled.length > 0) {
    console.log(`! ${report.misfiled.length} asset(s) filed away from their id.`)
    console.log(
      `  Cosmetic — the delivery URL is the id. "npm run media:organise" repairs it.`
    )
  }
  if (report.orphaned.length > 0) {
    console.log(`! ${report.orphaned.length} asset(s) no snapshot references.`)
    console.log(`  Storage only. "MEDIA_PRUNE=1 npm run media:organise" removes them.`)
  }

  if (report.missing.length > 0 || report.stranded.length > 0) {
    console.error('✗ Media is not consistent with the snapshots.')
    process.exit(1)
  }

  console.log('✓ Every referenced asset is present.')
}

main().catch((error: unknown) => {
  // The Cloudinary SDK rejects with a plain object rather than an Error, so a
  // bare rethrow prints "#<Object>" and says nothing about what failed.
  const detail = (error as { error?: unknown })?.error ?? error
  console.error('✗ media:verify failed:', detail)
  process.exit(1)
})
