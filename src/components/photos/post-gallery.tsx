'use client'

import { useCallback, useState } from 'react'
import type { Photo } from '@/lib/photos/types'
import { CloudinaryImage } from '@/components/ui/cloudinary-image'
import { Lightbox } from '@/components/photos/lightbox'

/** One Telegram post, with alt text already resolved for the current locale. */
export interface PostGroup {
  id: number
  permalink: string
  timestamp: string
  caption: string
  items: { photo: Photo; alt: string }[]
}

/** Which photo is open, addressed by post and by position inside it. */
interface Cursor {
  post: number
  photo: number
}

/**
 * The "by post" view — photos grouped the way they were actually published.
 *
 * The difference from the roll is not only visual. Here the lightbox steps
 * *within* a post rather than across the whole channel, because an album is a
 * sequence its author chose: a ten-image photo essay is meant to be walked
 * end to end, and spilling out of it into the next post at the tenth arrow
 * press would lose that. Reaching the end of an album is the end of the
 * range, exactly as it is in the Photos app.
 *
 * One dialog for the whole page, not one per post. 235 posts would otherwise
 * mean 235 mounted <dialog> elements.
 */
export function PostGallery({
  posts,
  closeLabel,
  openLabelPrefix,
  viewOnTelegram,
  previousLabel,
  nextLabel,
  countOne,
  countMany,
}: {
  posts: PostGroup[]
  closeLabel: string
  openLabelPrefix: string
  viewOnTelegram: string
  previousLabel: string
  nextLabel: string
  countOne: string
  countMany: string
}) {
  const [cursor, setCursor] = useState<Cursor | null>(null)

  const close = useCallback(() => setCursor(null), [])

  const post = cursor === null ? null : posts[cursor.post]
  const current = post && cursor ? post.items[cursor.photo] : null

  const atStart = cursor === null || cursor.photo === 0
  const atEnd = cursor === null || !post || cursor.photo >= post.items.length - 1

  const prev = atStart
    ? undefined
    : () => setCursor((c) => (c ? { ...c, photo: c.photo - 1 } : c))
  const next = atEnd
    ? undefined
    : () => setCursor((c) => (c ? { ...c, photo: c.photo + 1 } : c))

  return (
    <>
      <ol className="flex flex-col gap-10">
        {posts.map((group, postIndex) => {
          const single = group.items.length === 1
          return (
            <li key={group.id}>
              <article>
                {/*
                 * The post's own text, given the weight of a heading in the
                 * reading order without inventing one: many posts have no
                 * caption at all, and an empty <h2> on 132 of 235 posts would
                 * be worse for a screen reader than none.
                 */}
                {group.caption ? (
                  <p className="mb-3 max-w-2xl text-[15px] leading-relaxed whitespace-pre-line">
                    {group.caption}
                  </p>
                ) : null}

                <div
                  className={
                    single
                      ? 'overflow-hidden rounded-xl border border-edge sm:max-w-md'
                      : 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4'
                  }
                >
                  {group.items.map((item, photoIndex) => (
                    <a
                      key={item.photo.publicId}
                      href={item.photo.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => {
                        // Modified clicks still open Telegram in a new tab.
                        if (
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.button !== 0
                        )
                          return
                        event.preventDefault()
                        setCursor({ post: postIndex, photo: photoIndex })
                      }}
                      aria-label={`${openLabelPrefix} ${item.alt}`}
                      className={
                        single
                          ? 'block w-full transition hover:opacity-95'
                          : 'block w-full overflow-hidden rounded-xl border border-edge transition hover:border-accent focus-visible:border-accent'
                      }
                    >
                      <CloudinaryImage
                        asset={item.photo}
                        alt={item.alt}
                        sizes={
                          single
                            ? '(max-width: 640px) 100vw, 448px'
                            : '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px'
                        }
                        priority={postIndex === 0}
                        className={
                          single
                            ? 'h-auto w-full object-cover'
                            : 'aspect-square h-full w-full object-cover'
                        }
                      />
                    </a>
                  ))}
                </div>

                <p className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10.5px] text-muted">
                  <time dateTime={group.timestamp}>{group.timestamp.slice(0, 10)}</time>
                  <span aria-hidden="true">·</span>
                  <span>
                    {group.items.length} {group.items.length === 1 ? countOne : countMany}
                  </span>
                  <span aria-hidden="true">·</span>
                  <a
                    href={group.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition hover:text-ink"
                  >
                    {viewOnTelegram}
                  </a>
                </p>
              </article>
            </li>
          )
        })}
      </ol>

      <Lightbox
        photo={current?.photo ?? null}
        alt={current?.alt ?? ''}
        caption={post?.caption ?? ''}
        onClose={close}
        onPrev={prev}
        onNext={next}
        closeLabel={closeLabel}
        viewOnTelegram={viewOnTelegram}
        previousLabel={previousLabel}
        nextLabel={nextLabel}
        position={
          post && cursor && post.items.length > 1
            ? `${cursor.photo + 1} / ${post.items.length}`
            : undefined
        }
      />
    </>
  )
}
