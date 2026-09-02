import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { loadThreadsSnapshot } from '@/lib/threads/snapshot'
import { LiveShelves } from '@/components/threads/live-perfumery'
import { PerfumeryHeader } from '@/components/threads/perfumery-header'
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
  return { title: `${dict.threads.viewShelf} — ${dict.threads.title} — Serhii Butko` }
}

/**
 * The shelf view: one shelf per house, alphabetical, scrolling sideways when a
 * house owns more bottles than a row holds. See ../page.tsx for the other view.
 *
 * The grouping is a build-time pure function over the same snapshot the bottles
 * grid renders — there is no second store and nothing to keep in step. Which
 * house a bottle belongs to is `fragrance.brand`, hand-written in the snapshot,
 * so the shelves are only ever as good as those fields.
 */
export default async function ShelfPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)
  const snapshot = await loadThreadsSnapshot()
  const { username } = snapshot

  return (
    <Container>
      <PerfumeryHeader
        title={dict.threads.title}
        tabs={perfumeryTabs(locale, {
          posts: dict.threads.viewPosts,
          shelf: dict.threads.viewShelf,
        })}
        current="shelf"
        threadsHref={`https://www.threads.com/@${username}`}
        viewOnThreads={dict.threads.viewOnThreads}
      />

      {/* Refreshed in the browser, like the bottles grid. */}
      <LiveShelves
        initial={snapshot}
        locale={locale}
        strings={{
          unnamed: dict.threads.shelfUnnamed,
          noImage: dict.threads.noImage,
          openLabelPrefix: dict.threads.openPost,
          close: dict.threads.close,
          viewOnThreads: dict.threads.viewOnThreads,
          imageAlt: dict.threads.imageAlt,
          scrollBack: dict.threads.shelfBack,
          scrollForward: dict.threads.shelfForward,
        }}
        empty={{
          message: dict.threads.empty,
          href: `https://www.threads.com/@${username}`,
          linkLabel: dict.threads.viewOnThreads,
        }}
      />
    </Container>
  )
}
