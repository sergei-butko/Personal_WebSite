'use client'

import { useCallback, useState } from 'react'
import type { Photo, PostAudio } from '@/lib/photos/types'
import { collageFor } from '@/lib/photos/collage'
import { CloudinaryImage } from '@/components/ui/cloudinary-image'
import { Lightbox } from '@/components/photos/lightbox'
import { AudioPlayer } from '@/components/photos/audio-player'
import { DensityControl } from '@/components/photos/density-control'
import { useDensity, type DensityRange } from '@/components/photos/use-density'

/** One Telegram post, with everything already resolved for the current locale. */
export interface PostGroup {
  id: number
  permalink: string
  timestamp: string
  /** Formatted on the server — see lib/photos/format.ts on why not here. */
  dateTime: string
  caption: string
  audio?: PostAudio
  /** Cloudinary delivery URL for `audio`, when it has a file. */
  audioSrc?: string
  items: { photo: Photo; alt: string }[]
}

export interface PostGalleryStrings {
  closeLabel: string
  openLabelPrefix: string
  viewOnTelegram: string
  previousLabel: string
  nextLabel: string
  countOne: string
  countMany: string
  perRowLabel: string
  zoomIn: string
  zoomOut: string
  pinchHint: string
  play: string
  pause: string
  seek: string
  listenOnTelegram: string
}

/** Which photo is open, addressed by post and by position inside it. */
interface Cursor {
  post: number
  photo: number
}

/**
 * One to four cards across. One is a reading width for a post with a long
 * caption; past four the caption is two words per line and the collage tiles
 * are thumbnails of thumbnails.
 */
const RANGE: DensityRange = { min: 1, max: 4, initial: 3, initialNarrow: 1 }

/**
 * The "by post" view — one card per Telegram post.
 *
 * The difference from the roll is not only visual. Here the lightbox steps
 * *within* a post rather than across the whole channel, because an album is a
 * sequence its author chose: a ten-image photo essay is meant to be walked end
 * to end, and spilling out of it into the next post at the tenth arrow press
 * would lose that. Reaching the end of an album is the end of the range,
 * exactly as it is in the Photos app.
 *
 * Every card in a row is the same size whatever it holds. The collage area is
 * a fixed ratio (lib/photos/collage.ts), so a post of one photo and a post of
 * ten present the same rectangle, and the footer is pinned to the bottom so the
 * dates and buttons line up across the row even when the captions do not.
 *
 * One dialog for the whole page, not one per post. 235 posts would otherwise
 * mean 235 mounted <dialog> elements.
 */
export function PostGallery({
  posts,
  strings,
}: {
  posts: PostGroup[]
  strings: PostGalleryStrings
}) {
  const [cursor, setCursor] = useState<Cursor | null>(null)
  const density = useDensity('photos:posts-per-row', RANGE)
  // See gallery.tsx: reading the ref callback off the object at the `ref` prop
  // makes React's compiler treat the whole object as a ref.
  const { columns, attachGrid } = density

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
      <div className="mb-4 flex justify-end">
        <DensityControl
          density={density}
          legend={strings.perRowLabel}
          zoomInLabel={strings.zoomIn}
          zoomOutLabel={strings.zoomOut}
          pinchHint={strings.pinchHint}
        />
      </div>

      <ol
        ref={attachGrid}
        // Rows size to their own content and cards stretch within a row, which
        // is the uniformity that reads: every card edge on a line lines up.
        // `auto-rows-fr` would extend that across the whole grid — and one post
        // with four lines of caption then makes all 235 cards that tall, most of
        // them mostly empty. Tried it; the page was a column of white boxes.
        className="grid gap-4 [touch-action:pan-y]"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {posts.map((group, postIndex) => (
          <li key={group.id} className="min-w-0">
            <PostCard
              group={group}
              columns={columns}
              priority={postIndex === 0}
              strings={strings}
              onOpen={(photo) => setCursor({ post: postIndex, photo })}
            />
          </li>
        ))}
      </ol>

      <Lightbox
        photo={current?.photo ?? null}
        alt={current?.alt ?? ''}
        caption={post?.caption ?? ''}
        onClose={close}
        onPrev={prev}
        onNext={next}
        closeLabel={strings.closeLabel}
        viewOnTelegram={strings.viewOnTelegram}
        previousLabel={strings.previousLabel}
        nextLabel={strings.nextLabel}
        position={
          post && cursor && post.items.length > 1
            ? `${cursor.photo + 1} / ${post.items.length}`
            : undefined
        }
      />
    </>
  )
}

