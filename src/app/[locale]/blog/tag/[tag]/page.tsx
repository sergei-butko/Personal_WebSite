import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale, type Locale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { getPostsByTag, getTags } from '@/lib/posts'
import { Container, PageHeading } from '@/components/layout/Container'
import { PostList } from '@/components/sections/PostList'
import { TagFilter } from '@/components/sections/TagFilter'

/**
 * One pre-rendered page per tag per language. Tags are written in the
 * language of the post, so the two locales have genuinely different tag sets
 * rather than translations of one set.
 */
/** Placeholder route so a tagless blog still satisfies `output: 'export'`. */
const EMPTY_PARAM = { tag: '__no-tags__' }

export async function generateStaticParams({
  params,
}: {
  params: { locale: string }
}): Promise<Array<{ tag: string }>> {
  if (!isLocale(params.locale)) return [EMPTY_PARAM]
  const tags = await getTags(params.locale)
  // Same `output: 'export'` constraint as the [slug] route.
  return tags.length > 0 ? tags.map((tag) => ({ tag: tag.slug })) : [EMPTY_PARAM]
}

async function resolve(locale: Locale, tagSlug: string) {
  const tags = await getTags(locale)
  return tags.find((tag) => tag.slug === tagSlug)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; tag: string }>
}): Promise<Metadata> {
  const { locale, tag } = await params
  if (!isLocale(locale)) return {}
  const match = await resolve(locale, tag)
  if (!match) return {}
  const dict = getDictionary(locale)
  return {
    title: `${dict.blog.taggedPrefix}: ${match.label}`,
    description: dict.blog.taggedIntro,
  }
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ locale: string; tag: string }>
}) {
  const { locale, tag } = await params
  if (!isLocale(locale)) notFound()

  const match = await resolve(locale, tag)
  if (!match) notFound()

  const dict = getDictionary(locale)
  const [posts, tags] = await Promise.all([getPostsByTag(locale, tag), getTags(locale)])

  return (
    <Container>
      <PageHeading
        title={`${dict.blog.taggedPrefix}: ${match.label}`}
        intro={dict.blog.taggedIntro}
      />
      <TagFilter
        tags={tags}
        locale={locale}
        activeSlug={tag}
        allLabel={dict.blog.allTags}
        legend={dict.blog.filterLegend}
      />
      <PostList
        posts={posts}
        locale={locale}
        readingTimeLabel={dict.common.readingTime}
        draftLabel={dict.blog.draft}
        emptyLabel={dict.blog.empty}
      />
    </Container>
  )
}
