import Link from 'next/link'
import { localePath, type Locale } from '@/lib/i18n'
import { slugify } from '@/lib/blog/slug'
import type { PostMeta } from '@/lib/blog/types'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'

interface PostCardProps {
  post: PostMeta
  locale: Locale
  readingTimeLabel: string
  draftLabel: string
  /** Bigger type and the accent wash — used for the newest post in a list. */
  featured?: boolean
  className?: string
}

/**
 * One post in a listing. Tags link to their tag page rather than filtering in
 * place: a static export has no query-string routing, and a real URL is
 * shareable anyway.
 */
export function PostCard({
  post,
  locale,
  readingTimeLabel,
  draftLabel,
  featured = false,
  className = '',
}: PostCardProps) {
  return (
    <Card as="article" featured={featured} className={className}>
      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          {post.draft ? (
            <p className="mb-2 font-mono text-[10.5px] font-semibold tracking-[0.1em] text-accent uppercase">
              {draftLabel}
            </p>
          ) : null}

          <h2
            className={
              featured
                ? 'text-2xl leading-tight font-semibold tracking-tight'
                : 'text-lg leading-snug font-semibold tracking-tight'
            }
          >
            <Link href={localePath(locale, `blog/${post.slug}`)}>{post.title}</Link>
          </h2>

          <p className="mt-2 max-w-[58ch] text-sm text-muted">{post.summary}</p>

          {post.tags.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <li key={tag}>
                  <Link href={localePath(locale, `blog/tag/${slugify(tag)}`)}>
                    <Chip>{tag}</Chip>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <p className="font-mono text-[11px] text-muted">
          <time dateTime={post.date}>{post.date}</time> · {post.readingMinutes}{' '}
          {readingTimeLabel}
        </p>
      </div>
    </Card>
  )
}
