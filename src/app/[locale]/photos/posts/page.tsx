import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { loadPhotoSnapshot } from '@/lib/photos/snapshot'
import { isUnsynced } from '@/lib/photos/types'
import { resolveAlt } from '@/lib/photos/alt'
import { groupByPost } from '@/lib/photos/group'
import { formatPostDateTime } from '@/lib/photos/format'
import { audioUrl } from '@/lib/media'
import { PostGallery, type PostGroup } from '@/components/photos/post-gallery'
import { PhotoViewSwitch } from '@/components/photos/view-switch'
import { ChannelButton } from '@/components/photos/channel-button'
import { PhotosEmpty, SyncedNote } from '@/components/photos/notices'
import { Container } from '@/components/layout/container'

/**
 * The same photos as ../, grouped back into the Telegram posts they were
 * published in — one card per post, with its text, its time, its song, and a
 * way through to the original.
 */
export default async function PhotosByPostPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)
  const photoSnapshot = await loadPhotoSnapshot()
  const { photos, channel, syncedAt } = photoSnapshot

  const groups: PostGroup[] = groupByPost(photos.filter((photo) => !photo.hidden)).map(
    (post) => ({
      id: post.id,
      permalink: post.permalink,
      timestamp: post.timestamp,
      // Both the formatting and the audio URL are resolved here rather than in
      // the card: PostGallery is a Client Component, and neither the locale
      // date tables nor the Cloudinary cloud name should cross into the bundle.
      dateTime: formatPostDateTime(post.timestamp, locale),
      caption: post.caption,
      ...(post.audio ? { audio: post.audio } : {}),
      ...(post.audio?.publicId ? { audioSrc: audioUrl(post.audio.publicId) } : {}),
      items: post.photos.map((photo) => ({
        photo,
        alt: resolveAlt(photo, locale, dict.photos.genericAlt),
      })),
    })
  )

  return (
    <Container>
      {/*
       * No visible heading. The page is titled in the tab, in the nav, and by
       * the pictures themselves; a large word "Photos" above a grid of photos
       * only pushed the grid down. The h1 stays for the document outline —
       * removing it outright would leave the page with no heading at all,
       * which is a real loss for anyone navigating by headings rather than a
       * cosmetic one.
       */}
      <h1 className="sr-only">{dict.photos.title}</h1>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PhotoViewSwitch
          locale={locale}
          current="posts"
          allLabel={dict.photos.viewAll}
          byPostLabel={dict.photos.viewByPost}
        />
        <ChannelButton channel={channel} label={dict.photos.viewOnTelegram} />
      </div>

      {isUnsynced(photoSnapshot) || groups.length === 0 ? (
        <PhotosEmpty
          message={dict.photos.empty}
          channel={channel}
          viewChannel={dict.photos.viewChannel}
        />
      ) : (
        <>
          <PostGallery
            posts={groups}
            strings={{
              closeLabel: dict.photos.close,
              openLabelPrefix: dict.photos.open,
              viewOnTelegram: dict.photos.viewOnTelegram,
              previousLabel: dict.photos.previous,
              nextLabel: dict.photos.next,
              countOne: dict.photos.countOne,
              countMany: dict.photos.countMany,
              perRowLabel: dict.photos.perRowPosts,
              zoomIn: dict.photos.zoomIn,
              zoomOut: dict.photos.zoomOut,
              pinchHint: dict.photos.pinchHint,
              play: dict.photos.play,
              pause: dict.photos.pause,
              seek: dict.photos.seek,
              listenOnTelegram: dict.photos.listenOnTelegram,
            }}
          />
          <SyncedNote
            syncedAt={syncedAt}
            channel={channel}
            label={dict.photos.syncedAt}
          />
        </>
      )}
    </Container>
  )
}
