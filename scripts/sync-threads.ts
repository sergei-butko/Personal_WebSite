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
import { THREADS_IMAGE_FOLDER } from './media-name'
import { mergePosts } from './threads-merge'

const HOST = 'https://graph.threads.net/v1.0'
const OUT_DATA = 'data/threads.json'
const FOLDER = THREADS_IMAGE_FOLDER
const PAGE_SIZE = 100

/**
 * Walk the whole feed, ignoring the cursor. For when you suspect a post was
 * missed — a backdated one, say — and want a full re-scan without lowering
 * `syncedThrough`, which is machinery and must not be edited.
 */
const FETCH_ALL = process.env.THREADS_FETCH_ALL === '1'

/**
 * How far BEFORE the cursor to ask the API to start.
 *
 * `since` is an optimisation, not the rule: the client-side filter below stays
 * the authority on what counts as new, and this only decides how much the API
 * bothers to send. So it is set generously on purpose. If `since` ever rounds
 * to the minute, or reads a timezone differently than expected, a post landing
 * seconds after the cursor would be dropped by the server and never asked for
 * again — the cursor only moves forward. An hour of overlap costs one extra
 * request and closes that off; the posts it re-fetches are discarded by the
 * filter, as they already were when every run fetched everything.
 */
const SINCE_OVERLAP_SECONDS = 3600

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

/**
 * Walks /me/threads, newest first, stopping on the first page without a cursor.
 *
 * `since` narrows it server-side. Without it every run pulled the entire feed
 * to decide that nothing had changed — 133 posts over three requests to learn
 * that the answer was zero, and growing with the archive. With it, a run that
 * finds nothing new costs two requests and never grows.
 *
 * Verified equivalent before it was relied on: at three different cursors, the
 * set of ids `since` returns is identical to the set fetching everything and
 * filtering locally returns. It is still only a hint — see the filter at the
 * call site, which decides.
 */
async function fetchAllPosts(since: number | undefined): Promise<ApiPost[]> {
  const posts: ApiPost[] = []
  let after: string | undefined

  for (let page = 1; ; page++) {
    const url = new URL(`${HOST}/me/threads`)
    url.searchParams.set('fields', FIELDS)
    url.searchParams.set('limit', String(PAGE_SIZE))
    url.searchParams.set('access_token', token!)
    if (since !== undefined) url.searchParams.set('since', String(since))
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
 * The id is `threads/images/<postId>-<slot>` — Meta's post id, which does not
 * rotate. Meta's own media_url is signed and expires, so it is never stored
 * and never rendered; only the bytes behind it are kept, once.
 *
 * NOT `<Brand>-<Scent>-<n>`, which is what these end up called: the fragrance
 * is hand-written and does not exist yet at capture time. `media:organise`
 * renames them once a bottle has been named — see media-name.ts.
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
      // Cloudinary's version for these bytes, which the site puts in the
      // delivery URL so replaced bytes get a URL of their own.
      version: uploaded.version,
    }
  } catch (error) {
    console.warn(`  ! image ${publicId}: upload failed — ${(error as Error).message}`)
    return null
  }
}

/**
 * The author's own earliest reply to one of their own posts, or null.
 *
 * Threads returns replies from everyone, in no promised order. This filters to
 * the account owner FIRST and takes the earliest of those. Somebody else's
 * reply is their words; republishing it under Serhii's byline would be wrong
 * regardless of how useful it is.
 *
 * ## The order of those two steps is the whole bug this once had
 *
 * It used to sort every reply, take the single earliest, and return null if
 * that one was not the owner's. On a post nobody had answered yet — the common
 * case, since the follow-up is posted seconds later — that worked. On a post a
 * follower reached first, it threw the continuation away without looking any
 * further, and since the verdict lives in that follow-up, the review arrived
 * cut off mid-sentence with no score. It looked like a post that simply had no
 * verdict. One is known to have been lost that way (Green Tea, 25 replies, none
 * of them the owner's on the first page).
 *
 * Hence the pagination too: 25 replies was one page, and the owner's follow-up
 * on a busy post can sit past it. A cap stays, because a post with thousands of
 * replies should not stall a sync — but it is a page budget now, not a single
 * page, and running out is logged rather than silently treated as "no reply".
 *
 * `getJson` exits the process on an API error, which is right for a missing
 * permission (every post would fail identically) but wrong for one dead post.
 * So this calls fetch directly and distinguishes the two.
 */
