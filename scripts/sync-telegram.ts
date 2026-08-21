/**
 * Mirrors a public Telegram channel's photos into Cloudinary.
 *
 *   npm run sync:photos
 *
 * Reads t.me/s/<channel>, which is a plain public preview page — no API key,
 * no token, no bot. Walks backwards through history via ?before=, uploads
 * every photo to Cloudinary, and writes src/content/photos.generated.ts.
 *
 * Why it is built this way:
 *
 * - Images are RE-HOSTED, not linked. Telegram's telesco.pe URLs are signed
 *   and expire; linking them means silently broken images in a few weeks.
 * - Image bytes never touch the repository. Cloudinary stores the original and
 *   derives every width and format on delivery, so there is no encode step,
 *   no variant files, and nothing to commit but the snapshot below.
 * - The public id is `telegram/<postId>-<slot>` — derived from Telegram's own
 *   message id, which is stable. A re-upload therefore REPLACES the asset.
 *   The version of this script that shipped before keyed on a sha1 of the
 *   signed source URL, which rotates on every fetch: the cache never hit,
 *   every run re-downloaded and re-encoded the whole channel under fresh
 *   filenames, and nothing was ever deleted. Thirteen runs turned 402 photos
 *   into 10,377 files and 827 MB. Keying on a stable id is the fix.
 * - The generated file is COMMITTED. If Telegram changes its markup or is
 *   unreachable, the site still builds from the last good snapshot.
 * - Nothing is written unless the run succeeds, and an empty result never
 *   overwrites a good snapshot.
 * - photo-meta.ts is never touched. Hand-written captions and alt text are
 *   yours permanently.
 *
 * Parsing lives in telegram-parse.ts and is covered by `npm run test:telegram`
 * against a saved fixture, so a markup change fails loudly and locally.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { parseChannelPage, type ParsedPost } from './telegram-parse'
import { decideAsset, type StoredSize } from './photo-dedup'
import {
  cloudName,
  configureCloudinary,
  deleteAssets,
  listAssetIds,
  uploadImage,
} from './cloudinary'
import type { Photo, PhotoSnapshot } from '../src/lib/photos'

const CHANNEL = process.env.TELEGRAM_CHANNEL ?? 'just_my_photos'
const OUT_DATA = 'src/content/photos.generated.ts'
const OUT_HASHES = 'src/content/photo-hashes.generated.ts'
const FOLDER = process.env.TELEGRAM_MEDIA_FOLDER ?? 'telegram'

/** Re-download and re-upload everything, ignoring both caches. */
const FORCE = process.env.SYNC_FORCE === '1'

/**
 * Delete Cloudinary assets under FOLDER that the new snapshot does not
 * reference. Opt-in, because it is the only destructive thing here.
 */
const PRUNE = process.env.SYNC_PRUNE === '1'

/**
 * No photo cap by default.
 *
 * It used to default to 400, and the channel has more than that. The walk goes
 * newest-first, so the cap silently dropped the OLDEST photos — 27 of them,
 * everything before message 38 — and said so only in a console warning nobody
 * was reading. Truncating an archive by default is the wrong default.
 */
const MAX_PHOTOS = Number(process.env.SYNC_MAX_PHOTOS ?? 0) || Infinity

/** Runaway guard on the pagination loop, not a content limit. */
const MAX_PAGES = Number(process.env.SYNC_MAX_PAGES ?? 200)

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

function publicIdFor(postId: number, index: number): string {
  return `${FOLDER}/${postId}-${index}`
}

/**
 * Photos already uploaded, from the committed snapshot.
 *
 * This is the cache, and it works only because the public id is stable. Miss
 * it and the run merely re-uploads to the same id — wasteful, never
 * duplicating.
 */
async function previouslyUploaded(): Promise<Map<string, Photo>> {
  const known = new Map<string, Photo>()
  if (FORCE || !(await exists(OUT_DATA))) return known

  try {
    const module_ = (await import('../src/content/photos.generated')) as {
      photoSnapshot?: PhotoSnapshot
    }
    for (const photo of module_.photoSnapshot?.photos ?? []) {
      known.set(photo.publicId, photo)
    }
  } catch (error) {
    // A snapshot in the old on-disk shape, or mid-migration, simply means no
    // cache. Say so rather than dying.
    console.warn(
      `  ! could not read the previous snapshot as a cache ` +
        `(${(error as Error).message}); every photo will be re-uploaded`
    )
  }
  return known
}

