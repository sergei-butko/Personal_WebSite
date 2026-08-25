/**
 * Pulls your own Threads posts and writes data/threads.json to Cloudinary.
 *
 *   THREADS_ACCESS_TOKEN=... npm run sync:threads
 *
 * Design notes, because the failure modes matter more than the happy path:
 *
 * - Images are DOWNLOADED, not hotlinked. Meta's media_url values are signed
 *   and expire; linking them means silently broken images in a few weeks.
 * - The snapshot is stored in CLOUDINARY, not in git, so a sync produces no
 *   commit. The build fetches it. That means a broken sync leaves the last
 *   good snapshot in place, but an unreachable Cloudinary fails the build —
 *   see src/lib/snapshot.ts for why that is the chosen failure mode.
 * - Nothing is written unless the whole run succeeds. A partial snapshot is
 *   worse than a stale one.
 * - Already-downloaded images are skipped, so reruns are cheap.
 *
 * Docs: https://developers.facebook.com/docs/threads/threads-media
 */

import {
  cloudName,
  configureCloudinary,
  fetchJson,
  uploadImage,
  uploadJson,
} from './cloudinary'
import { setOutput } from './github-output'
import type {
  ThreadsImage,
  ThreadsMediaType,
  ThreadsPost,
  ThreadsSnapshot,
} from '../src/lib/threads/types'

const HOST = 'https://graph.threads.net/v1.0'
const OUT_DATA = 'data/threads.json'
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

/**
 * Fields requested for a reply. Deliberately conservative — every name here is
 * one the media object already documents. An unknown field is not ignored by
 * Meta; it fails the whole request with "nonexisting field", which would take
 * the sync down for every post at once.
 */
const REPLY_FIELDS = [
  'id',
  'text',
  'timestamp',
  'username',
  'media_type',
  'media_url',
  'alt_text',
  'children{id,media_type,media_url,alt_text}',
].join(',')

interface ApiReply {
  id: string
  text?: string
  timestamp?: string
  username?: string
  media_type?: string
  media_url?: string
  alt_text?: string
  children?: { data?: ApiChild[] }
}

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

/**
 * The author's own first reply to one of their own posts, or null.
 *
 * Threads returns replies from everyone, in no promised order, so this sorts
 * by timestamp and takes the earliest — then keeps it only if the author is
 * the account owner. Somebody else's reply is their words; republishing it
 * under Serhii's byline would be wrong regardless of how useful it is.
 *
 * `getJson` exits the process on an API error, which is right for a missing
 * permission (every post would fail identically) but wrong for one dead post.
 * So this calls fetch directly and distinguishes the two.
 */
async function fetchFirstOwnReply(
  postId: string,
  username: string
): Promise<ApiReply | null> {
  const url = new URL(`${HOST}/${postId}/replies`)
  url.searchParams.set('fields', REPLY_FIELDS)
  url.searchParams.set('limit', '25')
  url.searchParams.set('access_token', token!)

  const res = await fetch(url)
  const text = await res.text()

  let body: { data?: ApiReply[]; error?: { message?: string; code?: number } }
  try {
    body = JSON.parse(text) as typeof body
  } catch {
    console.warn(`  ! replies for ${postId}: non-JSON response, skipping`)
    return null
  }

  if (!res.ok) {
    const error = body.error ?? {}
    const message = error.message ?? `HTTP ${res.status}`

    // A permission or token problem is not a per-post hiccup: it will repeat
    // for all 126 posts and leave a snapshot silently missing every follow-up.
    // Stop, and say exactly what to do about it.
    const isAuth =
      error.code === 190 ||
      error.code === 10 ||
      error.code === 200 ||
      /permission|scope|access token/i.test(message)

    if (isAuth) {
      fail(
        `Reading replies failed: ${message}\n` +
          `  The replies edge needs the threads_read_replies permission, which\n` +
          `  threads_basic alone does not cover. Add it under Use cases ->\n` +
          `  Access the Threads API -> Customise, then GENERATE A NEW TOKEN —\n` +
          `  permissions are baked in at generation, so the existing token will\n` +
          `  keep failing. See docs/SETUP-THREADS.md.`
      )
    }

    console.warn(`  ! replies for ${postId}: ${message}, skipping`)
    return null
  }

  const replies = (body.data ?? []).filter((reply) => reply.timestamp)
  if (replies.length === 0) return null

  replies.sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''))
  const first = replies[0]
  if (!first) return null

  // Without an author there is no way to tell your reply from a stranger's,
  // and guessing would republish someone else's words under your byline. If
  // the field is missing the request shape is wrong, not the data — every
  // post would silently yield no follow-up, which is the failure this repo
  // keeps paying for. Stop instead.
  if (first.username === undefined) {
    fail(
      `The replies edge returned no "username" for reply ${first.id}.\n` +
        `  Without it a reply of yours cannot be told from anyone else's, and\n` +
        `  attaching one regardless would republish a stranger's words. Meta has\n` +
        `  probably renamed or dropped the field — check REPLY_FIELDS against\n` +
        `  https://developers.facebook.com/docs/threads/reply-management`
    )
  }

  // Meta returns usernames without the @, but be forgiving about it.
  const author = first.username.replace(/^@/, '').toLowerCase()
  if (author !== username.replace(/^@/, '').toLowerCase()) return null

  return first
}

