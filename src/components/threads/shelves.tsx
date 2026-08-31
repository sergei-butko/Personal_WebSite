'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Shelf } from '@/lib/threads/shelves'
import type { ThreadsPost } from '@/lib/threads/types'
import { fragranceTitle } from '@/lib/threads/title'
import { CloudinaryImage } from '@/components/ui/cloudinary-image'
import { PostDialog, type DialogPost } from '@/components/threads/post-dialog'

export interface ShelvesStrings {
  /** Heading for the shelf of posts with no bottle named. */
  unnamed: string
  noImage: string
  openLabelPrefix: string
  close: string
  viewOnThreads: string
  imageAlt: string
  scrollBack: string
  scrollForward: string
}

/**
 * Tile width, fixed rather than fluid.
 *
 * A shelf is a scrolling row, so the tiles cannot be a fraction of the row —
 * `1fr` columns would shrink thirteen Kajal bottles to fit instead of
 * overflowing, and there would be nothing to scroll. Fixed widths also keep
 * every shelf's bottles the same size, which is the whole point of a shelf:
 * a house with one bottle and a house with thirteen read as the same object.
 */
const TILE = 'w-32 sm:w-40'
const TILE_SIZES = '(max-width: 640px) 128px, 160px'

function ScrollButton({
  label,
  disabled,
  onClick,
  back,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  back?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-7 items-center justify-center rounded-full border border-edge text-muted transition enabled:hover:border-accent enabled:hover:text-ink disabled:opacity-35"
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="size-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={back ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'} />
      </svg>
    </button>
  )
}

/**
 * One house: its name, its bottles in a row, and the board they stand on.
 *
 * The row scrolls horizontally when the house owns more bottles than fit. The
 * scroller is deliberately NOT given `tabIndex={0}` — the usual fix for a
 * keyboard user stranded outside a scroll region (WCAG 2.1.1). Every tile in
 * here is a link, so tabbing already walks the shelf and the browser scrolls
 * each one into view; adding the container would only insert a tab stop that
 * does nothing.
 */
