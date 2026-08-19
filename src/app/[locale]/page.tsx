import type { CSSProperties } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale, localePath } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { profile } from '@/content/profile'
import { links } from '@/lib/links'
import { getPlatform } from '@/lib/platforms'
import { PlatformIcon } from '@/components/ui/PlatformIcon'
import { BentoGrid } from '@/components/ui/BentoGrid'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Chip'
import { threadsSnapshot } from '@/content/threads.generated'
import { photoSnapshot } from '@/content/photos.generated'
import { photoOverrides } from '@/content/photo-meta'
import { resolveAlt } from '@/lib/photo-alt'
import { basePath } from '@/lib/paths'
import { PhotoImage } from '@/components/ui/PhotoImage'

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)
  const recentPhotos = photoSnapshot.photos
    .filter((photo) => !photoOverrides[photo.id]?.hidden)
    .slice(0, 12)

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <BentoGrid>
        {/* Row 1 — Threads, three quarters. */}
        <Card as="article" className="sm:col-span-2 lg:col-span-3">
          <div className="flex h-full flex-col justify-between gap-4">
            <div>
              <span className="mb-2.5 flex items-center gap-2">
                <PlatformIcon platform="threads" className="h-4 w-4" />
                <Eyebrow>{dict.home.threads}</Eyebrow>
              </span>
              {threadsSnapshot.posts.length > 0 ? (
                <ul className="flex flex-col gap-2.5">
                  {threadsSnapshot.posts.slice(0, 3).map((post) => (
                    <li
                      key={post.id}
                      className="border-b border-edge pb-2.5 last:border-0 last:pb-0"
                    >
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="line-clamp-2 text-[14px] leading-relaxed transition hover:text-accent"
                      >
                        {post.text || post.permalink}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">{dict.threads.empty}</p>
              )}
            </div>
            <p className="text-[11px]">
              <Link href={localePath(locale, 'threads')} className="text-accent">
                {dict.home.threadsAll} &rarr;
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
         * Row 2 — a quarter-width slot Serhii has not decided on yet. The
         * collection count is a placeholder that at least says something true;
         * swapping it is one card.
         */}
        <Card>
          <Eyebrow>{dict.home.collection}</Eyebrow>
          <p className="text-3xl leading-none font-semibold tracking-tight text-accent">
            &mdash;
          </p>
          <p className="mt-1 text-xs text-muted">{dict.home.bottles}</p>
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
                  key={`${photo.id}-${photo.src}`}
                  href={localePath(locale, 'photos')}
                  className="overflow-hidden rounded-xl border border-edge"
                >
                  <PhotoImage
                    photo={photo}
                    alt={resolveAlt(
                      photo,
                      photoOverrides[photo.id],
                      locale,
                      dict.photos.genericAlt
                    )}
                    basePath={basePath}
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

        {/* Row 3 — unchanged: links directory and the day job. */}
        <Card className="sm:col-span-2">
          <Eyebrow>{dict.links.homeLabel}</Eyebrow>
          <ul className="flex flex-wrap gap-2">
            {links.map((link) => {
              const brand = getPlatform(link.platform)
              return (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                    rel={`${link.identity ? 'me ' : ''}noopener noreferrer`.trim()}
                    title={link.label}
                    style={{ ['--brand']: brand.light } as CSSProperties}
                    className="flex items-center gap-1.5 rounded-full border border-edge px-2.5 py-1.5 transition hover:border-[var(--brand)]"
                  >
                    <PlatformIcon platform={link.platform} className="h-4 w-4" />
                    <span className="text-[11px] font-medium text-muted">
                      {link.label}
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-[11px]">
            <Link href={localePath(locale, 'links')} className="text-accent">
              {dict.links.all} &rarr;
            </Link>
          </p>
        </Card>

        <Card className="sm:col-span-2">
          <Eyebrow>{dict.home.dayJob}</Eyebrow>
          <h2 className="text-[15px] font-semibold">
            <Link href={localePath(locale, 'cv')}>
              {dict.home.dayJobTitle}{' '}
              <span
                aria-hidden="true"
                className="inline-block transition group-hover:translate-x-1"
              >
                &rarr;
              </span>
            </Link>
          </h2>
          <p className="mt-1 text-[13px] text-muted">{dict.home.dayJobBody}</p>
        </Card>
      </BentoGrid>
    </main>
  )
}
