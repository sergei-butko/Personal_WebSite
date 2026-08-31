import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale, localePath } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { profile } from '@/content/profile'
import { PlatformIcon } from '@/components/links/platform-icon'
import { BentoGrid } from '@/components/ui/bento-grid'
import { Card } from '@/components/ui/card'
import { Eyebrow } from '@/components/ui/eyebrow'
import { loadThreadsSnapshot } from '@/lib/threads/snapshot'
import { loadPhotoSnapshot } from '@/lib/photos/snapshot'
import { resolveAlt } from '@/lib/photos/alt'
import { CloudinaryImage } from '@/components/ui/cloudinary-image'

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)

  // Both snapshots come from Cloudinary at build time; fetch them together
  // rather than serially.
  const [threadsSnapshot, photoSnapshot] = await Promise.all([
    loadThreadsSnapshot(),
    loadPhotoSnapshot(),
  ])

  const recentPhotos = photoSnapshot.photos.filter((photo) => !photo.hidden).slice(0, 12)

  /*
   * The twelve most recent posts that actually have a picture — two rows of
   * six, the shape the photos tile below already uses. `flatMap` rather than
   * filter-then-map so the narrowed type survives: `post.images[0]` is
   * possibly-undefined, and a filter does not tell TypeScript otherwise.
   */
  const perfumeryThumbs = threadsSnapshot.posts
    .flatMap((post) => {
      const image = post.images[0]
      return image ? [{ id: post.id, image }] : []
    })
    .slice(0, 12)

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <BentoGrid>
        {/* Row 1 — Threads, three quarters. */}
        {/*
         * The WHOLE tile is the link, as the About and CV tiles already are.
         * It used to be twelve separate links to one destination plus a
         * thirteenth in the corner — thirteen tab stops that all went to the
         * same page, and a card that looked clickable everywhere but only was
         * on the pictures. One link is fewer stops and no dead ground.
         *
         * Which means the thumbnails must NOT be links: an <a> inside an <a>
         * is invalid, and browsers recover from it by closing the outer one
         * early, so the corner arrow would fall outside the link entirely.
         */}
        <Card as="article" className="sm:col-span-2 lg:col-span-3">
          <Link
            href={localePath(locale, 'perfumery')}
            className="flex h-full flex-col"
            aria-label={`${dict.home.perfumery}: ${dict.home.perfumeryAll}`}
          >
            <span className="mb-2.5 flex items-center gap-2">
              <PlatformIcon platform="threads" className="h-4 w-4" />
              <Eyebrow>{dict.home.perfumery}</Eyebrow>
            </span>
            {/*
             * Bottles, pictures only. This tile used to be three lines of
             * clamped post text, which on a page whose subject is fragrance
             * told a visitor nothing they could recognise. Posts with no image
             * are skipped rather than shown as an empty square.
             */}
            {perfumeryThumbs.length > 0 ? (
              <span className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {perfumeryThumbs.map((post) => (
                  <span
                    key={post.id}
                    className="block overflow-hidden rounded-xl border border-edge"
                  >
                    <CloudinaryImage
                      asset={post.image}
                      alt={post.image.alt || dict.threads.imageAlt}
                      sizes="(max-width: 640px) 25vw, 120px"
                      // Contained, like the bottles everywhere else: a quarter
                      // of these shots are portrait, and cropping one to the
                      // square takes off the cap. The photos tile below fills
                      // instead — a cropped photograph is still a photograph,
                      // a cropped bottle is a different bottle.
                      className="aspect-square h-full w-full object-contain"
                    />
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-sm text-muted">{dict.threads.empty}</span>
            )}
            <span className="mt-auto pt-3 text-[11px] text-accent">
              {dict.home.perfumeryAll} &rarr;
            </span>
          </Link>
        </Card>

        {/* Row 1 — who I am, one quarter, straight to About. */}
        <Card>
          <Link href={localePath(locale, 'about')} className="flex h-full flex-col gap-3">
            <span
              aria-hidden="true"
              className="grid h-14 w-14 place-items-center rounded-2xl bg-linear-135 from-accent to-accent-2 text-lg font-bold text-white"
            >
              {profile.initials}
            </span>
            <span>
              <span className="block text-base font-semibold">{profile.name}</span>
              <span className="mt-0.5 block text-xs font-semibold text-accent">
                {profile.headline[locale]}
              </span>
            </span>
            <span className="mt-auto text-[11px] text-accent">
              {dict.nav.about} &rarr;
            </span>
          </Link>
        </Card>

        {/*
         * Row 2 — the day job, one quarter, straight to the CV. Mirrors the
         * About tile opposite it: whole card is the link, arrow pinned to the
         * bottom, so the two quarter tiles read as a pair.
         */}
        <Card>
          <Link href={localePath(locale, 'cv')} className="flex h-full flex-col">
            <Eyebrow>{dict.home.dayJob}</Eyebrow>
            <span className="block text-[15px] font-semibold">
              {dict.home.dayJobTitle}
            </span>
            <span className="mt-1 block text-[13px] text-muted">
              {dict.home.dayJobBody}
            </span>
            <span className="mt-auto pt-3 text-[11px] text-accent">
              {dict.nav.cv} &rarr;
            </span>
          </Link>
        </Card>

        {/* Row 2 — the Telegram channel, three quarters. */}
        <Card className="sm:col-span-2 lg:col-span-3">
          <Link
            href={localePath(locale, 'photos')}
            className="flex h-full flex-col"
            aria-label={`${dict.home.photos}: ${dict.photos.title}`}
          >
            <span className="mb-2.5 flex items-center gap-2">
              <PlatformIcon platform="telegram" className="h-4 w-4" />
              <Eyebrow>{dict.home.photos}</Eyebrow>
            </span>
            {recentPhotos.length > 0 ? (
              <span className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {recentPhotos.map((photo) => (
                  <span
                    key={`${photo.id}-${photo.publicId}`}
                    className="block overflow-hidden rounded-xl border border-edge"
                  >
                    <CloudinaryImage
                      asset={photo}
                      alt={resolveAlt(photo, locale, dict.photos.genericAlt)}
                      sizes="(max-width: 640px) 25vw, 120px"
                      className="aspect-square h-full w-full object-cover"
                    />
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-sm text-muted">{dict.photos.empty}</span>
            )}
            <span className="mt-auto pt-3 text-[11px] text-accent">
              {dict.photos.title} &rarr;
            </span>
          </Link>
        </Card>
      </BentoGrid>
    </main>
  )
}
