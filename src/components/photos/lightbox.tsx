'use client'

import { useEffect, useRef } from 'react'
import type { Photo } from '@/lib/photos/types'
import { CloudinaryImage } from '@/components/ui/cloudinary-image'

/**
 * The full-size photo dialog, shared by both photo views.
 *
 * Extracted rather than written twice: the roll steps through every photo on
 * the page and the "by post" view steps within one post, but the dialog
 * itself — modal semantics, Escape, focus trapping, backdrop click, the
 * arrow keys, and the `m-auto` quirk below — is identical and easy to get
 * subtly wrong in the second copy.
 *
 * Native <dialog>, so the browser supplies modal semantics, focus trapping
 * and Escape-to-close rather than a hand-rolled overlay approximating them.
 *
 * Stepping is the caller's business. It passes `onPrev`/`onNext` as undefined
 * at the ends of its own range, which both disables the button and makes the
 * arrow key a no-op — this component never needs to know whether the range is
 * a whole gallery or a ten-image album.
 */
export function Lightbox({
  photo,
  alt,
  caption,
  onClose,
  onPrev,
  onNext,
  closeLabel,
  viewOnTelegram,
  previousLabel,
  nextLabel,
  position,
}: {
  /** null closes the dialog. */
  photo: Photo | null
  alt: string
  caption: string
  onClose: () => void
  onPrev?: (() => void) | undefined
  onNext?: (() => void) | undefined
  closeLabel: string
  viewOnTelegram: string
  previousLabel: string
  nextLabel: string
  /** e.g. "3 / 10", shown only when the caller is stepping within a group. */
  position?: string | undefined
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const open = photo !== null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') onNext?.()
      if (event.key === 'ArrowLeft') onPrev?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onPrev, onNext])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        // Clicking the backdrop closes; clicking the image itself does not.
        if (event.target === dialogRef.current) onClose()
      }}
      // m-auto is load-bearing: <dialog> centres itself via `margin: auto`, and
      // Tailwind's preflight zeroes margins on every element, which pins it to
      // the top-left corner.
      className="m-auto max-h-[90dvh] max-w-[90vw] rounded-2xl border border-edge bg-surface p-3 text-ink backdrop:bg-black/70"
    >
      {photo ? (
        <div className="flex flex-col gap-3">
          <CloudinaryImage
            asset={photo}
            alt={alt}
            sizes="90vw"
            priority
            className="max-h-[75dvh] w-auto max-w-full rounded-xl object-contain"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
            <span className="text-muted">{caption}</span>

            <span className="flex items-center gap-2">
              {position ? (
                <span className="font-mono text-[11px] text-muted">{position}</span>
              ) : null}

              <button
                type="button"
                onClick={onPrev}
                disabled={!onPrev}
                aria-label={previousLabel}
                className="rounded-md border border-edge px-2.5 py-1 transition hover:border-accent disabled:opacity-40 disabled:hover:border-edge"
              >
                &larr;
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={!onNext}
                aria-label={nextLabel}
                className="rounded-md border border-edge px-2.5 py-1 transition hover:border-accent disabled:opacity-40 disabled:hover:border-edge"
              >
                &rarr;
              </button>

              <a
                href={photo.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] text-muted transition hover:text-ink"
              >
                {viewOnTelegram}
              </a>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-edge px-3 py-1 transition hover:border-accent"
              >
                {closeLabel}
              </button>
            </span>
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
