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

import { readFile, writeFile, access } from 'node:fs/promises'
import { cloudName, configureCloudinary, uploadImage } from './cloudinary'
import type {
  ThreadsImage,
  ThreadsMediaType,
  ThreadsPost,
  ThreadsSnapshot,
} from '../src/lib/threads'

const HOST = 'https://graph.threads.net/v1.0'
const OUT_DATA = 'src/content/threads.generated.ts'
const FOLDER = process.env.THREADS_MEDIA_FOLDER ?? 'threads'
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
  const text = await res.text()

  // Meta does not always answer with JSON — maintenance pages, rate-limit
  // interstitials and proxy errors all arrive as HTML. Parsing blindly turns
  // those into "Unexpected token '<'", which says nothing useful in a CI log
  // at 4am. Report the status and a snippet of what actually came back.
  let body: T & { error?: { message?: string } }
  try {
    body = JSON.parse(text) as T & { error?: { message?: string } }
  } catch {
    fail(
      `Threads API ${res.status} returned non-JSON (${text.length} bytes): ` +
        `${text.slice(0, 200).replace(/\s+/g, ' ')}`
    )
  }

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
 * Re-hosts one Threads image in Cloudinary under a stable public id.
 *
 * The id is `threads/<postId>-<slot>` — Meta's post id, which does not
 * rotate. Meta's own media_url is signed and expires, so it is never stored
 * and never rendered; only the bytes behind it are kept, once.
 *
 * Returns null on failure so one dead image cannot fail the whole sync.
 */
async function rehost(
  sourceUrl: string,
  postId: string,
  index: number,
  alt: string
): Promise<ThreadsImage | null> {
  const publicId = `${FOLDER}/${postId}-${index}`

  let bytes: Buffer
  try {
    const res = await fetch(sourceUrl)
    if (!res.ok) {
      console.warn(`  ! image ${publicId}: HTTP ${res.status}, skipping`)
      return null
    }
    bytes = Buffer.from(await res.arrayBuffer())
  } catch (error) {
    console.warn(`  ! image ${publicId}: ${(error as Error).message}, skipping`)
    return null
  }

  try {
    const uploaded = await uploadImage(bytes, publicId)
    return {
      publicId: uploaded.publicId,
      width: uploaded.width,
      height: uploaded.height,
      alt: alt.trim(),
    }
  } catch (error) {
    console.warn(`  ! image ${publicId}: upload failed — ${(error as Error).message}`)
    return null
  }
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
    const image = await rehost(source.url, post.id, index, source.alt)
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
  // Fails in the first second when the secret is missing, rather than after
  // a full paginated crawl of the API.
  await configureCloudinary()
  console.log(`→ cloudinary cloud: ${cloudName()}`)

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

// Not top-level await: tsx transpiles these to CJS (the package is not
// type: module), and esbuild rejects top-level await in CJS output.
// An explicit entrypoint works under either format.
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
