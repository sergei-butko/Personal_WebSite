/**
 * Mirrors a public Telegram channel's photos into the repo.
 *
 *   npm run sync:photos
 *
 * Reads t.me/s/<channel>, which is a plain public preview page — no API key,
 * no token, no bot. Walks backwards through history via ?before=, downloads
 * every photo, re-encodes to AVIF + WebP at several widths, and writes
 * src/content/photos.generated.ts.
 *
 * Why it is built this way:
 *
 * - Images are DOWNLOADED. Telegram's telesco.pe URLs are signed and expire;
 *   linking them means silently broken images in a few weeks.
 * - The generated file is COMMITTED. If Telegram changes its markup or is
 *   unreachable, the site still builds from the last good snapshot.
 * - Nothing is written unless the run succeeds, and an empty result never
 *   overwrites a good snapshot.
 * - Already-processed images are skipped, so reruns are cheap and the cron
 *   does not re-encode the whole channel every six hours.
 * - photo-meta.ts is never touched. Hand-written captions and alt text are
 *   yours permanently.
 *
 * Parsing lives in telegram-parse.ts and is covered by `npm run test:telegram`
 * against a saved fixture, so a markup change fails loudly and locally.
 */

import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { parseChannelPage, type ParsedPost } from './telegram-parse'
import type { Photo, PhotoSnapshot, PhotoVariant } from '../src/lib/photos'

const CHANNEL = process.env.TELEGRAM_CHANNEL ?? 'just_my_photos'
const OUT_DATA = 'src/content/photos.generated.ts'
const OUT_IMAGES = 'public/images/photos'
const PUBLIC_PREFIX = '/images/photos'
const WIDTHS = [400, 800, 1600]

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
 * Downloads one image and emits AVIF + WebP at every width up to the
 * original. Never upscales. A sidecar JSON records the result so reruns skip
 * the download and the re-encode entirely.
 */
async function processImage(url: string, postId: number, index: number) {
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 8)
  const stem = `${postId}-${index}-${hash}`
  const sidecar = path.join(OUT_IMAGES, `${stem}.json`)

  if (await exists(sidecar)) {
    return JSON.parse(await readFile(sidecar, 'utf8')) as {
      src: string
      webp: PhotoVariant[]
      avif: PhotoVariant[]
      width: number
      height: number
    }
  }

  let original: Buffer
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA } })
    if (!res.ok) {
      console.warn(`  ! ${stem}: HTTP ${res.status}, skipping`)
      return null
    }
    original = Buffer.from(await res.arrayBuffer())
  } catch (error) {
    console.warn(`  ! ${stem}: ${(error as Error).message}, skipping`)
    return null
  }

  const meta = await sharp(original).metadata()
  if (!meta.width || !meta.height) {
    console.warn(`  ! ${stem}: unreadable dimensions, skipping`)
    return null
  }

  const targets = WIDTHS.filter((w) => w < meta.width!)
  targets.push(meta.width)

  const webp: PhotoVariant[] = []
  const avif: PhotoVariant[] = []
  for (const width of targets) {
    const resized = sharp(original).resize({ width, withoutEnlargement: true })
    await resized
      .clone()
      .webp({ quality: 82 })
      .toFile(path.join(OUT_IMAGES, `${stem}-${width}.webp`))
    await resized
      .clone()
      .avif({ quality: 62 })
      .toFile(path.join(OUT_IMAGES, `${stem}-${width}.avif`))
    webp.push({ src: `${PUBLIC_PREFIX}/${stem}-${width}.webp`, width })
    avif.push({ src: `${PUBLIC_PREFIX}/${stem}-${width}.avif`, width })
  }

  const largest = targets[targets.length - 1]!
  const result = {
    src: `${PUBLIC_PREFIX}/${stem}-${largest}.webp`,
    webp,
    avif,
    width: largest,
    height: Math.round(meta.height * (largest / meta.width)),
  }
  await writeFile(sidecar, JSON.stringify(result, null, 2))
  return result
}

function render(snapshot: PhotoSnapshot): string {
  return `import type { PhotoSnapshot } from '@/lib/photos'

/**
 * GENERATED FILE — do not edit by hand.
 * Written by \`npm run sync:photos\`, and committed deliberately.
 *
 * Hand edits belong in photo-meta.ts, which the sync never touches.
 */
export const photoSnapshot: PhotoSnapshot = ${JSON.stringify(snapshot, null, 2)}
`
}

async function main(): Promise<void> {
  await mkdir(OUT_IMAGES, { recursive: true })

  console.log(`→ reading t.me/s/${CHANNEL}`)
  const posts = await collectPosts()

  console.log('→ processing photos')
  const photos: Photo[] = []
  let capped = false

  for (const post of posts) {
    for (const [index, image] of post.images.entries()) {
      if (photos.length >= MAX_PHOTOS) {
        capped = true
        break
      }
      const processed = await processImage(image.url, post.id, index)
      if (!processed) continue
      photos.push({
        id: post.id,
        permalink: post.permalink,
        timestamp: post.timestamp,
        caption: post.caption,
        ...processed,
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
  // and the six-hourly cron does not commit noise.
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
