'use client'

import { useEffect, useRef } from 'react'
import type { ThreadsImage } from '@/lib/threads/types'
import { CloudinaryImage } from '@/components/ui/cloudinary-image'

/** One post, as the dialog needs it. */
export interface DialogPost {
  permalink: string
  brand: string
  name: string
  text: string
  images: ThreadsImage[]
}

/**
 * The full review, over the grid.
 *
 * Native `<dialog>`, so modal semantics, focus trapping and Escape come from
 * the browser rather than from a hand-rolled overlay approximating them — the
 * same reasoning as the photo lightbox, and the reason that one is native too.
 *
 * The two differ in what they are for, which is why this is not that component
 * with a text slot. The lightbox is one photograph at a time, stepped through
 * with the arrow keys. This is a piece of writing with its pictures: everything
 * scrolls together in one column, because a review and the bottle it describes
 * are read together and paging between them would break the reading.
 */
export function PostDialog({
  post,
  onClose,
  closeLabel,
  viewOnThreads,
  imageAlt,
}: {
  /** null closes the dialog. */
  post: DialogPost | null
  onClose: () => void
  closeLabel: string
  viewOnThreads: string
  imageAlt: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const open = post !== null

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const title = [post?.brand, post?.name].filter(Boolean).join(' ')

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // Backdrop closes; the panel itself does not.
        if (event.target === ref.current) onClose()
      }}
      // m-auto is load-bearing: <dialog> centres itself with `margin: auto`,
      // and Tailwind's preflight zeroes margins, which pins it top-left.
      className="m-auto max-h-[88dvh] w-[min(46rem,92vw)] overflow-hidden rounded-2xl border border-edge bg-surface p-0 text-ink backdrop:bg-black/70"
    >
      {post ? (
        <div className="flex max-h-[88dvh] flex-col">
          {/*
           * Sticky, so "View on Threads" stays reachable in a long review
           * rather than sitting above three screens of scroll.
           */}
          <div className="flex items-start justify-between gap-3 border-b border-edge bg-surface px-4 py-3">
            <div className="min-w-0">
              {title ? (
                <>
                  <p className="truncate text-[11px] tracking-wide text-muted uppercase">
                    {post.brand}
                  </p>
                  <p className="truncate text-[15px] leading-snug font-semibold">
                    {post.name}
                  </p>
                </>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-edge px-3 py-1.5 text-[12px] font-medium text-muted transition hover:border-accent hover:text-ink"
              >
                {viewOnThreads}
              </a>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="flex size-7 items-center justify-center rounded-full border border-edge text-muted transition hover:border-accent hover:text-ink"
              >
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className="size-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto p-4">
            {post.images.map((image) => (
              <CloudinaryImage
                key={image.publicId}
                asset={image}
                alt={image.alt || title || imageAlt}
                sizes="(max-width: 640px) 92vw, 44rem"
                // Capped, not natural height. These are bottle shots, mostly
                // portrait, and at full width one of them is taller than the
                // dialog — which pushed the review itself entirely below the
                // fold and made the panel look like a photo viewer.
                className="max-h-[52dvh] w-full rounded-xl object-contain"
              />
            ))}

            {post.text ? (
              // whitespace-pre-line, because a review is written in paragraphs
              // and the snapshot keeps its line breaks.
              <p className="text-[14.5px] leading-relaxed whitespace-pre-line">
                {post.text}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