function BrandShelf({
  shelf,
  label,
  count,
  headingId,
  strings,
  onOpen,
  eager,
}: {
  shelf: Shelf
  label: string
  count: number
  /** Positional, not derived from the key: a brand makes a poor HTML id. */
  headingId: string
  strings: ShelvesStrings
  onOpen: (post: ThreadsPost) => void
  /** Load this shelf's images immediately — true only for the first shelf. */
  eager: boolean
}) {
  const scroller = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ back: false, forward: false })

  /*
   * Overflow is measured, not assumed. Whether thirteen bottles overflow
   * depends on the viewport, so the arrows cannot be decided from the count —
   * and a shelf that fits should show none at all. ResizeObserver covers the
   * window resize and the font load; the scroll handler covers the position.
   */
  const measure = useCallback(() => {
    const el = scroller.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    // A pixel of slack: fractional layout widths leave sub-pixel remainders
    // that would otherwise light the arrow up on a shelf sitting at its end.
    setEdges({ back: el.scrollLeft > 1, forward: el.scrollLeft < max - 1 })
  }, [])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure])

  const scrollBy = (direction: 1 | -1) => {
    const el = scroller.current
    if (!el) return
    // Just under a screenful, so the bottle at the edge stays visible and the
    // eye keeps its place rather than landing on an entirely new set.
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  const overflowing = edges.back || edges.forward

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2
          id={headingId}
          className="min-w-0 truncate text-[15px] font-semibold tracking-tight"
        >
          {label}
          {/*
           * The count as a bare numeral: no plural forms to get wrong in two
           * languages, and next to a house name a number can only mean one
           * thing. Announced with the heading, which is why it is not aria-hidden.
           */}
          <span className="ml-2 font-mono text-[11px] font-normal text-muted">
            {count}
          </span>
        </h2>

        {overflowing ? (
          // Touch scrolls a shelf by dragging it; a mouse without a horizontal
          // wheel cannot, which is who these are for. Hence sm and up.
          <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
            <ScrollButton
              back
              label={`${strings.scrollBack}: ${label}`}
              disabled={!edges.back}
              onClick={() => scrollBy(-1)}
            />
            <ScrollButton
              label={`${strings.scrollForward}: ${label}`}
              disabled={!edges.forward}
              onClick={() => scrollBy(1)}
            />
          </div>
        ) : null}
      </div>

      {/*
       * Bled to the container's edge with a matching inner pad: the first
       * bottle still lines up with the house name, and an overflowing shelf is
       * cut off at the edge of the page rather than at a margin — which is the
       * only thing telling a reader there is more to the right.
       *
       * overscroll-x-contain stops a horizontal flick at the end of a shelf
       * from becoming the browser's back-swipe gesture.
       *
       * scroll-pl-5 matches that padding, and is not decoration: a snap
       * position aligns a tile with the scrollport's padding EDGE, so without
       * it the browser immediately snapped every overflowing shelf 20px to the
       * left and only those shelves started out of line with their heading.
       */}
      <ul
        ref={scroller}
        onScroll={measure}
        className="-mx-5 flex snap-x scroll-pl-5 gap-3 overflow-x-auto overscroll-x-contain px-5 pb-3"
      >
        {shelf.bottles.map((post, index) => {
          const title = fragranceTitle(post.fragrance)
          const name = post.fragrance?.name.trim() || title
          const image = post.images[0]
          return (
            <li key={post.id} className={`${TILE} shrink-0 snap-start`}>
              {/*
               * A real link to the post, with JS intercepting the click to open
               * the dialog — the same bargain the bottles grid makes. Without
               * JS every bottle still goes somewhere.
               */}
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  // Modified clicks still open Threads in a new tab.
                  if (
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.button !== 0
                  )
                    return
                  event.preventDefault()
                  onOpen(post)
                }}
                aria-label={`${strings.openLabelPrefix} ${title || post.text.slice(0, 60)}`}
                className="group relative flex aspect-square overflow-hidden rounded-[var(--radius-card)] border border-edge bg-canvas transition hover:border-accent focus-visible:border-accent"
              >
                {image ? (
                  /*
                   * Contained, not cropped — the same rule as the bottles grid.
                   * A tall shot filled to a square loses its cap and its base,
                   * and on a shelf the photograph is the only label a bottle
                   * has. The band of `bg-canvas` either side is the price.
                   */
                  <CloudinaryImage
                    asset={image}
                    alt={image.alt || title || strings.imageAlt}
                    sizes={TILE_SIZES}
                    priority={eager && index < 6}
                    className="absolute inset-0 h-full w-full object-contain transition duration-300 group-hover:scale-[1.04]"
                  />
                ) : (
                  // The picture is the whole tile here, so a post without one
                  // has to say the name instead — otherwise it is an empty
                  // square that looks like a broken image.
                  <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-[12px] leading-snug font-medium text-muted">
                    {name || strings.noImage}
                  </span>
                )}

                {/*
                 * The name, on hover and on keyboard focus. The bottle is meant
                 * to be recognised by its photograph — that is what a shelf
                 * is — so the caption stays out of the way until someone is
                 * asking about that particular one.
                 */}
                {image && name ? (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 line-clamp-2 translate-y-full bg-surface/95 px-2.5 py-1.5 text-[11.5px] leading-snug font-medium opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                    {name}
                  </span>
                ) : null}
              </a>
            </li>
          )
        })}
      </ul>

      {/* The board the bottles stand on. */}
      <div className="h-[2px] rounded-full bg-edge" />
    </section>
  )
}

/**
 * The shelf view: one shelf per house, alphabetical, bottles alphabetical on it.
 *
 * The other half of the perfumery page. The bottles grid answers "what has he
 * written lately" — it is the archive newest-first. This answers "what does he
 * own", which is a question about houses, and so it is grouped and sorted by
 * one rather than by date. Same posts, same dialog, different question.
 */
export function Shelves({
  shelves,
  strings,
}: {
  shelves: Shelf[]
  strings: ShelvesStrings
}) {
  const [open, setOpen] = useState<ThreadsPost | null>(null)
  const close = useCallback(() => setOpen(null), [])

  const dialogPost: DialogPost | null = open
    ? {
        permalink: open.permalink,
        title: fragranceTitle(open.fragrance),
        brand: open.fragrance?.brand ?? '',
        name: open.fragrance?.name ?? '',
        text: open.text,
        images: open.images,
      }
    : null

  return (
    <>
      <div className="flex flex-col gap-8">
        {shelves.map((shelf, index) => (
          <BrandShelf
            key={shelf.key}
            shelf={shelf}
            label={shelf.brand ?? strings.unnamed}
            count={shelf.bottles.length}
            headingId={`shelf-${index}`}
            strings={strings}
            onOpen={setOpen}
            eager={index === 0}
          />
        ))}
      </div>

      <PostDialog
        post={dialogPost}
        onClose={close}
        closeLabel={strings.close}
        viewOnThreads={strings.viewOnThreads}
        imageAlt={strings.imageAlt}
      />
    </>
  )
}
