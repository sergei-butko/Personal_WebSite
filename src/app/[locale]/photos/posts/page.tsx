import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { loadPhotoSnapshot } from '@/lib/photos/snapshot'
import { isUnsynced } from '@/lib/photos/types'
import { resolveAlt } from '@/lib/photos/alt'
import { groupByPost } from '@/lib/photos/group'
import { PostGallery, type PostGroup } from '@/components/photos/post-gallery'
import { PhotoViewSwitch } from '@/components/photos/view-switch'
import { PhotosEmpty, SyncedNote } from '@/components/photos/notices'
import { Container, PageHeading } from '@/components/layout/container'

/**
 * The same photos as ../, grouped back into the Telegram posts they were
 * published in, with each post's own text above its images.
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
      caption: post.caption,
      items: post.photos.map((photo) => ({
        photo,
        alt: resolveAlt(photo, locale, dict.photos.genericAlt),
      })),
    })
  )

  return (
    <Container>
      <PageHeading title={dict.photos.title} intro={dict.photos.byPostIntro} />

      <PhotoViewSwitch
        locale={locale}
        current="posts"
        allLabel={dict.photos.viewAll}
        byPostLabel={dict.photos.viewByPost}
      />

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
            closeLabel={dict.photos.close}
            openLabelPrefix={dict.photos.open}
            viewOnTelegram={dict.photos.viewOnTelegram}
            previousLabel={dict.photos.previous}
            nextLabel={dict.photos.next}
            countOne={dict.photos.countOne}
            countMany={dict.photos.countMany}
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
