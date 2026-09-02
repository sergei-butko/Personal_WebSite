/**
 * Removes Cloudinary's own demo assets from the account.
 *
 *     npm run media:clean-demo                    # list them, delete nothing
 *     CONFIRM_DELETE=1 npm run media:clean-demo   # delete
 *
 * Every Cloudinary account is seeded with sample images — `sample`,
 * `cld-sample-*`, `main-sample`, and a `samples/` tree of stock photographs and
 * textures. Nothing here references them and they cost storage on the free
 * plan, where 57 of them were once 164 MB and 39% of the account.
 *
 * They come BACK. They were deleted once on 2026-08-31 and a different, smaller
 * set had reappeared by 2026-09-02 — Cloudinary re-seeds when the console's
 * media playground is used. Hence a command rather than a third one-off script.
 *
 * ## Why this is not part of media:organise
 *
 * `media:organise` deliberately never touches anything outside `telegram/` and
 * `threads/`, and `MEDIA_PRUNE` is scoped the same way. A sync has no business
 * deciding that an asset it did not upload should go. This is a separate,
 * manual act on the account itself, so it is a separate command.
 *
 * ## What counts as a demo asset
 *
 * An asset with NO `asset_folder` that is not under one of the managed public
 * id prefixes. Filing something in a folder is what protects it — which is
 * exactly what `media:organise` did to the photographs, and what the Media
 * Library does when you upload into a folder by hand.
 *
 * The consequence worth knowing: something uploaded to the ROOT of the Media
 * Library, in no folder at all, looks identical to a demo asset from here. That
 * is why nothing is deleted without CONFIRM_DELETE=1 and why the full list is
 * printed first. Put your own uploads in a folder — the logos in `public/` are
 * safe precisely because they are in one, even though their public ids sit at
 * the root.
 */

import { deleteAssets, listAssets, type ResourceType } from './cloudinary'

/** Public id prefixes the syncs own. */
const MANAGED = ['telegram/', 'threads/', 'data/']

const CONFIRM = process.env.CONFIRM_DELETE === '1'

interface Candidate {
  publicId: string
  resourceType: ResourceType
  bytes: number
}

async function main(): Promise<void> {
  const candidates: Candidate[] = []
  const keptByFolder = new Map<string, [number, number]>()

  for (const resourceType of ['image', 'video', 'raw'] as const) {
    for (const asset of await listAssets(resourceType)) {
      const managed = MANAGED.some((prefix) => asset.publicId.startsWith(prefix))
      if (managed || asset.assetFolder) {
        const key = asset.assetFolder || '(no folder, managed prefix)'
        const [n, b] = keptByFolder.get(key) ?? [0, 0]
        keptByFolder.set(key, [n + 1, b + asset.bytes])
        continue
      }
      candidates.push({ publicId: asset.publicId, resourceType, bytes: asset.bytes })
    }
  }

  console.log('keeping:')
  for (const [folder, [n, b]] of [...keptByFolder].sort()) {
    console.log(
      `  ${folder.padEnd(30)} ${String(n).padStart(3)} assets  ${(b / 1048576).toFixed(1)} MB`
    )
  }

  if (candidates.length === 0) {
    console.log('\n✓ no demo assets on the account')
    return
  }

  const total = candidates.reduce((sum, c) => sum + c.bytes, 0)
  console.log(
    `\n${candidates.length} demo asset(s), ${(total / 1048576).toFixed(1)} MB` +
      `${CONFIRM ? ' — DELETING' : ''}:`
  )
  // All of them, never a truncated sample: this list is the only record of what
  // a run removed, and these are assets nothing else in the repo knows about.
  for (const c of candidates) {
    console.log(
      `  ${c.resourceType.padEnd(5)} ${c.publicId.padEnd(40)} ${(c.bytes / 1024).toFixed(0)} KB`
    )
  }

  if (!CONFIRM) {
    console.log('\n→ nothing deleted. Re-run with CONFIRM_DELETE=1 to remove them.')
    return
  }

  let removed = 0
  for (const resourceType of ['image', 'video', 'raw'] as const) {
    const ids = candidates
      .filter((c) => c.resourceType === resourceType)
      .map((c) => c.publicId)
    if (ids.length === 0) continue
    removed += await deleteAssets(ids, resourceType)
  }
  console.log(`\n✓ deleted ${removed} of ${candidates.length}`)
  if (removed !== candidates.length) {
    console.warn('  ! some were not removed; re-run to see what is left')
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
