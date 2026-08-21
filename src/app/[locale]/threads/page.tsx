import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { threadsSnapshot } from '@/content/threads.generated'
import { isUnsynced } from '@/lib/threads/types'
import { ThreadsPostCard } from '@/components/threads/post-card'
import { Container, PageHeading } from '@/components/layout/container'

export default async function ThreadsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)
  const { posts, username, syncedAt } = threadsSnapshot

  return (
    <Container>
      <PageHeading title={dict.threads.title} intro={dict.threads.intro} />

      {isUnsynced(threadsSnapshot) ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-edge p-6 text-sm text-muted">
          {dict.threads.empty}{' '}
          <a
            href={`https://www.threads.com/@${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition hover:text-ink"
          >
            {dict.threads.viewOnThreads}
          </a>
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {posts.map((post) => (
              <ThreadsPostCard
                key={post.id}
                post={post}
                locale={locale}
                imageFallbackAlt={dict.threads.imageAlt}
              />
            ))}
          </div>
          <p className="mt-6 font-mono text-[10.5px] text-muted">
            {dict.threads.syncedAt}{' '}
            <time dateTime={syncedAt}>{syncedAt.slice(0, 10)}</time> ·{' '}
            <a
              href={`https://www.threads.com/@${username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-ink"
            >
              @{username}
            </a>
          </p>
        </>
      )}
    </Container>
  )
}
