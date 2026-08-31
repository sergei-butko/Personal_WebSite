'use client'

import { useEffect, useRef } from 'react'
import type { ThreadsImage } from '@/lib/threads/types'
import { CloudinaryImage } from '@/components/ui/cloudinary-image'

/** One post, as the dialog needs it. */
export interface DialogPost {
  permalink: string
  /** `Brand – Scent`, already formatted. Empty when no bottle is named. */
  title: string
  /** The halves again, for the heading under the photographs. */
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

  const title = post?.title ?? ''

  /*
   * Paragraphs, split on blank lines.
   *
   * One <p> with `whitespace-pre-line` renders every break at the same height,
   * so a paragraph boundary looked identical to a line break inside one — and
   * these reviews use both: single newlines within a thought, a blank line
   * where the follow-up comment was joined on. Splitting gives the boundaries
   * real space and keeps `pre-line` for the breaks inside each piece.
   */
  const paragraphs = (post?.text ?? '')
    .split(/\n\s*\n/)
    .map((piece) => piece.trim())
    .filter(Boolean)

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
          <div className="flex items-center justify-between gap-3 border-b border-edge bg-surface px-4 py-3">
            <div className="min-w-0">
              {title ? (
                <p className="truncate text-[15px] leading-snug font-semibold">{title}</p>
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

          <div className="overflow-y-auto">
            {/*
             * Two up. A review carries two bottle shots of the same thing — a
             * pack shot and a styled one — and stacked at full width they were
             * two screens of scrolling before a word of the writing. Side by
             * side they read as one exhibit. A lone image takes one cell rather
             * than stretching, which keeps every dialog's photographs the same
             * size.
             *
             * Each sits in a square box, and the gap between the boxes is the
             * padding around them — so the pair divides the dialog's width into
             * three equal margins and two equal squares, and the photographs
             * are as large as that width allows. They were capped at 26dvh
             * before, which made them smaller than the space they were given.
             *
             * The box is square and the picture is contained rather than
             * cropped: these are product shots of different shapes, and cover
             * would cut the top off a tall bottle to fill a square. Two equal
             * squares hold their line whatever shape arrives inside them.
             */}
            {post.images.length > 0 ? (
              <div className="grid grid-cols-2 gap-6 p-6 pb-0">
                {post.images.map((image) => (
                  <div
                    key={image.publicId}
                    className="aspect-square overflow-hidden rounded-xl bg-canvas"
                  >
                    {/*
                     * The picture fills the square and object-contain letterboxes
                     * it inside — rather than max-w/max-h on an intrinsically
                     * sized image, where both constraints bind at once and the
                     * element's own box is left square anyway.
                     */}
                    <CloudinaryImage
                      asset={image}
                      alt={image.alt || title || imageAlt}
                      sizes="(max-width: 640px) 40vw, 21rem"
                      className="h-full w-full object-contain"
                    />
                  </div>
                ))}
              </div>
            ) : null}

            {/*
             * The bottle, named again under its photographs — the scent as the
             * heading and the house beneath it. The top bar carries the same
             * pair as one line, but that bar is chrome: it stays put while the
             * dialog scrolls and reads as a label for the window. This is the
             * heading of the piece of writing under it.
             */}
            {post.name ? (
              <div className="px-6 pt-5">
                <h2 className="text-[19px] leading-tight font-semibold">{post.name}</h2>
                {post.brand ? (
                  <p className="mt-1 text-[13px] tracking-wide text-muted uppercase">
                    {post.brand}
                  </p>
                ) : null}
              </div>
            ) : null}

            {paragraphs.length > 0 ? (
              <div className="flex flex-col gap-3.5 px-6 pt-4 pb-6">
                {paragraphs.map((paragraph, index) => (
                  <p
                    key={index}
                    className="text-[14.5px] leading-relaxed whitespace-pre-line"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
