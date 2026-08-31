import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { loadThreadsSnapshot } from '@/lib/threads/snapshot'
import { isUnsynced } from '@/lib/threads/types'
import { buildShelves } from '@/lib/threads/wardrobe'
import { PerfumeryHeader } from '@/components/threads/perfumery-header'
import { PerfumeryEmpty } from '@/components/threads/notices'
import { Wardrobe } from '@/components/threads/wardrobe-shelves'
import { Container } from '@/components/layout/container'
import { perfumeryTabs } from '@/lib/threads/tabs'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const dict = getDictionary(locale)
  return { title: `${dict.threads.viewWardrobe} — ${dict.threads.title} — Serhii Butko` }
}

/**
 * The wardrobe: a shelf per house, alphabetical, scrolling sideways when a
 * house owns more bottles than a row holds. See ../page.tsx for the other view.
 *
 * The grouping is a build-time pure function over the same snapshot the bottles
 * grid renders — there is no second store and nothing to keep in step. Which
 * house a bottle belongs to is `fragrance.brand`, hand-written in the snapshot,
 * so the shelves are only ever as good as those fields.
 */
export default async function WardrobePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)
  const snapshot = await loadThreadsSnapshot()
  const { posts, username } = snapshot

  return (
    <Container>
      <PerfumeryHeader
        title={dict.threads.title}
        tabs={perfumeryTabs(locale, {
          posts: dict.threads.viewPosts,
          wardrobe: dict.threads.viewWardrobe,
        })}
        current="wardrobe"
        threadsHref={`https://www.threads.com/@${username}`}
        viewOnThreads={dict.threads.viewOnThreads}
      />

      {isUnsynced(snapshot) ? (
        <PerfumeryEmpty
          message={dict.threads.empty}
          href={`https://www.threads.com/@${username}`}
          linkLabel={dict.threads.viewOnThreads}
        />
      ) : (
        <Wardrobe
          shelves={buildShelves(posts, locale)}
          strings={{
            unnamed: dict.threads.wardrobeUnnamed,
            noImage: dict.threads.noImage,
            openLabelPrefix: dict.threads.openPost,
            close: dict.threads.close,
            viewOnThreads: dict.threads.viewOnThreads,
            imageAlt: dict.threads.imageAlt,
            scrollBack: dict.threads.shelfBack,
            scrollForward: dict.threads.shelfForward,
          }}
        />
      )}
    </Container>
  )
}
