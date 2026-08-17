import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale, localePath } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { profile } from '@/content/profile'
import { socialLinks } from '@/content/social'
import { BentoGrid } from '@/components/ui/BentoGrid'
import { Card } from '@/components/ui/Card'
import { Chip, Eyebrow } from '@/components/ui/Chip'

// TODO(serhii): verify — placeholder posts until the MDX pipeline lands in Phase 3.
// These link to the blog index, not to /blog/<slug>, because post detail
// routes do not exist yet. Phase 3 switches these to per-post links.
const placeholderPosts = [
  {
    slug: 'bleu-de-chanel-2014-vs-current',
    title: 'Bleu de Chanel EDP: what changed between 2014 and the current batch',
    summary:
      'Everyone says it has been reformulated. Fewer people say what actually moved.',
    date: '2026-08-14',
    tags: ['Chanel', 'reformulation'],
    readingMinutes: 9,
  },
  {
    slug: 'reading-batch-codes',
    title: 'Reading batch codes without a decoder site',
    date: '2026-08-02',
  },
  {
    slug: 'vintage-you-remember',
    title: 'Why the vintage you remember may never have existed',
    date: '2026-07-21',
  },
] as const

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)
  const [hero, ...rest] = placeholderPosts
  const primarySocials = socialLinks.filter((link) => link.primary)

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <BentoGrid>
        {/* Newest post — the point of the page. */}
        <Card as="article" featured className="sm:col-span-2 lg:col-span-3">
          <div className="flex h-full flex-col justify-between gap-4">
            <div>
              <Eyebrow>{dict.home.latestLabel}</Eyebrow>
              <h2 className="font-serif text-2xl leading-tight font-semibold tracking-tight">
                <Link href={localePath(locale, 'blog')}>{hero.title}</Link>
              </h2>
              <p className="mt-2 max-w-[52ch] text-sm text-muted">{hero.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {hero.tags.map((tag) => (
                  <Chip key={tag}>{tag}</Chip>
                ))}
              </div>
            </div>
            <p className="font-mono text-[11px] text-muted">
              <time dateTime={hero.date}>{hero.date}</time> · {hero.readingMinutes}{' '}
              {dict.common.readingTime}
            </p>
          </div>
        </Card>

        {/* Who I am — personal first. */}
        <Card className="flex flex-col gap-3">
          <div
            aria-hidden="true"
            className="grid h-14 w-14 place-items-center rounded-2xl bg-linear-135 from-accent to-accent-2 text-lg font-bold text-white"
          >
            {profile.initials}
          </div>
          <div>
            <h2 className="font-serif text-base font-semibold">{profile.name}</h2>
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
        <Card className="sm:col-span-2">
          <Eyebrow>{dict.home.moreWriting}</Eyebrow>
          <ul>
            {rest.map((post) => (
              <li
                key={post.slug}
                className="border-b border-edge py-2.5 last:border-0 last:pb-0"
              >
                <h3 className="font-serif text-sm font-semibold">
                  <Link href={localePath(locale, 'blog')}>{post.title}</Link>
                </h3>
                <time dateTime={post.date} className="font-mono text-[10.5px] text-muted">
                  {post.date}
                </time>
              </li>
            ))}
          </ul>
        </Card>

        {/* Photos — filled by the Telegram mirror in Phase 4. */}
        <Card className="sm:col-span-2">
          <Eyebrow>{dict.home.photos}</Eyebrow>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }, (_, i) => (
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
          <p className="font-serif text-3xl leading-none font-semibold tracking-tight text-accent">
            &mdash;
          </p>
          <p className="mt-1 text-xs text-muted">{dict.home.bottles}</p>
        </Card>

        <Card>
          <p className="font-serif text-3xl leading-none font-semibold tracking-tight text-accent">
            {placeholderPosts.length}
          </p>
          <p className="mt-1 text-xs text-muted">{dict.home.postsWritten}</p>
        </Card>

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