function PostCard({
  group,
  columns,
  priority,
  strings,
  onOpen,
}: {
  group: PostGroup
  /** Cards across, which is all `sizes` needs to estimate a tile's width. */
  columns: number
  priority: boolean
  strings: PostGalleryStrings
  onOpen: (photoIndex: number) => void
}) {
  const layout = collageFor(group.items.length)
  const count = group.items.length

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-edge bg-surface">
      {/*
       * The post's text sits ABOVE its photos, as it does on Telegram — the
       * caption is what the album is a response to, and reading it after the
       * pictures inverts the order it was written in.
       *
       * The slot is ALWAYS rendered, empty or not, and always the same height.
       * Rendering it only when there is a caption made every card in a row
       * start its photos at a different height, which read as a misalignment
       * rather than as a difference in content — and most posts in this channel
       * have no caption, so the ragged edge was the common case.
       *
       * Three lines: `min-h` in `em` rather than a pixel height, so it tracks
       * the font size, and `line-clamp-3` caps the other end. Both numbers have
       * to agree — a clamp of 3 over a reserve of 2 would still jump.
       */}
      <p className="line-clamp-3 min-h-[4.875em] px-3 pt-3 pb-2.5 text-[13.5px] leading-relaxed whitespace-pre-line">
        {group.caption}
      </p>

      {/*
       * Fixed ratio, so the collage occupies the same area on every card
       * regardless of what is in it. Rows split the height evenly and tiles
       * split their row's width evenly, which is what lets a row of four sit
       * under a row of three without the two needing a common divisor — the
       * constraint that used to cap this at six tiles and a `+N` badge.
       *
       * gap-px over an `edge` background draws the hairlines between tiles
       * without a border on each one, which would double up where two meet.
       */}
      <div className="flex aspect-[4/3] flex-col gap-px bg-edge">
        {layout.rows.map((tilesInRow, rowIndex) => {
          const before = layout.rows.slice(0, rowIndex).reduce((sum, n) => sum + n, 0)
          return (
            <div key={rowIndex} className="flex min-h-0 flex-1 gap-px">
              {group.items.slice(before, before + tilesInRow).map((item, offset) => {
                const index = before + offset
                return (
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
                      onOpen(index)
                    }}
                    aria-label={`${strings.openLabelPrefix} ${item.alt}`}
                    // min-w-0 with the absolutely-positioned image below: without
                    // both, a tile's intrinsic image size becomes its minimum, and
                    // the flex line grows past the container's 4:3 — cards holding
                    // portrait photos came out taller than cards holding landscape.
                    className="group relative block min-w-0 flex-1 overflow-hidden bg-canvas"
                  >
                    <CloudinaryImage
                      asset={item.photo}
                      alt={item.alt}
                      sizes={tileSizes(columns, tilesInRow)}
                      priority={priority && index === 0}
                      className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  </a>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3">
        {/* mt-auto pins the footer down, so the meta lines agree across a row
            of cards even when the captions above the photos do not. */}
        <div className="mt-auto flex flex-col gap-2.5">
          {group.audio ? (
            <AudioPlayer
              audio={group.audio}
              src={group.audioSrc}
              playLabel={strings.play}
              pauseLabel={strings.pause}
              seekLabel={strings.seek}
              listenLabel={strings.listenOnTelegram}
            />
          ) : null}

          {/*
           * The whole meta line IS the link out to Telegram. It replaced a
           * bordered pill that said "View on Telegram" — at three or four cards
           * across, that button was the heaviest thing on a card whose subject
           * is a photograph, and it repeated on every one of 235 of them.
           *
           * The visible text is the date and the count, so the destination is
           * carried by an sr-only span rather than left to be inferred: a link
           * named "21 Aug 2026, 13:45 · 5 photos" tells a screen-reader user
           * nothing about where it goes. The arrow is decorative and fades in
           * on hover and on keyboard focus — focus-within, so the affordance is
           * not mouse-only.
           */}
          <a
            href={group.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="group/meta inline-flex flex-wrap items-center gap-x-1.5 font-mono text-[10.5px] text-muted underline-offset-2 transition hover:text-ink hover:underline focus-visible:text-ink focus-visible:underline"
          >
            <time dateTime={group.timestamp}>{group.dateTime}</time>
            <span aria-hidden="true">·</span>
            <span>
              {count} {count === 1 ? strings.countOne : strings.countMany}
            </span>
            <span
              aria-hidden="true"
              className="opacity-0 transition group-hover/meta:opacity-100 group-focus-visible/meta:opacity-100"
            >
              ↗
            </span>
            <span className="sr-only">{strings.viewOnTelegram}</span>
          </a>
        </div>
      </div>
    </article>
  )
}

/**
 * A `sizes` estimate for one collage tile.
 *
 * Three factors multiply: the container is capped at 1024px, the row holds
 * `columns` cards, and the tile takes one of `tilesInRow` slots across its
 * card. Only an estimate — `sizes` picks which file to download, and being a
 * little generous costs bandwidth once, while being too small costs a blurry
 * photo permanently.
 */
function tileSizes(columns: number, tilesInRow: number): string {
  const narrow = Math.round(100 / columns / tilesInRow)
  const wide = Math.round(1024 / columns / tilesInRow)
  return `(max-width: 640px) ${narrow}vw, ${wide}px`
}
