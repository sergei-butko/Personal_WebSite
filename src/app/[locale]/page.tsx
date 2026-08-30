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
   * The four most recent posts that actually have a picture. `flatMap` rather
   * than filter-then-map so the narrowed type survives: `post.images[0]` is
   * possibly-undefined, and a filter does not tell TypeScript otherwise.
   */
  const perfumeryThumbs = threadsSnapshot.posts
    .flatMap((post) => {
      const image = post.images[0]
      return image ? [{ id: post.id, image }] : []
    })
    .slice(0, 4)

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <BentoGrid>
        {/* Row 1 — Threads, three quarters. */}
        <Card as="article" className="sm:col-span-2 lg:col-span-3">
          <div className="flex h-full flex-col justify-between gap-4">
            <div>
              <span className="mb-2.5 flex items-center gap-2">
                <PlatformIcon platform="threads" className="h-4 w-4" />
                <Eyebrow>{dict.home.perfumery}</Eyebrow>
              </span>
              {/*
               * Four bottles, pictures only.
               *
               * This tile used to be three lines of clamped post text, which
               * on a page whose subject is fragrance told a visitor nothing
               * they could recognise — a review reads as grey text at 14px,
               * and the bottle is the thing that carries. Posts with no image
               * are skipped rather than shown as an empty square, so the tile
               * takes the four most recent that have one.
               */}
              {perfumeryThumbs.length > 0 ? (
                <ul className="grid grid-cols-4 gap-2">
                  {perfumeryThumbs.map((post) => (
                    <li key={post.id}>
                      <Link
                        href={localePath(locale, 'perfumery')}
                        className="block overflow-hidden rounded-xl border border-edge transition hover:border-accent focus-visible:border-accent"
                      >
                        <CloudinaryImage
                          asset={post.image}
                          alt={post.image.alt || dict.threads.imageAlt}
                          sizes="(max-width: 640px) 22vw, 160px"
                          className="aspect-square h-full w-full object-cover"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{dict.threads.empty}</p>
              )}
            </div>
            <p className="text-[11px]">
              <Link href={localePath(locale, 'perfumery')} className="text-accent">
                {dict.home.perfumeryAll} &rarr;
              </Link>
            </p>
          </div>
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
          <span className="mb-2.5 flex items-center gap-2">
            <PlatformIcon platform="telegram" className="h-4 w-4" />
            <Eyebrow>{dict.home.photos}</Eyebrow>
          </span>
          {recentPhotos.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {recentPhotos.map((photo) => (
                <Link
                  key={`${photo.id}-${photo.publicId}`}
                  href={localePath(locale, 'photos')}
                  className="overflow-hidden rounded-xl border border-edge"
                >
                  <CloudinaryImage
                    asset={photo}
                    alt={resolveAlt(photo, locale, dict.photos.genericAlt)}
                    sizes="(max-width: 640px) 25vw, 120px"
                    className="aspect-square h-full w-full object-cover"
                  />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">{dict.photos.empty}</p>
          )}
          <p className="mt-3 text-[11px]">
            <Link href={localePath(locale, 'photos')} className="text-accent">
              {dict.photos.title} &rarr;
            </Link>
          </p>
        </Card>
      </BentoGrid>
    </main>
  )
}