/** Videos skipped this run, for one summary line instead of scary warnings. */
let skippedVideos = 0

/**
 * Image sources on a post or reply. Carousels use children; singles do not.
 *
 * Only IMAGE children are taken. A carousel can mix in video, and the uploader
 * is resource_type: 'image' — so before this filter every video was downloaded
 * in full and then rejected by Cloudinary as "Invalid image file", which read
 * like a fault rather than a decision. Video is out of scope for the mirror;
 * a video-only post keeps its text and its permalink.
 */
function imageSources(item: ApiPost | ApiReply): Array<{ url: string; alt: string }> {
  const sources: Array<{ url: string; alt: string }> = []
  const children = item.children?.data ?? []

  if (children.length > 0) {
    for (const child of children) {
      if (!child.media_url) continue
      if (child.media_type !== 'IMAGE') {
        skippedVideos += 1
        continue
      }
      sources.push({ url: child.media_url, alt: child.alt_text ?? '' })
    }
  } else if (item.media_url && item.media_type === 'IMAGE') {
    sources.push({ url: item.media_url, alt: item.alt_text ?? '' })
  } else if (item.media_url) {
    skippedVideos += 1
  }
  return sources
}

async function rehostAll(
  sources: Array<{ url: string; alt: string }>,
  mediaId: string
): Promise<ThreadsImage[]> {
  const images: ThreadsImage[] = []
  for (const [index, source] of sources.entries()) {
    const image = await rehost(source.url, mediaId, index, source.alt)
    if (image) images.push(image)
  }
  return images
}

async function normalise(
  post: ApiPost,
  followUpReply: ApiReply | undefined
): Promise<ThreadsPost | null> {
  if (!post.permalink || !post.timestamp) {
    console.warn(`  ! post ${post.id}: missing permalink or timestamp, skipping`)
    return null
  }

  const images = await rehostAll(imageSources(post), post.id)
  let text = (post.text ?? '').trim()

  // A review is written on Threads as a post plus one follow-up comment. On
  // this site it is ONE post: the halves are joined here, at capture time, and
  // nothing downstream ever sees the seam. A blank line between them keeps the
  // paragraph break the author wrote.
  if (followUpReply) {
    const followUpText = (followUpReply.text ?? '').trim()
    const followUpImages = await rehostAll(imageSources(followUpReply), followUpReply.id)
    if (followUpText) text = text ? `${text}\n\n${followUpText}` : followUpText
    images.push(...followUpImages)
  }

  return {
    id: post.id,
    permalink: post.permalink,
    timestamp: new Date(post.timestamp).toISOString(),
    mediaType: (post.media_type ?? 'TEXT_POST') as ThreadsMediaType,
    text,
    images,
    isQuotePost: Boolean(post.is_quote_post),
  }
}

