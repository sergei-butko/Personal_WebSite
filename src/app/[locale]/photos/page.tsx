import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { loadPhotoSnapshot } from '@/lib/photos/snapshot'
import { photoOverrides } from '@/content/photo-meta'
import { isUnsynced } from '@/lib/photos/types'
import { resolveAlt, resolveCaption } from '@/lib/photos/alt'
import { PhotoGallery, type GalleryItem } from '@/components/photos/gallery'
import { Container, PageHeading } from '@/components/layout/container'

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
    .filter((photo) => !photoOverrides[photo.id]?.hidden)
    .map((photo) => ({
      photo,
      alt: resolveAlt(photo, photoOverrides[photo.id], locale, dict.photos.genericAlt),
      caption: resolveCaption(photo, photoOverrides[photo.id], locale),
    }))

  return (
    <Container>
      <PageHeading title={dict.photos.title} intro={dict.photos.intro} />

      {isUnsynced(photoSnapshot) || items.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-edge p-6 text-sm text-muted">
          {dict.photos.empty}{' '}
          <a
            href={`https://t.me/${channel}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition hover:text-ink"
          >
            {dict.photos.viewChannel}
          </a>
        </p>
      ) : (
        <>
          <PhotoGallery
            items={items}
            closeLabel={dict.photos.close}
            openLabelPrefix={dict.photos.open}
            viewOnTelegram={dict.photos.viewOnTelegram}
          />
          <p className="mt-6 font-mono text-[10.5px] text-muted">
            {dict.photos.syncedAt}{' '}
            <time dateTime={syncedAt}>{syncedAt.slice(0, 10)}</time> ·{' '}
            <a
              href={`https://t.me/${channel}`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-ink"
            >
              @{channel}
            </a>
          </p>
        </>
      )}
    </Container>
  )
}
