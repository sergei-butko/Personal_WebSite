'use client'

import type { Density } from './use-density'

/**
 * The zoom control: − smaller, a slider, + bigger.
 *
 * ## The arithmetic runs backwards and the control hides that
 *
 * `+` REMOVES a column. It has to: the thing a visitor is adjusting is how big
 * the pictures are, and everyone has learned from every map and every photo
 * viewer that `+` means bigger. The column count is an implementation detail of
 * that, and it happens to move the other way. Labelling the buttons after the
 * columns — which the first version did, with a number between them — meant
 * pressing `+` made everything smaller, which reads as a bug.
 *
 * So the count is gone from the face of the control. It survives as the
 * slider's `aria-valuetext`, which is where a screen reader looks anyway and
 * where it does not have to be explained.
 *
 * ## Why a slider AND two buttons
 *
 * They are not redundant at four positions. The buttons are the precise, always
 * reachable path — one press, one step, keyboard-operable without a drag. The
 * slider is the fast path to the far end, and it shows where you are in the
 * range, which two buttons cannot. A range input rather than a hand-built
 * track, so dragging, arrow keys, Home/End and screen-reader announcement all
 * come from the platform.
 *
 * The slider is INVERTED against the column count for the same reason as the
 * buttons: left is small, right is big, so its value is `min + max - columns`.
 */
export function DensityControl({
  density,
  legend,
  zoomInLabel,
  zoomOutLabel,
  pinchHint,
}: {
  density: Density
  /** Names what is being counted, e.g. "Photos per row". Screen readers only. */
  legend: string
  zoomInLabel: string
  zoomOutLabel: string
  pinchHint: string
}) {
  const { columns, min, max, zoomIn, zoomOut, setColumns } = density

  // Left = smallest tiles = the most columns. See the note above.
  const sliderValue = min + max - columns
  const filled = max === min ? 0 : ((sliderValue - min) / (max - min)) * 100

  return (
    <div className="flex items-center gap-3">
      <div
        role="group"
        aria-label={legend}
        className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface px-1.5 py-1"
      >
        <button
          type="button"
          onClick={zoomOut}
          disabled={!zoomOut}
          aria-label={zoomOutLabel}
          className="flex size-6 items-center justify-center rounded-full text-muted transition hover:bg-chip hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <MinusIcon />
        </button>

        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={sliderValue}
          onChange={(event) => setColumns(min + max - Number(event.target.value))}
          aria-label={legend}
          // The number is not on screen any more, so this is the only place a
          // screen reader can learn it. Without it the slider announces "3",
          // which here would mean the opposite of what it says.
          aria-valuetext={`${columns} ${legend}`}
          className="density-scrub h-1 w-16"
          style={{ ['--filled' as string]: `${filled}%` }}
        />

        <button
          type="button"
          onClick={zoomIn}
          disabled={!zoomIn}
          aria-label={zoomInLabel}
          className="flex size-6 items-center justify-center rounded-full text-muted transition hover:bg-chip hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
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
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  )
}