/**
 * The newest timestamp already stored, or null when nothing is.
 *
 * This is the whole of the incremental rule. The snapshot is the canonical,
 * hand-editable copy of the site's posts, so a sync must never rewrite a post
 * it has already captured — an edit made here would be silently reverted on
 * the next run. Only posts strictly newer than this cursor are taken.
 *
 * Consequences worth knowing, all of them intended:
 * - Editing a post on Threads after it syncs does not update the site.
 * - Deleting a post on Threads does not remove it from the site.
 * - Backdated posts (rare) would fall below the cursor and be missed.
 */
function newestStored(posts: Array<{ timestamp: string }>): string | null {
  let newest: string | null = null
  for (const post of posts) {
    if (!newest || post.timestamp > newest) newest = post.timestamp
  }
  return newest
}

async function main(): Promise<void> {
  // Fails in the first second when the secret is missing, rather than after
  // a full paginated crawl of the API.
  await configureCloudinary()
  console.log(`→ cloudinary cloud: ${cloudName()}`)

  console.log('→ resolving account')
  const username = await fetchUsername()
  console.log(`  @${username}`)

  // The stored snapshot is the source of truth, not a mirror to regenerate.
  const stored = (await fetchJson<ThreadsSnapshot>(OUT_DATA))?.posts ?? []
  const cursor = newestStored(stored)
  console.log(
    cursor
      ? `→ ${stored.length} posts already stored, newest ${cursor}`
      : '→ nothing stored yet, taking the whole feed'
  )

  console.log('→ fetching posts')
  const fetched = await fetchAllPosts()

  const storedIds = new Set(stored.map((post) => post.id))
  const raw = fetched.filter((post) => {
    if (!post.timestamp) return false
    if (storedIds.has(post.id)) return false
    return !cursor || new Date(post.timestamp).toISOString() > cursor
  })
  console.log(`  ${raw.length} new of ${fetched.length} fetched`)

  if (raw.length === 0) {
    console.log(`✓ ${stored.length} posts, nothing new`)
    await setOutput('changed', 'false')
    return
  }

  // Reviews here are written as a post plus one follow-up comment, so the
  // comment carries half the writing. Only posts that HAVE replies are asked
  // about — `has_replies` comes free with the post, and skipping the rest
  // saves an API call each.
  console.log('→ collecting follow-up comments')
  const followUps = new Map<string, ApiReply>()
  const candidates = raw.filter((post) => post.has_replies)

  for (const post of candidates) {
    const reply = await fetchFirstOwnReply(post.id, username)
    if (reply) followUps.set(post.id, reply)
  }
  console.log(
    `  ${followUps.size} of ${candidates.length} posts with replies have one of your own first`
  )

  // A self-reply is itself a post, so it comes back from /me/threads too.
  // Left alone it would render as its own card AND as its parent's follow-up.
  // Attaching it wins; the standalone copy goes.
  const attached = new Set([...followUps.values()].map((reply) => reply.id))
  const topLevel = raw.filter((post) => !attached.has(post.id))
  if (topLevel.length !== raw.length) {
    console.log(
      `  ${raw.length - topLevel.length} of those were also listed as their own posts; folded in`
    )
  }

  console.log('→ processing media')
  const posts: ThreadsPost[] = []
  for (const post of topLevel) {
    const normalised = await normalise(post, followUps.get(post.id))
    if (normalised) posts.push(normalised)
  }

  if (skippedVideos > 0) {
    console.log(
      `  ${skippedVideos} non-image attachments skipped (video is not mirrored)`
    )
  }

  if (posts.length === 0) {
    fail('Every new post failed to normalise. Refusing to touch the snapshot.')
  }

  // APPEND. Stored posts are passed through untouched, edits and all.
  const merged = [...stored, ...posts]
  merged.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const snapshot: ThreadsSnapshot = {
    syncedAt: new Date().toISOString(),
    username,
    posts: merged,
  }

  await uploadJson(OUT_DATA, snapshot)
  await setOutput('changed', 'true')
  console.log(
    `✓ ${posts.length} new post(s) appended; ${merged.length} total in ${OUT_DATA}`
  )
}

// Not top-level await: tsx transpiles these to CJS (the package is not
// type: module), and esbuild rejects top-level await in CJS output.
// An explicit entrypoint works under either format.
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
