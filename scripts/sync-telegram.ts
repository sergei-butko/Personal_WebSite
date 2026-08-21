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
import { parseChannelPage, type ParsedPost } from './telegram-parse'
import { cloudName, configureCloudinary, uploadImage } from './cloudinary'
import type { Photo, PhotoSnapshot } from '../src/lib/photos'

const CHANNEL = process.env.TELEGRAM_CHANNEL ?? 'just_my_photos'
const OUT_DATA = 'src/content/photos.generated.ts'
const FOLDER = process.env.TELEGRAM_MEDIA_FOLDER ?? 'telegram'

/** Re-upload everything, ignoring the snapshot cache. */
const FORCE = process.env.SYNC_FORCE === '1'

/** Safety rails. A runaway loop here would download the whole channel twice. */
const MAX_PAGES = Number(process.env.SYNC_MAX_PAGES ?? 40)
const MAX_PHOTOS = Number(process.env.SYNC_MAX_PHOTOS ?? 400)

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
      console.warn(
        `  ! stopped at the ${MAX_PAGES}-page cap; older posts were not fetched. ` +
          `Raise SYNC_MAX_PAGES to go further back.`
      )
    }
    before = parsed.nextBefore
  }

  return posts
}

/**
 * Fetches one image from Telegram and re-hosts it under a stable public id.
 * Returns null on a fetch failure so one dead image cannot fail the run.
 */
async function rehost(
  url: string,
  postId: number,
  index: number
): Promise<{ publicId: string; width: number; height: number } | null> {
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

  try {
    return await uploadImage(bytes, publicId)
  } catch (error) {
    console.warn(`  ! ${publicId}: upload failed — ${(error as Error).message}`)
    return null
  }
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
  console.log(
    `→ ${known.size} photos already uploaded${FORCE ? ' (ignored: SYNC_FORCE=1)' : ''}`
  )

  console.log(`→ reading t.me/s/${CHANNEL}`)
  const posts = await collectPosts()

  console.log('→ re-hosting photos')
  const photos: Photo[] = []
  let capped = false
  let uploaded = 0
  let cached = 0

  for (const post of posts) {
    for (const [index, image] of post.images.entries()) {
      if (photos.length >= MAX_PHOTOS) {
        capped = true
        break
      }

      const publicId = publicIdFor(post.id, index)
      const hit = known.get(publicId)

      const media = hit
        ? { publicId, width: hit.width, height: hit.height }
        : await rehost(image.url, post.id, index)

      if (!media) continue
      if (hit) cached++
      else uploaded++

      photos.push({
        id: post.id,
        permalink: post.permalink,
        timestamp: post.timestamp,
        caption: post.caption,
        ...media,
      })
    }
    if (capped) break
  }

  if (capped) {
    console.warn(
      `  ! stopped at the ${MAX_PHOTOS}-photo cap. Older photos were not processed. ` +
        `Raise SYNC_MAX_PHOTOS if you want the whole channel.`
    )
  }

  console.log(`  ${uploaded} uploaded, ${cached} already in Cloudinary`)

  if (photos.length === 0) {
    fail('No photos parsed. Refusing to overwrite the snapshot with nothing.')
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
