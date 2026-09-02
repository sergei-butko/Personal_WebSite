import { notFound } from 'next/navigation'
import { isLocale, localePath } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { loadPhotoSnapshot } from '@/lib/photos/snapshot'
import { LivePhotoGallery } from '@/components/photos/live-photos'
import { ViewSwitch } from '@/components/ui/view-switch'
import { ChannelButton } from '@/components/photos/channel-button'
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
  const { channel } = photoSnapshot

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
        <ViewSwitch
          tabs={[
            {
              view: 'all',
              href: localePath(locale, 'photos'),
              label: dict.photos.viewAll,
            },
            {
              view: 'posts',
              href: localePath(locale, 'photos/posts'),
              label: dict.photos.viewByPost,
            },
          ]}
          current="all"
        />
        <ChannelButton channel={channel} label={dict.photos.viewOnTelegram} />
      </div>

      {/*
       * Rendered from the snapshot the build fetched, then re-rendered in the
       * browser if `data/photos.json` has moved on — so a caption edited with
       * `content:push` shows up without a deploy.
       */}
      <LivePhotoGallery
        initial={photoSnapshot}
        locale={locale}
        genericAlt={dict.photos.genericAlt}
        empty={{
          message: dict.photos.empty,
          channel,
          viewChannel: dict.photos.viewChannel,
        }}
        synced={{ label: dict.photos.syncedAt }}
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
    </Container>
  )
}
