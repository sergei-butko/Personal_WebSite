/**
 * A photo snapshot in the shapes the two galleries want.
 *
 * Extracted from the pages for the same reason as `lib/threads/cards.ts`: the
 * derivation now happens twice, once on the server when the build renders the
 * HTML and once in the browser when `useLiveSnapshot` returns something newer.
 * Two copies would drift, and drift here shows as captions or alt text that
 * change the instant the refresh lands.
 *
 * Both mappings used to sit inline in the pages, where they had to run on the
 * server because `PostGallery` is a Client Component and the page's comment
 * warned against sending the locale date tables and the cloud name into the
 * bundle. Neither turns out to be a real cost: `formatPostDateTime` is a thin
 * `Intl.DateTimeFormat` wrapper with no tables, and the cloud name is a public
 * value the refresh already needs to fetch anything at all.
 *
 * The date formatting is pinned to UTC, which is what makes running it in the
 * browser safe: it produces the same string the server produced, so a refresh
 * cannot make the timestamps flicker.
 */

import type { GalleryItem } from '@/components/photos/gallery'
import type { PostGroup } from '@/components/photos/post-gallery'
import type { Locale } from '@/lib/i18n'
import { audioUrl } from '@/lib/media'
import { resolveAlt, resolveCaption } from './alt'
import { formatPostDateTime } from './format'
import { groupByPost } from './group'
import type { Photo } from './types'

/** Hidden photos are out of both views, which is the point of the flag. */
const visible = (photos: readonly Photo[]) => photos.filter((photo) => !photo.hidden)

export function toGalleryItems(
  photos: readonly Photo[],
  locale: Locale,
  genericAlt: string
): GalleryItem[] {
  return visible(photos).map((photo) => ({
    photo,
    alt: resolveAlt(photo, locale, genericAlt),
    caption: resolveCaption(photo),
  }))
}

export function toPostGroups(
  photos: readonly Photo[],
  locale: Locale,
  genericAlt: string
): PostGroup[] {
  return groupByPost(visible(photos)).map((post) => ({
    id: post.id,
    permalink: post.permalink,
    timestamp: post.timestamp,
    dateTime: formatPostDateTime(post.timestamp, locale),
    caption: post.caption,
    ...(post.audio ? { audio: post.audio } : {}),
    ...(post.audio?.publicId
      ? { audioSrc: audioUrl(post.audio.publicId, post.audio.version) }
      : {}),
    items: post.photos.map((photo) => ({
      photo,
      alt: resolveAlt(photo, locale, genericAlt),
    })),
  }))
}