async function fetchPage(before?: number): Promise<string> {
  const url = new URL(`https://t.me/s/${CHANNEL}`)
  if (before !== undefined) url.searchParams.set('before', String(before))

  const res = await fetch(url, { headers: { 'user-agent': UA } })
  const html = await res.text()

  if (!res.ok) {
    fail(`t.me returned ${res.status} for ${url.pathname}${url.search}`)
  }
  // A private channel or a renamed handle still returns 200, just without any
  // messages. Say so plainly rather than reporting "0 photos".
  if (!html.includes('tgme_widget_message') && before === undefined) {
    fail(
      `No messages found at ${url}. The channel must be public for /s/ to render ` +
        `posts — check the handle and that the channel is not private.`
    )
  }
  return html
}

/** Walks history backwards until Telegram stops offering an older page. */
async function collectPosts(): Promise<ParsedPost[]> {
  const seen = new Set<number>()
  const posts: ParsedPost[] = []
  let before: number | undefined

  for (let page = 1; page <= MAX_PAGES; page++) {
    const parsed = parseChannelPage(await fetchPage(before))
    const fresh = parsed.posts.filter((post) => !seen.has(post.id))
    fresh.forEach((post) => seen.add(post.id))
    posts.push(...fresh)

    const images = fresh.reduce((sum, post) => sum + post.images.length, 0)
    console.log(`  page ${page}: ${fresh.length} posts, ${images} photos`)

    if (parsed.nextBefore === null || fresh.length === 0) break
    if (page === MAX_PAGES) {
      // Not a warning. Telegram still has older pages, so continuing would
      // write a snapshot missing the oldest photos — which is exactly the bug
      // this run exists to fix, and a warning is what let it ship.
      fail(
        `hit the ${MAX_PAGES}-page guard with older pages still available. ` +
          `Refusing to write a truncated snapshot. Raise SYNC_MAX_PAGES.`
      )
    }
    before = parsed.nextBefore
  }

  return posts
}

interface Rehosted {
  publicId: string
  width: number
  height: number
  /** True when the bytes matched an image already stored under another id. */
  deduped: boolean
}

/**
 * Fetches one image from Telegram and re-hosts it under a stable public id,
 * unless the same bytes are already stored — in which case it points at the
 * existing asset and uploads nothing.
 *
 * Distinctness is by sha256 of the file, not by URL: Telegram's URLs are
 * signed and differ per fetch even for identical images, which is what made
 * the original implementation duplicate everything.
 *
 * Returns null on a fetch failure so one dead image cannot fail the run.
 */
async function rehost(
  url: string,
  postId: number,
  index: number,
  hashes: Map<string, string>
): Promise<Rehosted | null> {
  const publicId = publicIdFor(postId, index)

  let bytes: Buffer
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA } })
    if (!res.ok) {
      console.warn(`  ! ${publicId}: HTTP ${res.status} from Telegram, skipping`)
      return null
    }
    bytes = Buffer.from(await res.arrayBuffer())
  } catch (error) {
    console.warn(`  ! ${publicId}: ${(error as Error).message}, skipping`)
    return null
  }

  const hash = createHash('sha256').update(bytes).digest('hex')
  const decision = decideAsset(hash, publicId, hashes, uploadedDimensions)

  if (decision.kind === 'reuse') {
    return {
      publicId: decision.publicId,
      width: decision.width,
      height: decision.height,
      deduped: true,
    }
  }

  try {
    const uploaded = await uploadImage(bytes, publicId)
    hashes.set(hash, uploaded.publicId)
    uploadedDimensions.set(uploaded.publicId, uploaded)
    return { ...uploaded, deduped: false }
  } catch (error) {
    console.warn(`  ! ${publicId}: upload failed — ${(error as Error).message}`)
    return null
  }
}

/** Known public id → size, from the snapshot plus whatever this run uploads. */
const uploadedDimensions = new Map<string, StoredSize>()

/** The committed content-hash map, or an empty one on first run. */
async function loadHashes(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!(await exists(OUT_HASHES))) return map
  try {
    const module_ = (await import('../src/content/photo-hashes.generated')) as {
      photoHashes?: Record<string, string>
    }
    for (const [hash, publicId] of Object.entries(module_.photoHashes ?? {})) {
      map.set(hash, publicId)
    }
  } catch (error) {
    console.warn(`  ! could not read ${OUT_HASHES} (${(error as Error).message})`)
  }
  return map
}

