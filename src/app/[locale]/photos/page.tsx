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
import { Container, PageHeading } from '@/components/layout/container'

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
      {/* No standfirst: the grid below says "these are photos from Telegram"
          more directly than a sentence about it can, and the button says where. */}
      <PageHeading
        title={dict.photos.title}
        action={<ChannelButton channel={channel} label={dict.photos.viewOnTelegram} />}
      />

      <PhotoViewSwitch
        locale={locale}
        current="all"
        allLabel={dict.photos.viewAll}
        byPostLabel={dict.photos.viewByPost}
      />

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
              fewerPerRow: dict.photos.fewerPerRow,
              morePerRow: dict.photos.morePerRow,
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
