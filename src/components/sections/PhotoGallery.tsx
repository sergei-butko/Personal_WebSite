'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Photo } from '@/lib/photos'
import { PhotoImage } from '@/components/ui/PhotoImage'

export interface GalleryItem {
  photo: Photo
  alt: string
  caption: string
}

/**
 * Masonry-ish grid with a lightbox.
 *
 * Uses a native <dialog>: the browser gives modal semantics, focus trapping
 * and Escape-to-close for free, which a hand-rolled overlay usually gets
 * wrong.
 *
 * Each tile is a real <a> to the post on Telegram, and JS intercepts the
 * click to open the lightbox instead. So with JS the gallery is a lightbox,
 * and without it every photo is still a working link — rather than a dead
 * <button> that silently does nothing.
 */
export function PhotoGallery({
  items,
  basePath,
  closeLabel,
  openLabelPrefix,
  viewOnTelegram,
}: {
  items: GalleryItem[]
  basePath: string
  closeLabel: string
  openLabelPrefix: string
  viewOnTelegram: string
}) {
  const [open, setOpen] = useState<number | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open !== null && !dialog.open) dialog.showModal()
    if (open === null && dialog.open) dialog.close()
  }, [open])

  const step = useCallback(
    (delta: number) => {
      setOpen((current) => {
        if (current === null) return current
        const next = current + delta
        return next < 0 || next >= items.length ? current : next
      })
    },
    [items.length]
  )

  useEffect(() => {
    if (open === null) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') step(1)
      if (event.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, step])

  const current = open === null ? null : items[open]

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <li key={`${item.photo.id}-${item.photo.src}`}>
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
              <PhotoImage
                photo={item.photo}
                alt={item.alt}
                basePath={basePath}
                priority={index < 4}
                className="aspect-square h-full w-full object-cover"
              />
            </a>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(null)}
        onClick={(event) => {
          // Clicking the backdrop closes; clicking the image itself does not.
          if (event.target === dialogRef.current) setOpen(null)
        }}
        // m-auto is load-bearing: <dialog> centres itself via `margin: auto`, and
        // Tailwind's preflight zeroes margins on every element, which pins it to
        // the top-left corner.
        className="m-auto max-h-[90dvh] max-w-[90vw] rounded-2xl border border-edge bg-surface p-3 text-ink backdrop:bg-black/70"
      >
        {current ? (
          <div className="flex flex-col gap-3">
            <PhotoImage
              photo={current.photo}
              alt={current.alt}
              basePath={basePath}
              sizes="90vw"
              priority
              className="max-h-[75dvh] w-auto max-w-full rounded-xl object-contain"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
              <span className="text-muted">{current.caption}</span>
              <span className="flex items-center gap-3">
                <a
                  href={current.photo.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] text-muted transition hover:text-ink"
                >
                  {viewOnTelegram}
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(null)}
                  className="rounded-md border border-edge px-3 py-1 transition hover:border-accent"
                >
                  {closeLabel}
                </button>
              </span>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  )
}
