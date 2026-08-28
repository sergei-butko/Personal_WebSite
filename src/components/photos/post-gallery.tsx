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

/**
 * Row tracks every card spans: caption, collage, player, meta.
 *
 * The number is load-bearing in three places at once — the <li>, the <article>
 * and the count of children the card renders — and they must agree or the
 * cards shear apart. Adding a band to the card means changing this and adding
 * a placeholder branch for it.
 */
const CARD_TRACKS = 4

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

      {/*
       * Four implicit row tracks per card row, and every card spans all four —
       * see CARD_TRACKS. The <li> and the <article> inside it are both
       * `subgrid`, which is what hands the card's own children up to the
       * shared tracks instead of the card measuring itself in isolation.
       */}
      <ol
        ref={attachGrid}
        className="grid gap-4 [touch-action:pan-y]"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {posts.map((group, postIndex) => (
          <li
            key={group.id}
            className="grid min-w-0 grid-rows-subgrid"
            style={{ gridRow: `span ${CARD_TRACKS}` }}
          >
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
    <article
      /*
       * grid-cols-[minmax(0,1fr)] is not decoration. The card declares its ROWS
       * as subgrid and says nothing about columns, so it gets one implicit
       * column sized `auto` — whose floor is the widest min-content among its
       * children. At four cards across that came to 249px inside a 234px card:
       * every child overflowed by 15px and `overflow-hidden` clipped them. The
       * collage cropped invisibly, so the only visible symptom was the player
       * losing its right padding and running under the border.
       *
       * A 0 minimum lets the column be the card's width instead of its
       * content's, and the flex rows inside shrink to fit as they were built to.
       */
      className="grid grid-cols-[minmax(0,1fr)] grid-rows-subgrid overflow-hidden rounded-[var(--radius-card)] border border-edge bg-surface"
      style={{ gridRow: `span ${CARD_TRACKS}` }}
    >
      {/*
       * The post's text sits ABOVE its photos, as it does on Telegram — the
       * caption is what the album is a response to, and reading it after the
       * pictures inverts the order it was written in.
       *
       * A captionless card renders an EMPTY DIV here, not nothing. The div has
       * no padding, so it measures zero and a row where nobody wrote anything
       * has no caption band at all; but it still occupies the track, so when
       * one card in the row does have text, every other card in that row gets
       * exactly that much space and the photos start on one line.
       *
       * Omitting the element entirely instead would shift each captionless
       * card's collage up into the caption track — subgrid places children in
       * order, and a missing child does not leave a hole, it shifts the rest.
       */}
      {group.caption ? (
        <p className="line-clamp-3 px-3 pt-3 pb-2.5 text-[13.5px] leading-relaxed whitespace-pre-line">
          {group.caption}
        </p>
      ) : (
        <div />
      )}

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

      {/*
       * Same trick as the caption, for the same reason: a post with no song
       * contributes an empty div, so a row of songless posts has no player band
       * — and a row with one song reserves the player's height on every card in
       * it, keeping the meta lines beneath on one line.
       */}
      {group.audio ? (
        <div className="px-3 pt-2.5">
          <AudioPlayer
            audio={group.audio}
            src={group.audioSrc}
            playLabel={strings.play}
            pauseLabel={strings.pause}
            seekLabel={strings.seek}
            listenLabel={strings.listenOnTelegram}
          />
        </div>
      ) : (
        <div />
      )}

      <div className="px-3 pt-2.5 pb-3">
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
