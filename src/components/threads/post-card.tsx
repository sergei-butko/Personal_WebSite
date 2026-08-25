import type { ThreadsImage, ThreadsPost } from '@/lib/threads/types'
import type { Locale } from '@/lib/i18n'
import { Card } from '@/components/ui/card'
import { CloudinaryImage } from '@/components/ui/cloudinary-image'

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
function resolveAlt(
  images: ThreadsImage[],
  index: number,
  hasText: boolean,
  fallback: string
): string {
  const authored = images[index]?.alt
  if (authored) return authored
  if (hasText) return ''
  return fallback
}

/**
 * Images of a post or of its follow-up. Identical markup, so it is one
 * component rather than two that drift.
 */
function ImageGrid({
  images,
  hasText,
  fallbackAlt,
  className = '',
}: {
  images: ThreadsImage[]
  hasText: boolean
  fallbackAlt: string
  className?: string
}) {
  if (images.length === 0) return null
  return (
    <div
      className={[
        'grid gap-2',
        images.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
        className,
      ].join(' ')}
    >
      {images.map((image, index) => (
        <CloudinaryImage
          key={image.publicId}
          asset={image}
          alt={resolveAlt(images, index, hasText, fallbackAlt)}
          sizes="(max-width: 640px) 100vw, 640px"
          className="h-auto w-full rounded-xl border border-edge"
        />
      ))}
    </div>
  )
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

      <ImageGrid
        images={post.images}
        hasText={Boolean(post.text)}
        fallbackAlt={imageFallbackAlt}
        className="mt-3"
      />

      {/*
        The second half of a two-part review. Marked off with a rule and a
        left border rather than a label, because a label would need copy in
        both languages and the continuation reads perfectly well without one.
      */}
      {post.followUp ? (
        <div className="mt-4 border-t border-edge pt-4 pl-3 border-l-2 border-l-accent/40">
          {post.followUp.text ? (
            <p className="text-[14px] leading-relaxed whitespace-pre-line">
              {post.followUp.text}
            </p>
          ) : null}
          <ImageGrid
            images={post.followUp.images}
            hasText={Boolean(post.followUp.text)}
            fallbackAlt={imageFallbackAlt}
            className={post.followUp.text ? 'mt-3' : ''}
          />
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