/** Pages of replies to walk before giving up on finding the owner's. */
const MAX_REPLY_PAGES = Number(process.env.SYNC_MAX_REPLY_PAGES ?? 8)

async function fetchFirstOwnReply(
  postId: string,
  username: string
): Promise<ApiReply | null> {
  const owner = username.replace(/^@/, '').toLowerCase()
  const mine: ApiReply[] = []
  let next: string | undefined

  for (let page = 1; page <= MAX_REPLY_PAGES; page++) {
    const url = new URL(next ?? `${HOST}/${postId}/replies`)
    if (!next) {
      url.searchParams.set('fields', REPLY_FIELDS)
      url.searchParams.set('limit', '100')
      url.searchParams.set('access_token', token!)
    }

    const page$ = await fetchReplyPage(postId, url)
    if (page$ === null) return null

    for (const reply of page$.replies) {
      // Meta returns usernames without the @, but be forgiving about it.
      if (reply.username?.replace(/^@/, '').toLowerCase() === owner) mine.push(reply)
    }

    if (!page$.next) break
    next = page$.next
    if (page === MAX_REPLY_PAGES) {
      console.warn(
        `  ! replies for ${postId}: stopped after ${MAX_REPLY_PAGES} pages with more ` +
          `available. Raise SYNC_MAX_REPLY_PAGES if a follow-up looks missing.`
      )
    }
  }

  if (mine.length === 0) return null
  mine.sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''))
  return mine[0] ?? null
}

