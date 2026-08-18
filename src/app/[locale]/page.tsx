import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale, localePath } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { profile } from '@/content/profile'
import { socialLinks } from '@/content/social'
import { BentoGrid } from '@/components/ui/BentoGrid'
import { Card } from '@/components/ui/Card'
import { Chip, Eyebrow } from '@/components/ui/Chip'
import { threadsSnapshot } from '@/content/threads.generated'
import { photoSnapshot } from '@/content/photos.generated'
import { photoOverrides } from '@/content/photo-meta'
import { resolveAlt } from '@/lib/photo-alt'
import { basePath } from '@/lib/paths'
import { PhotoImage } from '@/components/ui/PhotoImage'
import { getPosts } from '@/lib/posts'
import { slugify } from '@/lib/slug'

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)
  const posts = await getPosts(locale)
  const [hero, ...rest] = posts
  const primarySocials = socialLinks.filter((link) => link.primary)
  const recentPhotos = photoSnapshot.photos
    .filter((photo) => !photoOverrides[photo.id]?.hidden)
    .slice(0, 8)

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <BentoGrid>
        {/* Newest post — the point of the page. */}
        {hero ? (
          <Card as="article" featured className="sm:col-span-2 lg:col-span-3">
            <div className="flex h-full flex-col justify-between gap-4">
              <div>
                <Eyebrow>{dict.home.latestLabel}</Eyebrow>
                <h2 className="text-2xl leading-tight font-semibold tracking-tight">
                  <Link href={localePath(locale, `blog/${hero.slug}`)}>{hero.title}</Link>
                </h2>
                <p className="mt-2 max-w-[52ch] text-sm text-muted">{hero.summary}</p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {hero.tags.map((tag) => (
                    <li key={tag}>
                      <Link href={localePath(locale, `blog/tag/${slugify(tag)}`)}>
                        <Chip>{tag}</Chip>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="font-mono text-[11px] text-muted">
                <time dateTime={hero.date}>{hero.date}</time> · {hero.readingMinutes}{' '}
                {dict.common.readingTime}
              </p>
            </div>
          </Card>
        ) : (
          <Card className="sm:col-span-2 lg:col-span-3">
            <Eyebrow>{dict.home.latestLabel}</Eyebrow>
            <p className="text-sm text-muted">{dict.blog.empty}</p>
          </Card>
        )}

        {/* Who I am — personal first. */}
        <Card className="flex flex-col gap-3">
          <div
            aria-hidden="true"
            className="grid h-14 w-14 place-items-center rounded-2xl bg-linear-135 from-accent to-accent-2 text-lg font-bold text-white"
          >
            {profile.initials}
          </div>
          <div>
            <h2 className="text-base font-semibold">{profile.name}</h2>
            <p className="text-accent mt-0.5 text-xs font-semibold">
              {profile.headline[locale]}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {profile.location[locale]}. {profile.bio[locale]}
            </p>
          </div>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {primarySocials.map((link) => (
              <li key={link.platform}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="me noopener noreferrer"
                  className="inline-block rounded-full border border-edge px-2.5 py-1 text-[11px] font-medium text-muted transition hover:text-ink"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </Card>

        {/* Recent writing. */}
        {rest.length > 0 ? (
          <Card className="sm:col-span-2">
            <Eyebrow>{dict.home.moreWriting}</Eyebrow>
            <ul>
              {rest.slice(0, 4).map((post) => (
                <li
                  key={post.slug}
                  className="border-b border-edge py-2.5 last:border-0 last:pb-0"
                >
                  <h3 className="text-sm font-semibold">
                    <Link href={localePath(locale, `blog/${post.slug}`)}>
                      {post.title}
                    </Link>
                  </h3>
                  <time
                    dateTime={post.date}
                    className="font-mono text-[10.5px] text-muted"
                  >
                    {post.date}
                  </time>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px]">
              <Link href={localePath(locale, 'blog')} className="text-accent">
                {dict.blog.backToBlog} &rarr;
              </Link>
            </p>
          </Card>
        ) : null}

        {/* Photos — filled by the Telegram mirror in Phase 4. */}
        <Card className="sm:col-span-2">
          <Eyebrow>{dict.home.photos}</Eyebrow>
          <div className="grid grid-cols-4 gap-2">
            {recentPhotos.length > 0
              ? recentPhotos.map((photo) => (
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
                ))
              : // Placeholders until the first sync, so the tile keeps its shape.
                Array.from({ length: 8 }, (_, i) => (
                  <div
                    key={i}
                    aria-hidden="true"
                    className="aspect-square rounded-xl border border-edge bg-chip"
                  />
                ))}
          </div>
          <p className="mt-3 font-mono text-[10.5px] text-muted">
            {dict.home.photosSynced}
          </p>
        </Card>

        <Card>
          <Eyebrow>{dict.home.collection}</Eyebrow>
          <p className="text-3xl leading-none font-semibold tracking-tight text-accent">
            &mdash;
          </p>
          <p className="mt-1 text-xs text-muted">{dict.home.bottles}</p>
        </Card>

        <Card>
          <p className="text-3xl leading-none font-semibold tracking-tight text-accent">
            {posts.length}
          </p>
          <p className="mt-1 text-xs text-muted">{dict.home.postsWritten}</p>
        </Card>

        {/* Latest from Threads. Renders nothing until the first sync. */}
        {threadsSnapshot.posts.length > 0 ? (
          <Card className="sm:col-span-2">
            <Eyebrow>{dict.home.threads}</Eyebrow>
            <ul>
              {threadsSnapshot.posts.slice(0, 3).map((post) => (
                <li
                  key={post.id}
                  className="border-b border-edge py-2 last:border-0 last:pb-0"
                >
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="line-clamp-2 text-[13px] text-muted transition hover:text-ink"
                  >
                    {post.text || post.permalink}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px]">
              <Link href={localePath(locale, 'threads')} className="text-accent">
                {dict.home.threadsAll} &rarr;
              </Link>
            </p>
          </Card>
        ) : null}

        {/* Engineering, deliberately understated. */}
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
