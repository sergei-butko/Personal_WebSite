/**
 * Pulls your own Threads posts and writes src/content/threads.generated.ts.
 *
 *   THREADS_ACCESS_TOKEN=... npm run sync:threads
 *
 * Design notes, because the failure modes matter more than the happy path:
 *
 * - Images are DOWNLOADED, not hotlinked. Meta's media_url values are signed
 *   and expire; linking them means silently broken images in a few weeks.
 * - The generated file is COMMITTED. If this script fails, the site still
 *   builds from the last good snapshot. A broken sync is an annoyance, not
 *   an outage.
 * - Nothing is written unless the whole run succeeds. A partial snapshot is
 *   worse than a stale one.
 * - Already-downloaded images are skipped, so reruns are cheap.
 *
 * Docs: https://developers.facebook.com/docs/threads/threads-media
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import type {
  ThreadsImage,
  ThreadsImageVariant,
  ThreadsMediaType,
  ThreadsPost,
  ThreadsSnapshot,
} from '../src/lib/threads'

const HOST = 'https://graph.threads.net/v1.0'
const OUT_DATA = 'src/content/threads.generated.ts'
const OUT_IMAGES = 'public/images/threads'
const PUBLIC_PREFIX = '/images/threads'
const WIDTHS = [400, 800, 1200]
const PAGE_SIZE = 100

const FIELDS = [
  'id',
  'media_type',
  'media_url',
  'permalink',
  'text',
  'timestamp',
  'alt_text',
  'is_quote_post',
  'has_replies',
  'children{id,media_type,media_url,alt_text}',
].join(',')

interface ApiChild {
  id: string
  media_type?: string
  media_url?: string
  alt_text?: string
}

interface ApiPost {
  id: string
  media_type?: string
  media_url?: string
  permalink?: string
  text?: string
  timestamp?: string
  alt_text?: string
  is_quote_post?: boolean
  has_replies?: boolean
  children?: { data?: ApiChild[] }
}

interface ApiPage {
  data?: ApiPost[]
  paging?: { cursors?: { after?: string }; next?: string }
  error?: { message?: string; type?: string; code?: number }
}

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

const token = process.env.THREADS_ACCESS_TOKEN
if (!token) fail('THREADS_ACCESS_TOKEN is not set.')

async function getJson<T>(url: URL): Promise<T> {
  const res = await fetch(url)
  const body = (await res.json()) as T & { error?: { message?: string } }
  if (!res.ok) {
    fail(`Threads API ${res.status}: ${body.error?.message ?? JSON.stringify(body)}`)
  }
  return body
}

async function fetchUsername(): Promise<string> {
  const url = new URL(`${HOST}/me`)
  url.searchParams.set('fields', 'username')
  url.searchParams.set('access_token', token!)
  const me = await getJson<{ username?: string }>(url)
  if (!me.username)
    fail('Could not read username — is the token valid and threads_basic granted?')
  return me.username
}

/** Walks every page of /me/threads. Stops on the first page without a cursor. */
async function fetchAllPosts(): Promise<ApiPost[]> {
  const posts: ApiPost[] = []
  let after: string | undefined

  for (let page = 1; ; page++) {
    const url = new URL(`${HOST}/me/threads`)
    url.searchParams.set('fields', FIELDS)
    url.searchParams.set('limit', String(PAGE_SIZE))
    url.searchParams.set('access_token', token!)
    if (after) url.searchParams.set('after', after)

    const body = await getJson<ApiPage>(url)
    const batch = body.data ?? []
    posts.push(...batch)
    console.log(`  page ${page}: ${batch.length} posts (${posts.length} total)`)

    after = body.paging?.cursors?.after
    if (!after || batch.length === 0) break
    if (page > 200) fail('Pagination exceeded 200 pages — refusing to loop forever.')
  }

  return posts
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

/**
 * Downloads one image and emits AVIF + WebP at every width up to the
 * original. Never upscales — a 500px source yields only the 400px variant
 * plus its own size.
 */
async function processImage(
  sourceUrl: string,
  postId: string,
  index: number,
  alt: string
): Promise<ThreadsImage | null> {
  const hash = createHash('sha1').update(sourceUrl).digest('hex').slice(0, 8)
  const stem = `${postId}-${index}-${hash}`

  let original: Buffer
  const probe = path.join(OUT_IMAGES, `${stem}-meta.json`)

  if (await exists(probe)) {
    // Already processed on an earlier run; reuse the recorded dimensions.
    const cached = JSON.parse(await readFile(probe, 'utf8')) as ThreadsImage
    return cached
  }

  try {
    const res = await fetch(sourceUrl)
    if (!res.ok) {
      console.warn(`  ! image ${stem}: HTTP ${res.status}, skipping`)
      return null
    }
    original = Buffer.from(await res.arrayBuffer())
  } catch (error) {
    console.warn(`  ! image ${stem}: ${(error as Error).message}, skipping`)
    return null
  }

  const image = sharp(original)
  const meta = await image.metadata()
  if (!meta.width || !meta.height) {
    console.warn(`  ! image ${stem}: unreadable dimensions, skipping`)
    return null
  }

  const targets = WIDTHS.filter((w) => w < meta.width!)
  targets.push(meta.width)

  const webp: ThreadsImageVariant[] = []
  const avif: ThreadsImageVariant[] = []

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
  const scale = largest / meta.width
  const result: ThreadsImage = {
    src: `${PUBLIC_PREFIX}/${stem}-${largest}.webp`,
    webp,
    avif,
    width: largest,
    height: Math.round(meta.height * scale),
    alt: alt.trim(),
  }

  await writeFile(probe, JSON.stringify(result, null, 2))
  return result
}

async function normalise(post: ApiPost): Promise<ThreadsPost | null> {
  if (!post.permalink || !post.timestamp) {
    console.warn(`  ! post ${post.id}: missing permalink or timestamp, skipping`)
    return null
  }

  // Carousels expose their images as children; single-image posts do not.
  const sources: Array<{ url: string; alt: string }> = []
  const children = post.children?.data ?? []

  if (children.length > 0) {
    for (const child of children) {
      if (child.media_url)
        sources.push({ url: child.media_url, alt: child.alt_text ?? '' })
    }
  } else if (post.media_url && post.media_type === 'IMAGE') {
    sources.push({ url: post.media_url, alt: post.alt_text ?? '' })
  }

  const images: ThreadsImage[] = []
  for (const [index, source] of sources.entries()) {
    const image = await processImage(source.url, post.id, index, source.alt)
    if (image) images.push(image)
  }

  return {
    id: post.id,
    permalink: post.permalink,
    timestamp: new Date(post.timestamp).toISOString(),
    mediaType: (post.media_type ?? 'TEXT_POST') as ThreadsMediaType,
    text: (post.text ?? '').trim(),
    images,
    isQuotePost: Boolean(post.is_quote_post),
    hasReplies: Boolean(post.has_replies),
  }
}

function render(snapshot: ThreadsSnapshot): string {
  return `import type { ThreadsSnapshot } from '@/lib/threads'

/**
 * GENERATED FILE — do not edit by hand.
 * Written by \`npm run sync:threads\`, and committed deliberately.
 *
 * Committing it means the site still builds when the Threads API is down,
 * rate-limited, or the token has expired. A failed sync stops new posts
 * from appearing; it never takes the site down.
 */
export const threadsSnapshot: ThreadsSnapshot = ${JSON.stringify(snapshot, null, 2)}
`
}

async function main(): Promise<void> {
  await mkdir(OUT_IMAGES, { recursive: true })

  console.log('→ resolving account')
  const username = await fetchUsername()
  console.log(`  @${username}`)

  console.log('→ fetching posts')
  const raw = await fetchAllPosts()

  console.log('→ processing media')
  const posts: ThreadsPost[] = []
  for (const post of raw) {
    const normalised = await normalise(post)
    if (normalised) posts.push(normalised)
  }

  // Newest first, and stable — the API order is not guaranteed.
  posts.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  if (posts.length === 0) {
    fail('No usable posts returned. Refusing to overwrite the snapshot with nothing.')
  }

  const snapshot: ThreadsSnapshot = {
    syncedAt: new Date().toISOString(),
    username,
    posts,
  }

  // Compare ignoring syncedAt, so an unchanged feed produces no git diff
  // and the workflow does not commit noise every six hours.
  const next = render(snapshot)
  const previous = (await exists(OUT_DATA)) ? await readFile(OUT_DATA, 'utf8') : ''
  const strip = (s: string) => s.replace(/"syncedAt": "[^"]*"/, '')

  if (strip(next) === strip(previous)) {
    console.log(`✓ ${posts.length} posts, no change`)
    return
  }

  await writeFile(OUT_DATA, next)
  console.log(`✓ ${posts.length} posts written to ${OUT_DATA}`)
}

await main()