/** One page of replies, or null when the post itself should be skipped. */
async function fetchReplyPage(
  postId: string,
  url: URL
): Promise<{ replies: ApiReply[]; next: string | undefined } | null> {
  const res = await fetch(url)
  const text = await res.text()

  let body: {
    data?: ApiReply[]
    paging?: { next?: string }
    error?: { message?: string; code?: number }
  }
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

  // Without an author there is no way to tell your reply from a stranger's,
  // and guessing would republish someone else's words under your byline. If
  // the field is missing the request shape is wrong, not the data — every
  // post would silently yield no follow-up, which is the failure this repo
  // keeps paying for. Stop instead.
  const anonymous = replies.find((reply) => reply.username === undefined)
  if (anonymous) {
    fail(
      `The replies edge returned no "username" for reply ${anonymous.id}.\n` +
        `  Without it a reply of yours cannot be told from anyone else's, and\n` +
        `  attaching one regardless would republish a stranger's words. Meta has\n` +
        `  probably renamed or dropped the field — check REPLY_FIELDS against\n` +
        `  https://developers.facebook.com/docs/threads/reply-management`
    )
  }

  return { replies, next: body.paging?.next }
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

/** The newest timestamp among a set of posts, or null when there are none. */
function newestOf(posts: Array<{ timestamp: string }>): string | null {
  let newest: string | null = null
  for (const post of posts) {
    if (!newest || post.timestamp > newest) newest = post.timestamp
  }
  return newest
}

/**
 * The incremental cursor: only posts strictly newer than this are taken.
 *
 * Read from the snapshot's own `syncedThrough` rather than derived from the
 * posts still in it, and that distinction is the whole point. The derived
 * version made curating the archive quietly destructive in one case: the
 * snapshot is hand-editable, deleting the most recent post lowered the cursor,
 * and the next sync saw that post as new and put it back. Deleting an older
 * post already worked, so the failure only showed up on the one you had just
 * removed — the worst possible shape for a bug in something you edit by hand.
 *
 * A monotonic cursor makes deletion mean deletion. It falls back to deriving
 * the value for a snapshot written before the field existed, and main() writes
 * it out afterwards so the fallback runs exactly once.
 *
 * Consequences worth knowing, all of them intended:
 * - Editing a post on Threads after it syncs does not update the site.
 * - Deleting a post on Threads does not remove it from the site.
 * - Backdated posts (rare) would fall below the cursor and be missed.
 */
function cursorFrom(snapshot: ThreadsSnapshot | null): string | null {
  if (snapshot?.syncedThrough) return snapshot.syncedThrough
  return newestOf(snapshot?.posts ?? [])
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
  const storedSnapshot = await fetchJson<ThreadsSnapshot>(OUT_DATA)
  const stored = storedSnapshot?.posts ?? []
  const cursor = cursorFrom(storedSnapshot)
  console.log(
    cursor
      ? `→ ${stored.length} posts stored, synced through ${cursor}` +
          (storedSnapshot?.syncedThrough ? '' : ' (derived; writing it out this run)')
      : '→ nothing stored yet, taking the whole feed'
  )

  const since =
    cursor && !FETCH_ALL
      ? Math.floor(new Date(cursor).getTime() / 1000) - SINCE_OVERLAP_SECONDS
      : undefined

  console.log(
    since === undefined
      ? `→ fetching every post${FETCH_ALL ? ' (THREADS_FETCH_ALL=1)' : ''}`
      : `→ fetching posts since ${new Date(since * 1000).toISOString()}`
  )
  const fetched = await fetchAllPosts(since)

  const storedIds = new Set(stored.map((post) => post.id))
  const raw = fetched.filter((post) => {
    if (!post.timestamp) return false
    if (storedIds.has(post.id)) return false
    return !cursor || new Date(post.timestamp).toISOString() > cursor
  })
  console.log(`  ${raw.length} new of ${fetched.length} fetched`)

  if (raw.length === 0) {
    /*
     * Nothing new, but the cursor may still need writing out. Until
     * `syncedThrough` is IN the file, it is derived from the posts array — and
     * deleting the newest post by hand would lower it, so the next sync would
     * put that post back. The repair must not wait for the next new post,
     * because the whole point of it is to make hand-curation safe today.
     *
     * `changed` stays false: the rendered site is byte-identical, so there is
     * nothing to deploy.
     */
    if (storedSnapshot && !storedSnapshot.syncedThrough && cursor) {
      await uploadJson(OUT_DATA, { ...storedSnapshot, syncedThrough: cursor })
      console.log(`  wrote syncedThrough ${cursor}; hand-deleted posts now stay deleted`)
    }
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

  /*
   * APPEND. Stored posts are passed through untouched, edits and all — that is
   * the whole rule, and mergePosts states it rather than leaving it to the
   * `storedIds` filter forty lines up to imply. It also catches the one case
   * that filter cannot: the same post arriving twice within a single fetch,
   * which cursor pagination is entitled to do.
   */
  const { posts: merged, collisions } = mergePosts(stored, posts)
  if (collisions > 0) {
    // Not fatal — the right posts are kept either way. Worth saying out loud
    // because the upstream filter should have made it impossible.
    console.warn(
      `  ! ${collisions} fetched post(s) had an id already present and were dropped`
    )
  }

  /*
   * Monotonic by construction: the highest of what we already promised to have
   * seen and what this run actually saw. `newestOf(posts)` alone would lower it
   * on a run whose new posts are all older than the cursor, which cannot happen
   * today but is one refactor away from happening.
   */
  const seen = [cursor, newestOf(posts)].filter((t): t is string => Boolean(t))
  const syncedThrough =
    seen.length > 0 ? seen.reduce((a, b) => (a > b ? a : b)) : undefined

  const snapshot: ThreadsSnapshot = {
    syncedAt: new Date().toISOString(),
    username,
    ...(syncedThrough ? { syncedThrough } : {}),
    posts: merged,
  }

  await uploadJson(OUT_DATA, snapshot)
  await setOutput('changed', 'true')
  console.log(
    `✓ ${merged.length - stored.length} new post(s) appended; ` +
      `${merged.length} total in ${OUT_DATA}`
  )
}

// Not top-level await: tsx transpiles these to CJS (the package is not
// type: module), and esbuild rejects top-level await in CJS output.
// An explicit entrypoint works under either format.
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
