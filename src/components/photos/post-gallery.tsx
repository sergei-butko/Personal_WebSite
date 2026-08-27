'use client'

import { useCallback, useState } from 'react'
import type { Photo, PostAudio } from '@/lib/photos/types'
import { COLLAGE_COLUMNS, collageFor } from '@/lib/photos/collage'
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
  fewerPerRow: string
  morePerRow: string
  pinchHint: string
  play: string
  pause: string
  seek: string
  listenOnTelegram: string
  morePhotos: string
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
          fewerLabel={strings.fewerPerRow}
          moreLabel={strings.morePerRow}
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
       * Fixed ratio, so the collage occupies the same area on every card
       * regardless of what is in it. gap-px over an `edge` background draws the
       * hairlines between tiles without a border on each one, which would
       * double up where two tiles meet.
       */}
      <div
        className="grid aspect-[4/3] gap-px bg-edge"
        style={{
          gridTemplateColumns: `repeat(${COLLAGE_COLUMNS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
        }}
      >
        {layout.tiles.map((tile, index) => {
          const item = group.items[index]
          if (!item) return null
          const last = index === layout.tiles.length - 1
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
              // min-h-0 with the absolutely-positioned image below: without
              // both, a tile's intrinsic image height counts as its minimum,
              // the 1fr rows grow past the container's 4:3, and cards holding
              // portrait photos come out taller than cards holding landscape.
              className="group relative block min-h-0 min-w-0 overflow-hidden bg-canvas"
              style={{
                gridColumn: `span ${tile.colSpan}`,
                gridRow: `span ${tile.rowSpan}`,
              }}
            >
              <CloudinaryImage
                asset={item.photo}
                alt={item.alt}
                sizes={tileSizes(columns, tile.colSpan)}
                priority={priority && index === 0}
                className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />

              {/*
               * The rest of the album, on the last tile. It is a count, not a
               * button — the tile it sits on already opens the lightbox at that
               * photo, and the arrow keys walk to the ones behind the badge.
               */}
              {last && layout.overflow > 0 ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white">
                  +{layout.overflow}
                  <span className="sr-only"> {strings.morePhotos}</span>
                </span>
              ) : null}
            </a>
          )
        })}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3">
        {/*
         * Clamped rather than given a fixed height: most posts in this channel
         * have no caption at all, and reserving four lines on every card for
         * the few that do would make the mosaic mostly empty space.
         */}
        {group.caption ? (
          <p className="line-clamp-4 text-[13.5px] leading-relaxed whitespace-pre-line">
            {group.caption}
          </p>
        ) : null}

        {/* mt-auto pins the footer to the bottom, so the meta rows line up
            across a row of cards even when the captions do not. */}
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

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <p className="font-mono text-[10.5px] text-muted">
              <time dateTime={group.timestamp}>{group.dateTime}</time>
              <span aria-hidden="true"> · </span>
              {count} {count === 1 ? strings.countOne : strings.countMany}
            </p>

            <a
              href={group.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-edge px-2.5 py-1 text-[11px] font-medium text-muted transition hover:border-accent hover:text-ink"
            >
              {strings.viewOnTelegram}
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </div>
    </article>
  )
}

/**
 * A `sizes` estimate for one collage tile.
 *
 * Three factors multiply: the container is capped at 1024px, the row holds
 * `columns` cards, and the tile takes `colSpan` of the card's six columns. Only
 * an estimate — `sizes` picks which file to download, and being a little
 * generous costs bandwidth once while being too small costs a blurry photo
 * permanently.
 */
function tileSizes(columns: number, colSpan: number): string {
  const share = colSpan / COLLAGE_COLUMNS
  const narrow = Math.round(100 * share)
  const wide = Math.round((1024 / columns) * share)
  return `(max-width: 640px) ${narrow}vw, ${wide}px`
}
