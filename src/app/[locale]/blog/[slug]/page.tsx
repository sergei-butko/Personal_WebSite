import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isLocale, localeNames, localePath, type Locale } from '@/lib/i18n'
import { getDictionary, type Dictionary } from '@/content/i18n'
import { getAdjacentPosts, getAllSlugs, getPost, getTranslations } from '@/lib/posts'
import { compileMdx } from '@/lib/mdx'
import { slugify } from '@/lib/slug'
import { Container } from '@/components/layout/Container'
import { Chip } from '@/components/ui/Chip'
import { FragranceCard } from '@/components/sections/FragranceCard'
import { mdxComponents } from '@/components/mdx/MdxComponents'

/**
 * Every slug is generated in every language, including the ones it has not
 * been translated into. Those render a pointer to the languages that do have
 * it — a reader who hits the language switcher halfway through an article
 * lands somewhere useful instead of on a 404.
 */
/** Placeholder route so an empty blog still satisfies `output: 'export'`. */
const EMPTY_PARAM = { slug: '__no-posts__' }

export async function generateStaticParams({
  params,
}: {
  params: { locale: string }
}): Promise<Array<{ slug: string }>> {
  if (!isLocale(params.locale)) return [EMPTY_PARAM]
  const slugs = await getAllSlugs()
  // `output: 'export'` treats an empty array as a build error, so an
  // all-drafts or brand-new blog would fail to build. Emit one sentinel
  // route instead; the page below calls notFound() for it, which renders
  // the ordinary 404. Nothing links to it.
  return slugs.length > 0 ? slugs.map((slug) => ({ slug })) : [EMPTY_PARAM]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale)) return {}

  const post = await getPost(locale, slug)
  if (!post) {
    // Untranslated stubs exist for navigation, not for search results.
    return { robots: { index: false, follow: true } }
  }

  return {
    title: post.title,
    description: post.summary,
    other: { 'article:published_time': post.date },
  }
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)
  const post = await getPost(locale, slug)

  if (!post) {
    const translations = await getTranslations(slug)
    if (translations.length === 0) notFound()
    return (
      <UntranslatedPost
        locale={locale}
        slug={slug}
        available={translations}
        dict={dict}
      />
    )
  }

  const Content = await compileMdx(post.body)
  const { previous, next } = await getAdjacentPosts(locale, slug)

  return (
    <Container>
      <article className="mx-auto max-w-2xl">
        <p className="mb-6">
          <Link
            href={localePath(locale, 'blog')}
            className="font-mono text-[11px] text-muted transition hover:text-ink"
          >
            &larr; {dict.blog.backToBlog}
          </Link>
        </p>

        <header className="mb-8">
          {post.draft ? (
            <p className="mb-2 font-mono text-[10.5px] font-semibold tracking-[0.1em] text-accent uppercase">
              {dict.blog.draft}
            </p>
          ) : null}

          <h1 className="font-serif text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-3 text-[15px] text-muted">{post.summary}</p>

          <p className="mt-4 font-mono text-[11px] text-muted">
            <time dateTime={post.date}>{post.date}</time> · {post.readingMinutes}{' '}
            {dict.common.readingTime}
            {post.updated ? (
              <>
                {' · '}
                {dict.blog.updated} <time dateTime={post.updated}>{post.updated}</time>
              </>
            ) : null}
          </p>

          {post.tags.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <li key={tag}>
                  <Link href={localePath(locale, `blog/tag/${slugify(tag)}`)}>
                    <Chip>{tag}</Chip>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </header>

        {post.fragrance ? (
          <FragranceCard fragrance={post.fragrance} labels={{ ...dict.fragrance }} />
        ) : null}

        <div className="prose">
          <Content components={mdxComponents} />
        </div>

        {previous || next ? (
          <nav className="mt-14 grid grid-cols-1 gap-3 border-t border-edge pt-6 sm:grid-cols-2">
            {previous ? (
              <PostLink
                post={previous}
                locale={locale}
                label={dict.blog.previous}
                align="left"
              />
            ) : (
              <span />
            )}
            {next ? (
              <PostLink
                post={next}
                locale={locale}
                label={dict.blog.next}
                align="right"
              />
            ) : null}
          </nav>
        ) : null}
      </article>
    </Container>
  )
}

function PostLink({
  post,
  locale,
  label,
  align,
}: {
  post: { slug: string; title: string }
  locale: Locale
  label: string
  align: 'left' | 'right'
}) {
  return (
    <Link
      href={localePath(locale, `blog/${post.slug}`)}
      className={`group rounded-[var(--radius-card)] border border-edge p-4 transition hover:border-accent ${
        align === 'right' ? 'sm:text-right' : ''
      }`}
    >
      <span className="block font-mono text-[10.5px] tracking-[0.1em] text-muted uppercase">
        {label}
      </span>
      <span className="mt-1 block font-serif text-sm font-semibold">{post.title}</span>
    </Link>
  )
}

/**
 * The slug exists, just not in this language. Deliberately not a 404: the
 * reader asked for a specific article and we know exactly where it lives.
 */
function UntranslatedPost({
  locale,
  slug,
  available,
  dict,
}: {
  locale: Locale
  slug: string
  available: Locale[]
  dict: Dictionary
}) {
  return (
    <Container>
      <div className="mx-auto max-w-2xl">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">
          {dict.blog.notTranslatedTitle}
        </h1>
        <p className="mt-2 text-muted">{dict.blog.notTranslatedBody}</p>

        <ul className="mt-5 flex flex-wrap gap-2">
          {available.map((other) => (
            <li key={other}>
              <Link
                href={localePath(other, `blog/${slug}`)}
                hrefLang={other}
                className="inline-block rounded-md border border-edge px-4 py-2 font-mono text-sm transition hover:border-accent"
              >
                {localeNames[other]}
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-8">
          <Link
            href={localePath(locale, 'blog')}
            className="font-mono text-[11px] text-muted transition hover:text-ink"
          >
            &larr; {dict.blog.backToBlog}
          </Link>
        </p>
      </div>
    </Container>
  )
}
