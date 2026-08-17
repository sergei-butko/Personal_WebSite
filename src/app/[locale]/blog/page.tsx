import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { getPosts, getTags } from '@/lib/posts'
import { Container, PageHeading } from '@/components/layout/Container'
import { PostList } from '@/components/sections/PostList'
import { TagFilter } from '@/components/sections/TagFilter'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const dict = getDictionary(locale)
  return { title: dict.blog.title, description: dict.blog.intro }
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)
  const [posts, tags] = await Promise.all([getPosts(locale), getTags(locale)])

  return (
    <Container>
      <PageHeading title={dict.blog.title} intro={dict.blog.intro} />
      <TagFilter
        tags={tags}
        locale={locale}
        allLabel={dict.blog.allTags}
        legend={dict.blog.filterLegend}
      />
      <PostList
        posts={posts}
        locale={locale}
        readingTimeLabel={dict.common.readingTime}
        draftLabel={dict.blog.draft}
        emptyLabel={dict.blog.empty}
        featureFirst
      />
    </Container>
  )
}
