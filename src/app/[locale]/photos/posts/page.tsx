import { notFound } from 'next/navigation'
import { isLocale, localePath } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { loadPhotoSnapshot } from '@/lib/photos/snapshot'
import { LivePostGallery } from '@/components/photos/live-photos'
import { ViewSwitch } from '@/components/ui/view-switch'
import { ChannelButton } from '@/components/photos/channel-button'
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
          current="posts"
        />
        <ChannelButton channel={channel} label={dict.photos.viewOnTelegram} />
      </div>

      {/* Refreshed in the browser, like the all-photos view. */}
      <LivePostGallery
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
    </Container>
  )
}