function renderHashes(hashes: Map<string, string>): string {
  const sorted = Object.fromEntries(
    [...hashes.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
  )
  return `/**
 * GENERATED FILE — do not edit by hand.
 * Written by \`npm run sync:photos\`, and committed deliberately.
 *
 * Maps the sha256 of an image's bytes to the Cloudinary public id it is
 * stored under. This is what makes the sync store DISTINCT images: the same
 * photo posted twice gets two entries in the snapshot — both posts are real —
 * but only one asset.
 *
 * Kept out of photos.generated.ts on purpose. Content hashes are a concern of
 * the sync, not of the site, and nothing under src/lib or src/components
 * reads this.
 */
export const photoHashes: Record<string, string> = ${JSON.stringify(sorted, null, 2)}
`
}

function render(snapshot: PhotoSnapshot): string {
  return `import type { PhotoSnapshot } from '@/lib/photos'

/**
 * GENERATED FILE — do not edit by hand.
 * Written by \`npm run sync:photos\`, and committed deliberately.
 *
 * publicId is a Cloudinary id, not a path. The image bytes live in Cloudinary;
 * this file is the only thing about them that is in git.
 *
 * Hand edits belong in photo-meta.ts, which the sync never touches.
 */
export const photoSnapshot: PhotoSnapshot = ${JSON.stringify(snapshot, null, 2)}
`
}

async function main(): Promise<void> {
  // Before any network work: a missing secret should cost one second, not a
  // few hundred downloads.
  await configureCloudinary()
  console.log(`→ cloudinary cloud: ${cloudName()}`)

  const known = await previouslyUploaded()
  const hashes = await loadHashes()
  console.log(
    `→ ${known.size} photos already uploaded, ${hashes.size} content hashes known` +
      `${FORCE ? ' (both ignored: SYNC_FORCE=1)' : ''}`
  )
  for (const photo of known.values()) {
    uploadedDimensions.set(photo.publicId, { width: photo.width, height: photo.height })
  }

  console.log(`→ reading t.me/s/${CHANNEL}`)
  const posts = await collectPosts()

  const available = posts.reduce((sum, post) => sum + post.images.length, 0)
  console.log(`→ re-hosting ${available} photos from ${posts.length} posts`)

  const photos: Photo[] = []
  let capped = false
  let uploaded = 0
  let cached = 0
  let deduped = 0

  for (const post of posts) {
    for (const [index, image] of post.images.entries()) {
      if (photos.length >= MAX_PHOTOS) {
        capped = true
        break
      }

      const publicId = publicIdFor(post.id, index)
      const hit = known.get(publicId)

      const media = hit
        ? { publicId: hit.publicId, width: hit.width, height: hit.height, deduped: false }
        : await rehost(image.url, post.id, index, hashes)

      if (!media) continue
      if (hit) cached++
      else if (media.deduped) deduped++
      else uploaded++

      photos.push({
        id: post.id,
        permalink: post.permalink,
        timestamp: post.timestamp,
        caption: post.caption,
        publicId: media.publicId,
        width: media.width,
        height: media.height,
      })
    }
    if (capped) break
  }

  if (capped) {
    console.warn(
      `  ! stopped at the SYNC_MAX_PHOTOS=${MAX_PHOTOS} cap, with ${available} available. ` +
        `The walk is newest-first, so what was dropped is the OLDEST photos. ` +
        `Unset SYNC_MAX_PHOTOS to take the whole channel.`
    )
  }

  console.log(
    `  ${uploaded} uploaded, ${deduped} matched an image already stored, ` +
      `${cached} unchanged`
  )

  if (photos.length === 0) {
    fail('No photos parsed. Refusing to overwrite the snapshot with nothing.')
  }

  const distinct = new Set(photos.map((photo) => photo.publicId))
  console.log(`  ${photos.length} photos → ${distinct.size} distinct assets`)

  await writeFile(OUT_HASHES, renderHashes(hashes))

  if (PRUNE) {
    console.log(`→ pruning ${FOLDER}/`)
    const stored = await listAssetIds(`${FOLDER}/`)
    const orphans = stored.filter((id) => !distinct.has(id))
    if (orphans.length === 0) {
      console.log('  nothing to prune')
    } else {
      // Print before deleting. This is the only destructive step in the sync
      // and the log is the only record of what it removed.
      for (const id of orphans) console.log(`  - ${id}`)
      const removed = await deleteAssets(orphans)
      console.log(`  deleted ${removed} of ${orphans.length} unreferenced assets`)
    }
  }

  photos.sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id - a.id)

  const next = render({
    syncedAt: new Date().toISOString(),
    channel: CHANNEL,
    photos,
  })

  // Ignore syncedAt when comparing, so an unchanged channel produces no diff
  // and the cron does not commit noise.
  const previous = (await exists(OUT_DATA)) ? await readFile(OUT_DATA, 'utf8') : ''
  const strip = (s: string) => s.replace(/"syncedAt": "[^"]*"/, '')

  if (strip(next) === strip(previous)) {
    console.log(`✓ ${photos.length} photos, no change`)
    return
  }

  await writeFile(OUT_DATA, next)
  console.log(`✓ ${photos.length} photos written to ${OUT_DATA}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
