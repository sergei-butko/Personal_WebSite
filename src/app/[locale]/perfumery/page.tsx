import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { loadThreadsSnapshot } from '@/lib/threads/snapshot'
import { isUnsynced } from '@/lib/threads/types'
import { ScentGrid, type ScentCard } from '@/components/threads/scent-grid'
import { PerfumeryHeader } from '@/components/threads/perfumery-header'
import { PerfumeryEmpty } from '@/components/threads/notices'
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

/** The bottles: one card per post, newest first. See ./wardrobe for the other view. */
export default async function PerfumeryPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)
  const snapshot = await loadThreadsSnapshot()
  const { posts, username } = snapshot

  const cards: ScentCard[] = posts.map((post) => {
    const image = post.images[0]
    return {
      id: post.id,
      permalink: post.permalink,
      ...(image ? { image } : {}),
      brand: post.fragrance?.brand ?? '',
      name: post.fragrance?.name ?? '',
      fallbackText: post.text,
      images: post.images,
      text: post.text,
    }
  })

  return (
    <Container>
      <PerfumeryHeader
        title={dict.threads.title}
        tabs={perfumeryTabs(locale, {
          posts: dict.threads.viewPosts,
          wardrobe: dict.threads.viewWardrobe,
        })}
        current="posts"
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
        <ScentGrid
          cards={cards}
          strings={{
            viewOnThreads: dict.threads.viewOnThreads,
            noImage: dict.threads.noImage,
            openLabelPrefix: dict.threads.openPost,
            close: dict.threads.close,
            imageAlt: dict.threads.imageAlt,
          }}
        />
      )}
    </Container>
  )
}
