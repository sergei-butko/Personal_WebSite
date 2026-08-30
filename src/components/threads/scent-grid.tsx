'use client'

import { CloudinaryImage } from '@/components/ui/cloudinary-image'
import { DensityControl } from '@/components/photos/density-control'
import { useDensity, type DensityRange } from '@/components/photos/use-density'

/** One post, reduced to what a card shows. */
export interface ScentCard {
  id: string
  permalink: string
  /** The post's first image. Absent on a text post or a repost. */
  image?: { publicId: string; width: number; height: number; alt: string }
  brand: string
  name: string
  /** Falls back to the post text when no bottle is named. */
  fallbackText: string
}

export interface ScentGridStrings {
  perRowLabel: string
  zoomIn: string
  zoomOut: string
  pinchHint: string
  viewOnThreads: string
  noImage: string
}

/**
 * Two to four cards across. Not one: a single column of bottles is a list, and
 * the point of this view is to see the wardrobe at a glance. Not five: the
 * brand and the scent name are two lines of real text under each picture, and
 * past four they wrap to one word a line.
 */
const RANGE: DensityRange = { min: 2, max: 4, initial: 3, initialNarrow: 2 }

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
  const density = useDensity('perfumery:per-row', RANGE)
  // Destructured rather than read at the `ref`: React's compiler infers "this
  // object is a ref" from that member access and then rejects every other read
  // of the object during render. See components/photos/gallery.tsx.
  const { columns, attachGrid } = density

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

      <ul
        ref={attachGrid}
        // pan-y keeps vertical scrolling native while the pinch handler takes
        // the two-finger gesture; without it the browser zooms the page.
        className="grid gap-4 [touch-action:pan-y]"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {cards.map((card, index) => (
          <li key={card.id} className="min-w-0">
            <a
              href={card.permalink}
              target="_blank"
              rel="noopener noreferrer"
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
                    sizes={`(max-width: 640px) ${Math.round(100 / columns)}vw, ${Math.round(1024 / columns)}px`}
                    priority={index < columns}
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
    </>
  )
}
