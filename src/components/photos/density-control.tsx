'use client'

import type { Density } from './use-density'

/**
 * The zoom control: fewer or more tiles across.
 *
 * Deliberately not a slider. There are four positions, a slider's thumb is the
 * hardest target on the page at this size, and a range input cannot be read by
 * keyboard users as "4 of 5" without extra labelling anyway. Two buttons and a
 * count say the same thing and are reachable with Tab.
 *
 * The count is a live region because that is the only feedback a screen reader
 * gets — the visible change is four hundred images reflowing, which is
 * invisible to it.
 */
export function DensityControl({
  density,
  legend,
  fewerLabel,
  moreLabel,
  pinchHint,
}: {
  density: Density
  /** Names what is being counted: photos per row, or posts per row. */
  legend: string
  fewerLabel: string
  moreLabel: string
  pinchHint: string
}) {
  const { columns, decrease, increase } = density

  return (
    <div className="flex items-center gap-3">
      <div
        role="group"
        aria-label={legend}
        className="inline-flex items-center rounded-full border border-edge bg-surface p-1"
      >
        {/*
         * Minus REMOVES columns, so it makes the pictures bigger. Labelling
         * these "zoom in / zoom out" was tempting and wrong: the buttons act on
         * the row, and the arithmetic runs the other way from the visual size.
         */}
        <button
          type="button"
          onClick={decrease}
          disabled={!decrease}
          aria-label={fewerLabel}
          className="flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-chip hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent"
        >
          <MinusIcon />
        </button>

        <span
          aria-live="polite"
          className="min-w-9 text-center font-mono text-[11px] text-muted tabular-nums"
        >
          {columns}
          <span className="sr-only"> {legend}</span>
        </span>

        <button
          type="button"
          onClick={increase}
          disabled={!increase}
          aria-label={moreLabel}
          className="flex size-7 items-center justify-center rounded-full text-muted transition hover:bg-chip hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent"
        >
          <PlusIcon />
        </button>
      </div>

      {/*
       * Shown only where the gesture exists. `coarse` rather than a width query:
       * a phone in landscape is wider than a small laptop window, and a touch
       * laptop is the case a width query gets backwards in both directions.
       */}
      <span className="hidden text-[11px] text-muted [@media(pointer:coarse)]:inline">
        {pinchHint}
      </span>
    </div>
  )
}

function MinusIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      <path d="M3.5 8h9" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  )
}
