import type { ThreadsPost } from '@/lib/threads'
import type { Locale } from '@/lib/i18n'
import { Card } from '@/components/ui/Card'
import { ThreadsPicture } from '@/components/ui/ThreadsImage'

/**
 * Alt-text policy. Threads does not require alt text, so most images arrive
 * with none, and a blank alt is only correct when surrounding text already
 * conveys the meaning. So:
 *
 *   1. Meta's alt_text, when the author wrote one — always wins.
 *   2. Otherwise, if the post has body text, alt="" is correct: the image is
 *      illustrative and the text is right there. Duplicating it would make
 *      screen readers repeat themselves.
 *   3. Otherwise the image IS the post, and silence is a real failure. Fall
 *      back to an honest locator rather than pretending it is decorative.
 *
 * Only case 3 is unsatisfying, and the fix is writing alt text on Threads.
 */
function resolveAlt(post: ThreadsPost, index: number, fallback: string): string {
  const authored = post.images[index]?.alt
  if (authored) return authored
  if (post.text) return ''
  return fallback
}

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'uk' ? 'uk-UA' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso))
}

export function ThreadsPostCard({
  post,
  locale,
  imageFallbackAlt,
  className = '',
}: {
  post: ThreadsPost
  locale: Locale
  imageFallbackAlt: string
  className?: string
}) {
  return (
    <Card as="article" className={className}>
      {post.text ? (
        <p className="text-[14px] leading-relaxed whitespace-pre-line">{post.text}</p>
      ) : null}

      {post.images.length > 0 ? (
        <div
          className={[
            'mt-3 grid gap-2',
            post.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
          ].join(' ')}
        >
          {post.images.map((image, index) => (
            <ThreadsPicture
              key={image.publicId}
              image={{ ...image, alt: resolveAlt(post, index, imageFallbackAlt) }}
            />
          ))}
        </div>
      ) : null}

      <p className="mt-3 font-mono text-[10.5px] text-muted">
        <a
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="transition hover:text-ink"
        >
          <time dateTime={post.timestamp}>{formatDate(post.timestamp, locale)}</time>
        </a>
      </p>
    </Card>
  )
}
