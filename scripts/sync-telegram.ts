/**
 * Mirrors a public Telegram channel's photos into Cloudinary.
 *
 *   npm run sync:photos
 *
 * Reads t.me/s/<channel>, which is a plain public preview page — no API key,
 * no token, no bot. Walks backwards through history via ?before=, uploads
 * every photo to Cloudinary, and writes data/photos.json there too.
 *
 * Why it is built this way:
 *
 * - Images are RE-HOSTED, not linked. Telegram's telesco.pe URLs are signed
 *   and expire; linking them means silently broken images in a few weeks.
 * - Image bytes never touch the repository. Cloudinary stores the original and
 *   derives every width and format on delivery, so there is no encode step,
 *   no variant files, and nothing to commit but the snapshot below.
 * - The public id is `telegram/images/<postId>-<slot>` — from Telegram's own
 *   message id, which is stable. A re-upload therefore REPLACES the asset.
 *   The version of this script that shipped before keyed on a sha1 of the
 *   signed source URL, which rotates on every fetch: the cache never hit,
 *   every run re-downloaded and re-encoded the whole channel under fresh
 *   filenames, and nothing was ever deleted. Thirteen runs turned 402 photos
 *   into 10,377 files and 827 MB. Keying on a stable id is the fix.
 * - The snapshot is stored in CLOUDINARY, not in git, so a sync produces no
 *   commit. If Telegram changes its markup or is unreachable, the last good
 *   snapshot stays in place — but an unreachable Cloudinary fails the site
 *   build. See src/lib/snapshot.ts for why that is the chosen failure mode.
 * - Nothing is written unless the run succeeds, and an empty result never
 *   overwrites a good snapshot.
 * - photo-meta.ts is never touched. Hand-written captions and alt text are
 *   yours permanently.
 *
 * Parsing lives in telegram-parse.ts and is covered by `npm run test:telegram`
 * against a saved fixture, so a markup change fails loudly and locally.
 */

import { createHash } from 'node:crypto'
import {
  pairAudio,
  parseChannelPage,
  type PairedAudio,
  type ParsedPost,
} from './telegram-parse'
import { audioFetchConfigured, audioFetchStatus, fetchAudio } from './telegram-bot'
import { decideAsset, type StoredSize } from './photo-dedup'
import { setOutput } from './github-output'
import {
  cloudName,
  configureCloudinary,
  deleteAssets,
  fetchJson,
  listAssetIds,
  uploadAudio,
  uploadImage,
  uploadJson,
} from './cloudinary'
import { TELEGRAM_IMAGE_FOLDER, telegramAudioId, telegramImageId } from './media-name'
import type { Photo, PhotoSnapshot, PostAudio } from '../src/lib/photos/types'

const CHANNEL = process.env.TELEGRAM_CHANNEL ?? 'just_my_photos'
const OUT_DATA = 'data/photos.json'
const OUT_HASHES = 'data/photo-hashes.json'
/*
 * Where the photos land. From media-name.ts so that this script and
 * `media:organise` cannot disagree about the layout — when they did, a sync
 * quietly rebuilt the old flat structure underneath the organised one. Audio
 * goes to its own folder, which telegramAudioId knows about.
 */
const FOLDER = TELEGRAM_IMAGE_FOLDER

/**
 * The Bot API refuses to serve a file over 20 MB, so anything larger cannot be
 * downloaded at all — the ceiling is Telegram's, not a policy of this script.
 * A track that big is a mistagged album rip rather than a song.
 */
const MAX_AUDIO_BYTES = Number(process.env.SYNC_MAX_AUDIO_BYTES ?? 20 * 1024 * 1024)

/** Re-download and re-upload everything, ignoring both caches. */
const FORCE = process.env.SYNC_FORCE === '1'

/**
 * Re-upload stored photos whose Cloudinary asset has gone missing.
 *
 * Off by default, because it costs a listing of the whole folder and every
 * ordinary run would pay for it to find nothing. A row can lose its asset
 * without anything being wrong with this script — an upload that failed years
 * ago, a hand-deletion in the console — and the sync will never notice on its
 * own: it appends only posts newer than the cursor, so a 2019 row is never
 * looked at again. `npm run media:organise` is what surfaces these.
 *
 * Distinct from SYNC_FORCE, which re-uploads all 443 photos to fix the one
 * that is broken. This re-uploads only what is actually absent.
 */
