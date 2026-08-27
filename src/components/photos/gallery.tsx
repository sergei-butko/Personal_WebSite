'use client'

import { useCallback, useState } from 'react'
import type { Photo } from '@/lib/photos/types'
import { CloudinaryImage } from '@/components/ui/cloudinary-image'
import { Lightbox } from '@/components/photos/lightbox'
import { DensityControl } from '@/components/photos/density-control'
import { useDensity, type DensityRange } from '@/components/photos/use-density'

export interface GalleryItem {
  photo: Photo
  alt: string
  caption: string
}

export interface GalleryStrings {
  closeLabel: string
  openLabelPrefix: string
  viewOnTelegram: string
  previousLabel: string
  nextLabel: string
  perRowLabel: string
  zoomIn: string
  zoomOut: string
  pinchHint: string
}

/**
 * Two to five photos across.
 *
 * Not one: a single column of 443 squares is a scroll, not a gallery, and the
 * roll already has a per-post view for reading one post at a time. Not six:
 * past five the tiles are below a thumbnail's useful size on a 1024px column,
 * and the lightbox is the way to look closely.
 */
const RANGE: DensityRange = { min: 2, max: 5, initial: 4, initialNarrow: 2 }

/**
 * The gallery roll — every photo in the channel, newest first, one flat grid.
 *
 * Each tile is a real <a> to the post on Telegram, and JS intercepts the click
 * to open the lightbox instead. So with JS the gallery is a lightbox, and
 * without it every photo is still a working link — rather than a dead <button>
 * that silently does nothing.
 *
 * The column count is state rather than a responsive class list, because a
 * visitor chooses it: buttons on a pointer, pinch on a touch screen, and
 * remembered afterwards. The tiles stay square at every count, so changing it
 * reflows without ever changing an image's shape.
 *
 * The dialog itself lives in Lightbox, shared with the "by post" view.
 */
export function PhotoGallery({
  items,
  strings,
}: {
  items: GalleryItem[]
  strings: GalleryStrings
}) {
  const [open, setOpen] = useState<number | null>(null)
  const density = useDensity('photos:per-row', RANGE)
  // Destructured rather than read as `density.attachGrid` at the ref: React's
  // compiler infers "this object is a ref" from that member access and then
  // rejects every other read of the object during render, `columns` included.
  const { columns, attachGrid } = density

  const close = useCallback(() => setOpen(null), [])

  const current = open === null ? null : items[open]

  // Undefined at each end, which disables the button and no-ops the arrow key.
  const prev =
    open !== null && open > 0 ? () => setOpen((index) => (index ?? 0) - 1) : undefined
  const next =
    open !== null && open < items.length - 1
      ? () => setOpen((index) => (index ?? 0) + 1)
      : undefined

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
        // the two-finger gesture; without it the browser zooms the page instead.
        className="grid gap-2 [touch-action:pan-y]"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {items.map((item, index) => (
          <li key={`${item.photo.id}-${item.photo.publicId}`} className="min-w-0">
            <a
              href={item.photo.permalink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                // Let modified clicks through — open-in-new-tab should still work.
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
              aria-label={`${strings.openLabelPrefix} ${item.alt}`}
              className="block w-full overflow-hidden rounded-xl border border-edge transition hover:border-accent focus-visible:border-accent"
            >
              <CloudinaryImage
                asset={item.photo}
                alt={item.alt}
                // The column count is a runtime value, so `sizes` is built from
                // it rather than from breakpoints: at five across the browser
                // should fetch a 200px file, not the 300px one four across wants.
                sizes={`(max-width: 640px) ${Math.round(100 / columns)}vw, ${Math.round(1024 / columns)}px`}
                priority={index < columns * 2}
                className="aspect-square h-full w-full object-cover"
              />
            </a>
          </li>
        ))}
      </ul>

      <Lightbox
        photo={current?.photo ?? null}
        alt={current?.alt ?? ''}
        caption={current?.caption ?? ''}
        onClose={close}
        onPrev={prev}
        onNext={next}
        closeLabel={strings.closeLabel}
        viewOnTelegram={strings.viewOnTelegram}
        previousLabel={strings.previousLabel}
        nextLabel={strings.nextLabel}
      />
    </>
  )
}
