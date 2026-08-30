'use client'

import { useCallback, useState } from 'react'
import type { ThreadsImage } from '@/lib/threads/types'
import { CloudinaryImage } from '@/components/ui/cloudinary-image'
import { PostDialog, type DialogPost } from '@/components/threads/post-dialog'

/** One post: what the card shows, plus what the dialog needs behind it. */
export interface ScentCard {
  id: string
  permalink: string
  /** The post's first image. Absent on a text post or a repost. */
  image?: { publicId: string; width: number; height: number; alt: string }
  brand: string
  name: string
  /** Falls back to the post text when no bottle is named. */
  fallbackText: string
  /** Every image, for the dialog. The card shows only the first. */
  images: ThreadsImage[]
  /** The full review. */
  text: string
}

export interface ScentGridStrings {
  viewOnThreads: string
  noImage: string
  openLabelPrefix: string
  close: string
  imageAlt: string
}

/**
 * Five across at full width, stepping down with the viewport.
 *
 * Breakpoints rather than `auto-fit`/`minmax`: auto-fit derives the count from
 * a minimum tile width, so the widest layout is whatever the arithmetic happens
 * to produce — six, or four — and five is the number asked for. Capping the
 * ladder at `lg` makes five the answer on every screen wide enough to hold it.
 *
 * No zoom control here, unlike the photo grids. This is a wardrobe read at a
 * glance, and its cards carry two lines of type under each picture; the photo
 * roll is 443 squares a visitor genuinely wants to scale. The same control on
 * both would be consistency for its own sake.
 */
const GRID = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'

/**
 * The perfumery grid — one card per post, a bottle each.
 *
 * A deliberately quieter thing than the photos grid: a picture and a name, no
 * body text. The writing lives on Threads and the card links to it; what this
 * page is for is recognising a bottle, which is a job for the photograph and
 * two lines of type.
 *
 * The brand and scent name are hand-written into the snapshot — Threads has no
 * such field, and which fragrance a post reviews is a judgement only a reader
 * makes. A post with none named falls back to its own text, so the grid is
 * useful before a single one is filled in rather than after all 128 are.
 */
export function ScentGrid({
  cards,
  strings,
}: {
  cards: ScentCard[]
  strings: ScentGridStrings
}) {
  const [open, setOpen] = useState<number | null>(null)
  const close = useCallback(() => setOpen(null), [])

  const current = open === null ? null : cards[open]
  const dialogPost: DialogPost | null = current
    ? {
        permalink: current.permalink,
        brand: current.brand,
        name: current.name,
        text: current.text,
        images: current.images,
      }
    : null

  return (
    <>
      <ul className={`grid gap-4 ${GRID}`}>
        {cards.map((card, index) => (
          <li key={card.id} className="min-w-0">
            {/*
             * A real link to the post, with JS intercepting the click to open
             * the dialog instead. So with JS the card is a reader; without it
             * every card still goes somewhere, rather than being a dead button
             * that silently does nothing.
             */}
            <a
              href={card.permalink}
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
                setOpen(index)
              }}
              aria-label={`${strings.openLabelPrefix} ${[card.brand, card.name].filter(Boolean).join(' ') || card.fallbackText.slice(0, 60)}`}
              className="group grid h-full grid-rows-[auto_1fr] overflow-hidden rounded-[var(--radius-card)] border border-edge bg-surface transition hover:border-accent focus-visible:border-accent"
            >
              {/*
               * Square, so a row of bottles is a row of equal rectangles
               * whatever shape the photographs are. Portrait bottle shots and
               * the occasional landscape flat-lay otherwise make a ragged band.
               */}
              <div className="relative aspect-square overflow-hidden bg-canvas">
                {card.image ? (
                  <CloudinaryImage
                    asset={card.image}
                    alt={
                      card.image.alt ||
                      `${card.brand} ${card.name}`.trim() ||
                      card.fallbackText
                    }
                    // Mirrors the breakpoint ladder above. Kept in step by
                    // hand, which is the cost of a static grid — the numbers
                    // are the same four the classes name.
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 200px"
                    priority={index < 5}
                    className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  // 26 of 128 posts carry no image — text posts and reposts.
                  // They still belong in the grid, so the card keeps its shape
                  // and says why it is empty rather than collapsing.
                  <span className="absolute inset-0 flex items-center justify-center px-4 text-center font-mono text-[10.5px] text-muted">
                    {strings.noImage}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-0.5 px-3 py-2.5">
                {card.brand || card.name ? (
                  <>
                    <span className="truncate text-[11px] tracking-wide text-muted uppercase">
                      {card.brand}
                    </span>
                    <span className="line-clamp-2 text-[13.5px] leading-snug font-medium">
                      {card.name}
                    </span>
                  </>
                ) : (
                  <span className="line-clamp-3 text-[13px] leading-relaxed text-muted">
                    {card.fallbackText}
                  </span>
                )}
              </div>
            </a>
          </li>
        ))}
      </ul>

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
