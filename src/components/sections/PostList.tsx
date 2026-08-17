import type { Locale } from '@/lib/i18n'
import type { PostMeta } from '@/lib/types'
import { PostCard } from '@/components/sections/PostCard'

interface PostListProps {
  posts: PostMeta[]
  locale: Locale
  readingTimeLabel: string
  draftLabel: string
  emptyLabel: string
  /** Give the newest post the hero treatment. Off on tag pages. */
  featureFirst?: boolean
}

/**
 * The bento mosaic applied to a post list: the newest post takes the full
 * width, the rest pair up. Shared by the blog index and every tag page so the
 * two cannot drift apart.
 */
export function PostList({
  posts,
  locale,
  readingTimeLabel,
  draftLabel,
  emptyLabel,
  featureFirst = false,
}: PostListProps) {
  if (posts.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] border border-dashed border-edge p-6 text-sm text-muted">
        {emptyLabel}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {posts.map((post, index) => {
        const featured = featureFirst && index === 0
        return (
          <PostCard
            key={post.slug}
            post={post}
            locale={locale}
            readingTimeLabel={readingTimeLabel}
            draftLabel={draftLabel}
            featured={featured}
            className={featured ? 'sm:col-span-2' : ''}
          />
        )
      })}
    </div>
  )
}