const REPAIR = process.env.SYNC_REPAIR === '1'

/**
 * Delete Cloudinary assets under FOLDER that the new snapshot does not
 * reference. Opt-in, because it is the only destructive thing here.
 */
const PRUNE = process.env.SYNC_PRUNE === '1'

/**
 * Do everything except write: fetch, parse, pair, decide, report — then stop
 * short of every upload and the prune.
 *
 * Here because this repo's rule is that a script is run before it ships, and
 * the only run this script otherwise has is one against the live content
 * store. "It typechecks" is what let sync-threads.ts fail on every scheduled
 * run for weeks. A dry run exercises the same code path and touches nothing.
 */
const DRY_RUN = process.env.SYNC_DRY_RUN === '1'

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

const publicIdFor = telegramImageId

/** Keyed on the AUDIO post's message id, so a re-run replaces in place. */
const audioPublicIdFor = telegramAudioId

/**
 * Photos already uploaded, from the snapshot in Cloudinary.
 *
 * This is the cache, and it works only because the public id is stable. Miss
 * it and the run merely re-uploads to the same id — wasteful, never
 * duplicating.
 */
async function previouslyUploaded(): Promise<Map<string, Photo>> {
  const known = new Map<string, Photo>()
  if (FORCE) return known

  const snapshot = await fetchJson<PhotoSnapshot>(OUT_DATA)
  for (const photo of snapshot?.photos ?? []) {
    known.set(photo.publicId, photo)
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

  if (DRY_RUN) {
    // The download and the hash above are real work worth exercising; only the
    // upload is skipped. Dimensions come back from Cloudinary, so a dry run has
    // none — and cannot, since a dry run never writes a snapshot to put them in.
    return { publicId, width: 0, height: 0, deduped: false }
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

/**
 * Re-hosts one song and returns what the snapshot should record about it.
 *
 * Never returns null. Title and artist come from the channel page and are
 * always available, so a post that had a song always says so — the bytes are
 * what may be missing, and their absence turns the player into a link out to
 * Telegram rather than removing the track. That distinction is the whole
 * reason `publicId` is optional on PostAudio.
 *
 * Telegram's own tags win over the HTML card when both are present: the card
 * is a rendering, the tags are the file.
 */
async function rehostAudio(
  channel: string,
  track: PairedAudio,
  stored: Map<number, PostAudio>
): Promise<PostAudio> {
  const card: PostAudio = {
    id: track.id,
    permalink: track.permalink,
    title: track.title,
    performer: track.performer,
  }

  // Already fetched by an earlier run. Re-forwarding it would cost a download
  // and a Cloudinary write to arrive at the same asset under the same id.
  const known = stored.get(track.id)
  if (known?.publicId) return known

  if (!audioFetchConfigured() || DRY_RUN) return card

  const fetched = await fetchAudio(channel, track.id, MAX_AUDIO_BYTES)
  if (!fetched) return card

  const publicId = audioPublicIdFor(track.id)
  try {
    return {
      ...card,
      title: fetched.title || card.title,
      performer: fetched.performer || card.performer,
      publicId: await uploadAudio(fetched.bytes, publicId),
      duration: fetched.duration,
    }
  } catch (error) {
    console.warn(`  ! ${publicId}: upload failed — ${(error as Error).message}`)
    return card
  }
}

/** Known public id → size, from the snapshot plus whatever this run uploads. */
const uploadedDimensions = new Map<string, StoredSize>()

/**
 * Whether two captions are the same words with different whitespace.
 *
 * This is the whole safety guarantee of the caption repair below. Telegram
 * writes newlines as `<br/>`, cheerio's `.text()` dropped them, and 103
 * captions were stored with their lines welded together. Re-parsing fixes new
 * posts; the stored ones need rewriting, and rewriting a stored caption is
 * exactly the thing this sync promises never to do, because captions are hand
 * editable.
 *
 * So the repair only fires when the stored text and the freshly parsed text are
 * identical once ALL whitespace is removed — same characters, same order, only
 * the breaks differ. A hand-edited caption differs by more than whitespace and
 * is therefore untouchable by construction, not by care.
 */
function sameButForWhitespace(a: string, b: string): boolean {
  return a.replace(/\s+/gu, '') === b.replace(/\s+/gu, '')
}

/**
 * Songs already re-hosted, keyed by the audio post's message id.
 *
 * Read off the photo rows because that is where the snapshot keeps them —
 * denormalised onto every image of the album, so the first row carrying a
 * given track id is as good as any other.
 */
function storedAudio(photos: readonly Photo[]): Map<number, PostAudio> {
  const map = new Map<number, PostAudio>()
  for (const photo of photos) {
    if (photo.audio && !map.has(photo.audio.id)) map.set(photo.audio.id, photo.audio)
  }
  return map
}

/** The committed content-hash map, or an empty one on first run. */
async function loadHashes(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const stored = await fetchJson<Record<string, string>>(OUT_HASHES)
  for (const [hash, publicId] of Object.entries(stored ?? {})) {
    map.set(hash, publicId)
  }
  return map
}

/**
 * Maps the sha256 of an image's bytes to the Cloudinary public id it is stored
 * under. This is what makes the sync store DISTINCT images: the same photo
 * posted twice gets two entries in the snapshot — both posts are real — but
 * only one asset.
 *
 * Kept out of photos.json on purpose. Content hashes are a concern of the
 * sync, not of the site, and nothing under src/ reads them.
 */
function hashesToObject(hashes: Map<string, string>): Record<string, string> {
  return Object.fromEntries([...hashes.entries()].sort(([a], [b]) => (a < b ? -1 : 1)))
}

/**
 * The newest timestamp already stored, or null when nothing is.
 *
 * The snapshot is the canonical, hand-editable copy of the gallery, so a sync
 * must never rewrite a photo it has already captured — a caption or alt text
 * written by hand would be silently reverted on the next run. Only posts
 * strictly newer than this cursor are taken.
 *
 * Consequences, all intended: an edited caption on Telegram does not update
 * here, a deleted post stays, and a backdated post would be missed.
 */
function newestStored(photos: Array<{ timestamp: string }>): string | null {
  let newest: string | null = null
  for (const photo of photos) {
    if (!newest || photo.timestamp > newest) newest = photo.timestamp
  }
  return newest
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

  // The stored snapshot is the source of truth, not a mirror to regenerate.
  const storedSnapshot = await fetchJson<PhotoSnapshot>(OUT_DATA)
  const stored = storedSnapshot?.photos ?? []
  const cursor = newestStored(stored)
  console.log(
    cursor
      ? `→ ${stored.length} photos already stored, newest ${cursor}`
      : '→ nothing stored yet, taking the whole channel'
  )

  console.log(`→ reading t.me/s/${CHANNEL}`)
  const fetched = await collectPosts()

  const storedIds = new Set(stored.map((photo) => photo.publicId))
  const posts = fetched.filter((post) => !cursor || post.timestamp > cursor)
  console.log(`  ${posts.length} new of ${fetched.length} posts fetched`)

  /*
   * Songs, matched to albums over the WHOLE fetched history rather than the
   * new slice. Two reasons, and the second is the load-bearing one:
   *
   * - A song and its album are separate messages seconds apart, so a sync that
   *   happened to run between them would see the song with its album already
   *   past the cursor.
   * - Every photo in the snapshot predates this feature and carries no track
   *   at all. Scoping to new posts would mean no post ever gets a song until
   *   a new one is published.
   *
   * So a stored row may GAIN an `audio` field it never had. That is the one
   * edit a sync makes to a row it has already captured, it is additive only —
   * a row that already names a track is left exactly as it is, hand-edited or
   * not — and it is the only way the existing archive gets its music.
   */
  const tracks = pairAudio(fetched)
  const knownAudio = storedAudio(stored)

  const albumsNeedingAudio = new Set<number>()
  for (const post of posts) if (tracks.has(post.id)) albumsNeedingAudio.add(post.id)
  for (const photo of stored) {
    if (!photo.audio && tracks.has(photo.id)) albumsNeedingAudio.add(photo.id)
  }

  const audioByAlbum = new Map<number, PostAudio>()
  if (albumsNeedingAudio.size > 0) {
    console.log(
      `→ ${albumsNeedingAudio.size} album(s) with a song; ` +
        `bot download ${audioFetchStatus()}`
    )
    for (const albumId of albumsNeedingAudio) {
      const track = tracks.get(albumId)
      if (!track) continue
      audioByAlbum.set(albumId, await rehostAudio(CHANNEL, track, knownAudio))
    }
    const withFile = [...audioByAlbum.values()].filter((a) => a.publicId).length
    console.log(
      `  ${withFile} of ${audioByAlbum.size} song(s) have a playable file; ` +
        `the rest render as a link to Telegram`
    )
  }

  /*
   * Rows whose asset is gone, re-hosted from the channel.
   *
   * The walk above is the whole channel — the cursor filters what is NEW, it
   * does not bound what was fetched — so the bytes for a 2019 photo are
   * already in hand here. All that is missing is permission to look at a row
   * the sync would otherwise skip forever.
   *
   * The row is mutated in place, before `carried` is built below, so the fix
   * rides along with the ordinary write instead of needing a second one. Its
   * public id is recomputed rather than reused, which also drags a row left on
   * an old prefix into the current layout.
   */
  let restored = 0
  if (REPAIR) {
    const present = new Set(await listAssetIds(`${FOLDER}/`))
    const gone = stored.filter((photo) => !present.has(photo.publicId))
    console.log(
      `→ repair: ${gone.length} of ${stored.length} stored row(s) have no asset`
    )

    /*
     * Purge dedup entries that name an asset which is not there.
     *
     * Not housekeeping — without it the repair cannot work. decideAsset is
     * given "hash → public id" and trusts it, as it must; it has no way to know
     * an id is dead. So the first attempt at this found the missing photo's
     * hash in the map, decided the bytes were already stored under
     * `telegram/10-0`, and pointed the row straight back at the asset that was
     * missing in the first place. It reported a repair and changed nothing.
     *
     * A stale entry is worse than useless in an ordinary run too: any future
     * photo with the same bytes would be deduplicated onto a dead id.
     */
    let purged = 0
    for (const [hash, id] of [...hashes]) {
      if (present.has(id)) continue
      hashes.delete(hash)
      uploadedDimensions.delete(id)
      purged++
    }
    if (purged > 0) console.log(`  ${purged} dedup entry(s) named a missing asset`)

    const byPostId = new Map(fetched.map((post) => [post.id, post]))
    for (const photo of gone) {
      const slot = Number(photo.publicId.slice(photo.publicId.lastIndexOf('-') + 1))
      const source = Number.isFinite(slot)
        ? byPostId.get(photo.id)?.images[slot]
        : undefined
      if (!source) {
        // The post was deleted from the channel, or its album was edited and
        // no longer has that slot. Nothing to re-fetch; say so and leave the
        // row alone rather than guessing at a replacement.
        console.warn(
          `  ! ${photo.publicId}: post ${photo.id} slot ${slot} is not on the ` +
            `channel any more — remove the row by hand (npm run content:pull)`
        )
        continue
      }

      const media = await rehost(source.url, photo.id, slot, hashes)
      if (!media) continue
      restored++
      if (DRY_RUN) {
        console.log(`  ↻ would restore ${photo.publicId}`)
        continue
      }
      console.log(`  ↻ ${photo.publicId} → ${media.publicId}`)
      photo.publicId = media.publicId
      photo.width = media.width
      photo.height = media.height
    }
  }

  // Freshly parsed captions, for the whitespace-only repair below.
  const freshCaptions = new Map(fetched.map((post) => [post.id, post.caption]))

  // Additive only, with one exception: a caption whose stored text differs from
  // the live one by whitespace alone is rewritten, which is how the lost line
  // breaks get restored. See sameButForWhitespace.
  let backfilled = 0
  let repaired = 0
  const carried = stored.map((photo) => {
    const track = photo.audio ? undefined : audioByAlbum.get(photo.id)

    const fresh = freshCaptions.get(photo.id)
    const fixable =
      fresh !== undefined &&
      fresh !== photo.caption &&
      sameButForWhitespace(fresh, photo.caption)

    if (!track && !fixable) return photo
    if (track) backfilled++
    if (fixable) repaired++

    return {
      ...photo,
      ...(track ? { audio: track } : {}),
      ...(fixable ? { caption: fresh } : {}),
    }
  })
  if (backfilled > 0) {
    console.log(`  ${backfilled} stored photo row(s) gained the song of their post`)
  }
  if (repaired > 0) {
    console.log(`  ${repaired} stored caption(s) had their line breaks restored`)
  }

  if (posts.length === 0 && backfilled === 0 && repaired === 0) {
    console.log(`✓ ${stored.length} photos, nothing new`)
    await setOutput('changed', 'false')
    return
  }

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
      if (storedIds.has(publicId)) continue
      const hit = known.get(publicId)

      const media = hit
        ? { publicId: hit.publicId, width: hit.width, height: hit.height, deduped: false }
        : await rehost(image.url, post.id, index, hashes)

      if (!media) continue
      if (hit) cached++
      else if (media.deduped) deduped++
      else uploaded++

      const track = audioByAlbum.get(post.id)

      photos.push({
        id: post.id,
        permalink: post.permalink,
        timestamp: post.timestamp,
        caption: post.caption,
        // Empty until written. Editable in the snapshot, which is why
        // content/photo-meta.ts no longer exists.
        alt: {},
        // Repeated on every row of the album — see PostAudio on why.
        ...(track ? { audio: track } : {}),
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

  if (photos.length === 0 && backfilled === 0 && repaired === 0 && restored === 0) {
    console.log(`✓ ${stored.length} photos, nothing new`)
    await setOutput('changed', 'false')
    return
  }

  // APPEND. Stored photos pass through untouched, captions and alt text
  // included — `carried` differs from `stored` only where a row gained a song
  // it did not have, which is the one additive exception above.
  const merged = [...carried, ...photos]
  merged.sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id - a.id)

  // Built from the MERGED set, never from this run's photos alone. Prune
  // deletes whatever the set does not name, so scoping it to the new photos
  // would delete the Cloudinary asset behind every photo already on the site.
  const distinct = new Set(merged.map((photo) => photo.publicId))
  console.log(`  ${merged.length} photos → ${distinct.size} distinct assets`)

  if (DRY_RUN) {
    const songs = merged.filter((photo) => photo.audio).length
    console.log(
      `✓ dry run: ${photos.length} new photo(s), ${backfilled} row(s) given a song, ` +
        `${repaired} caption(s) repaired, ${merged.length} total, ${songs} ` +
        `carrying a track. Nothing written.`
    )
    await setOutput('changed', 'false')
    return
  }

  await uploadJson(OUT_HASHES, hashesToObject(hashes))

  if (PRUNE) {
    // Images only. Audio is stored as a Cloudinary `video` resource, which
    // listAssetIds does not enumerate, so a prune can neither see nor delete a
    // track. Left that way deliberately: an untested destructive path over
    // files the Bot API may no longer be able to re-fetch is a bad trade for
    // the few megabytes an orphaned song costs.
    console.log(`→ pruning ${FOLDER}/ (images only)`)
    const assets = await listAssetIds(`${FOLDER}/`)
    const orphans = assets.filter((id) => !distinct.has(id))
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

  const next: PhotoSnapshot = {
    syncedAt: new Date().toISOString(),
    channel: CHANNEL,
    photos: merged,
  }

  await uploadJson(OUT_DATA, next)
  await setOutput('changed', 'true')
  console.log(
    `✓ ${photos.length} new photo(s) appended, ${backfilled} row(s) given a song, ` +
      `${repaired} caption(s) repaired, ${restored} asset(s) restored; ` +
      `${merged.length} total in ${OUT_DATA}`
  )
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
