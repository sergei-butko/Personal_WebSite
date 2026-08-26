'use client'

import { useCallback, useState } from 'react'
import type { Photo } from '@/lib/photos/types'
import { CloudinaryImage } from '@/components/ui/cloudinary-image'
import { Lightbox } from '@/components/photos/lightbox'

export interface GalleryItem {
  photo: Photo
  alt: string
  caption: string
}

/**
 * The gallery roll — every photo in the channel, newest first, one flat grid.
 *
 * Each tile is a real <a> to the post on Telegram, and JS intercepts the
 * click to open the lightbox instead. So with JS the gallery is a lightbox,
 * and without it every photo is still a working link — rather than a dead
 * <button> that silently does nothing.
 *
 * The dialog itself lives in Lightbox, shared with the "by post" view.
 */
export function PhotoGallery({
  items,
  closeLabel,
  openLabelPrefix,
  viewOnTelegram,
  previousLabel,
  nextLabel,
}: {
  items: GalleryItem[]
  closeLabel: string
  openLabelPrefix: string
  viewOnTelegram: string
  previousLabel: string
  nextLabel: string
}) {
  const [open, setOpen] = useState<number | null>(null)

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
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <li key={`${item.photo.id}-${item.photo.publicId}`}>
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
              aria-label={`${openLabelPrefix} ${item.alt}`}
              className="block w-full overflow-hidden rounded-xl border border-edge transition hover:border-accent focus-visible:border-accent"
            >
              <CloudinaryImage
                asset={item.photo}
                alt={item.alt}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
                priority={index < 4}
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
        closeLabel={closeLabel}
        viewOnTelegram={viewOnTelegram}
        previousLabel={previousLabel}
        nextLabel={nextLabel}
      />
    </>
  )
}
