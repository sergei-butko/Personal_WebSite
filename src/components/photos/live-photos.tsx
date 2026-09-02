'use client'

/**
 * The two photo views, re-rendered from the config when it changes.
 *
 * Same bargain as the perfumery views: the build renders the snapshot into
 * HTML, so a visitor gets complete markup with no JavaScript required, and
 * `useLiveSnapshot` then re-reads `data/photos.json` and re-renders if
 * Cloudinary holds something newer. Editing a caption or some alt text through
 * `content:push` shows up on the next page load rather than on the next
 * deploy.
 *
 * The "last synced" note is refreshed alongside the pictures. It would
 * otherwise report the date the site was BUILT while showing photographs that
 * arrived after it, which is a small lie but a confusing one — it is the line
 * a reader checks precisely when they wonder whether the mirror is current.
 */

import { useLiveSnapshot } from '@/lib/live-snapshot'
import { photoSnapshotSchema } from '@/lib/photos/schema'
import { toGalleryItems, toPostGroups } from '@/lib/photos/items'
import { isUnsynced, type PhotoSnapshot } from '@/lib/photos/types'
import type { Locale } from '@/lib/i18n'
import { PhotoGallery, type GalleryStrings } from './gallery'
import { PostGallery, type PostGalleryStrings } from './post-gallery'
import { PhotosEmpty, SyncedNote } from './notices'

/** The raw asset both views read. Same id the build fetches. */
const SNAPSHOT = 'data/photos.json'

interface Shared {
  initial: PhotoSnapshot
  locale: Locale
  /** Alt text for a photo that has none written yet. */
  genericAlt: string
  empty: { message: string; channel: string; viewChannel: string }
  synced: { label: string }
}

export function LivePhotoGallery({
  initial,
  locale,
  genericAlt,
  empty,
  synced,
  strings,
}: Shared & { strings: GalleryStrings }) {
  const snapshot = useLiveSnapshot(SNAPSHOT, photoSnapshotSchema, initial)

  if (isUnsynced(snapshot)) {
    return (
      <PhotosEmpty
        message={empty.message}
        channel={empty.channel}
        viewChannel={empty.viewChannel}
      />
    )
  }

  return (
    <>
      <PhotoGallery
        items={toGalleryItems(snapshot.photos, locale, genericAlt)}
        strings={strings}
      />
      <SyncedNote
        syncedAt={snapshot.syncedAt}
        channel={snapshot.channel}
        label={synced.label}
      />
    </>
  )
}

export function LivePostGallery({
  initial,
  locale,
  genericAlt,
  empty,
  synced,
  strings,
}: Shared & { strings: PostGalleryStrings }) {
  const snapshot = useLiveSnapshot(SNAPSHOT, photoSnapshotSchema, initial)

  if (isUnsynced(snapshot)) {
    return (
      <PhotosEmpty
        message={empty.message}
        channel={empty.channel}
        viewChannel={empty.viewChannel}
      />
    )
  }

  return (
    <>
      <PostGallery
        posts={toPostGroups(snapshot.photos, locale, genericAlt)}
        strings={strings}
      />
      <SyncedNote
        syncedAt={snapshot.syncedAt}
        channel={snapshot.channel}
        label={synced.label}
      />
    </>
  )
}
