import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { loadThreadsSnapshot } from '@/lib/threads/snapshot'
import { LiveScentGrid } from '@/components/threads/live-perfumery'
import { PerfumeryHeader } from '@/components/threads/perfumery-header'
import { perfumeryTabs } from '@/lib/threads/tabs'
import { Container } from '@/components/layout/container'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  // The locale layout titles every page "Serhii Butko". This one earns its own
  // tab — naming it is most of the point of the rename.
  return { title: `${getDictionary(locale).threads.title} — Serhii Butko` }
}

/** The bottles: one card per post, newest first. See ./shelf for the other view. */
export default async function PerfumeryPage({
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
        current="posts"
        threadsHref={`https://www.threads.com/@${username}`}
        viewOnThreads={dict.threads.viewOnThreads}
      />

      {/*
       * Rendered from the snapshot the build fetched, then re-rendered in the
       * browser if `data/threads.json` has moved on — so `content:push` shows
       * up without a deploy. See components/threads/live-perfumery.tsx.
       */}
      <LiveScentGrid
        initial={snapshot}
        strings={{
          viewOnThreads: dict.threads.viewOnThreads,
          noImage: dict.threads.noImage,
          openLabelPrefix: dict.threads.openPost,
          close: dict.threads.close,
          imageAlt: dict.threads.imageAlt,
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
