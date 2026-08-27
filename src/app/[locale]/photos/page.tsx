import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { loadPhotoSnapshot } from '@/lib/photos/snapshot'
import { isUnsynced } from '@/lib/photos/types'
import { resolveAlt, resolveCaption } from '@/lib/photos/alt'
import { PhotoGallery, type GalleryItem } from '@/components/photos/gallery'
import { PhotoViewSwitch } from '@/components/photos/view-switch'
import { ChannelButton } from '@/components/photos/channel-button'
import { PhotosEmpty, SyncedNote } from '@/components/photos/notices'
import { Container } from '@/components/layout/container'

/** The gallery roll: every photo, newest first. See ./posts for the grouped view. */
export default async function PhotosPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)
  const photoSnapshot = await loadPhotoSnapshot()
  const { photos, channel, syncedAt } = photoSnapshot

  const items: GalleryItem[] = photos
    .filter((photo) => !photo.hidden)
    .map((photo) => ({
      photo,
      alt: resolveAlt(photo, locale, dict.photos.genericAlt),
      caption: resolveCaption(photo),
    }))

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
          current="all"
          allLabel={dict.photos.viewAll}
          byPostLabel={dict.photos.viewByPost}
        />
        <ChannelButton channel={channel} label={dict.photos.viewOnTelegram} />
      </div>

      {isUnsynced(photoSnapshot) || items.length === 0 ? (
        <PhotosEmpty
          message={dict.photos.empty}
          channel={channel}
          viewChannel={dict.photos.viewChannel}
        />
      ) : (
        <>
          <PhotoGallery
            items={items}
            strings={{
              closeLabel: dict.photos.close,
              openLabelPrefix: dict.photos.open,
              viewOnTelegram: dict.photos.viewOnTelegram,
              previousLabel: dict.photos.previous,
              nextLabel: dict.photos.next,
              perRowLabel: dict.photos.perRowPhotos,
              zoomIn: dict.photos.zoomIn,
              zoomOut: dict.photos.zoomOut,
              pinchHint: dict.photos.pinchHint,
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
