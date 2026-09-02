/**
 * Types for the Telegram photo mirror.
 *
 * Telegram's CDN URLs are signed and expire, so nothing here ever points at
 * telesco.pe. The sync re-hosts each photo in Cloudinary and stores only its
 * public id; delivery URLs are built at render time by lib/media.ts.
 *
 * Image bytes are deliberately NOT in this repository. An earlier version
 * downloaded and re-encoded every photo into public/images/photos/, keyed on a
 * hash of the signed Telegram URL — which rotates on every fetch, so the cache
 * never hit and each run left another full copy behind. The public id below is
 * derived from the Telegram message id and slot instead —
 * `telegram/images/<postId>-<slot>` — which is stable across runs, so a re-sync
 * overwrites in place rather than accumulating.
 */

/**
 * The song posted alongside an album.
 *
 * The channel's habit is to post a track right after the photos it goes with,
 * and that adjacency is the only link between them — Telegram records no
 * relationship, so the sync infers it positionally and stores the result here.
 *
 * Every field is editable, `publicId` included. A track the sync could not
 * reach (a forward the channel refuses, a file over the Bot API's download
 * ceiling) arrives with title and artist but no publicId, and the player
 * degrades to a link out to Telegram — the same card, minus the sound.
 */
export interface PostAudio {
  /** Telegram message id of the AUDIO post, not of the album. */
  id: number
  /** The song's own post on Telegram. */
  permalink: string
  title: string
  /** Artist. Sometimes empty — Telegram's card omits it for untagged files. */
  performer: string
  /** Cloudinary public id, e.g. "telegram/audio/554". Absent = no playback. */
  publicId?: string
  /** Cloudinary's version for the file. See `version` on Photo below. */
  version?: number
  /**
   * Seconds, as Telegram reports it. Absent when the file was never fetched,
   * and 0 when Telegram itself does not know — a file whose container carries
   * no duration metadata, which is a third of this channel's tracks. Treat 0
   * as unknown, not as a zero-length song.
   */
  duration?: number
}

/**
 * One photo as it appears on this site.
 *
 * Every field below is EDITABLE. The snapshot in Cloudinary is the canonical
 * copy, not a mirror the sync regenerates — a sync only appends photos newer
 * than the newest one already stored, so edits survive. Editing `timestamp`
 * is the one thing to avoid: it is the high-water mark the next sync reads.
 *
 * These fields replace the old content/photo-meta.ts overrides, which lived in
 * the code and so could not be edited anywhere but an editor with a checkout.
 */
export interface Photo {
  /** Telegram message id. Several photos of one post share it. */
  id: number
  /** Canonical URL of the post on Telegram. */
  permalink: string
  /** ISO 8601 UTC. Doubles as the incremental-sync cursor. */
  timestamp: string
  /** Caption as posted, in whatever language. Often empty. Editable. */
  caption: string
  /**
   * Alt text per locale. Empty until written.
   *
   * This matters more here than anywhere else on the site: the channel
   * captions almost nothing and, unlike a Threads post, there is no adjacent
   * body text carrying the meaning — the image IS the content.
   */
  alt: Partial<Record<'en' | 'uk', string>>
  /** Keep this one out of the gallery without deleting it. */
  hidden?: boolean
  /**
   * The song posted after this photo's album, repeated on every row of it.
   *
   * Denormalised the same way `caption` and `timestamp` are: the snapshot is
   * one row per image because the gallery roll and the dedup both want it
   * that way, and lib/photos/group.ts reads the post-level fields off the
   * first row when it regroups. A separate audio table would be a second
   * store to keep in step by hand, in a file that is edited by hand.
   */
  audio?: PostAudio
  /** Cloudinary public id, e.g. "telegram/571-0". Not a URL, not a path. */
  publicId: string
  /** Intrinsic size, so the grid can reserve space before the image loads. */
  width: number
  height: number
  /**
   * Cloudinary's version for these bytes, which changes on every write, and
   * which goes in the delivery URL so that replaced bytes get a URL of their
   * own — see `versionPath` in lib/media.ts. Absent on rows written before the
   * field existed; `media:organise` records it.
   */
  version?: number
}

export interface PhotoSnapshot {
  /** When the sync last succeeded, ISO 8601. Epoch means never. */
  syncedAt: string
  /** Channel handle, without the @. */
  channel: string
  /** Newest first. */
  photos: Photo[]
}

export function isUnsynced(snapshot: PhotoSnapshot): boolean {
  return snapshot.photos.length === 0
}
