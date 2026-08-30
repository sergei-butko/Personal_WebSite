'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

/**
 * How many tiles fit across, and the two ways a visitor changes it.
 *
 * Shared by the roll (2–5 photos across) and the by-post view (1–4 cards
 * across) because the interaction is the same one twice: buttons on a pointer,
 * pinch on a touch screen, and the choice remembered afterwards.
 *
 * The count is a number in state rather than a Tailwind class, and the grid
 * gets `gridTemplateColumns` inline, because Tailwind generates its classes by
 * scanning source text — `grid-cols-${n}` is not in the stylesheet at build
 * time and would silently produce an unstyled grid.
 */

export interface DensityRange {
  min: number
  max: number
  /** Where a visitor who has never touched the control starts. */
  initial: number
  /** The same, on a phone, where `initial` would be unreadably small. */
  initialNarrow: number
}

export interface Density {
  columns: number
  min: number
  max: number
  /**
   * Fewer columns, so BIGGER tiles. Named for the visual result rather than
   * the arithmetic: the control's `+` calls this one, and reading it as
   * "increase the columns" is the mistake waiting to be made here.
   */
  zoomIn?: (() => void) | undefined
  /** More columns, so smaller tiles. The control's `−`. */
  zoomOut?: (() => void) | undefined
  /** Jump straight to a count. The slider's path; the buttons step. */
  setColumns: (columns: number) => void
  /** Attach to the grid element to enable pinch. */
  attachGrid: (node: HTMLElement | null) => void
}

/**
 * Half a pinch — the distance ratio that counts as one step.
 *
 * A step per 25% of spread: small enough that an ordinary pinch moves at least
 * one step, large enough that a clumsy two-finger scroll does not.
 */
const STEP_RATIO = 1.25

/** Tailwind's `sm`. The one breakpoint that decides the starting density. */
const NARROW = 640

function clamp(value: number, { min, max }: DensityRange): number {
  return Math.min(max, Math.max(min, value))
}

/*
 * A tiny store per key, read through useSyncExternalStore.
 *
 * The obvious shape — useState, then a useEffect that reads localStorage — is
 * wrong twice over. It renders once at the default and again at the stored
 * value, which relayouts four hundred images to announce itself, and React's
 * own lint rejects the cascading setState. useSyncExternalStore exists for
 * exactly this: `getServerSnapshot` supplies the value the prerendered HTML
 * was built with, `getSnapshot` supplies the real one, and React swaps them
 * without ever claiming a hydration mismatch.
 *
 * Module scope, so two galleries on one page — and the same page in two tabs,
 * via the storage event — agree on the number rather than drifting apart.
 */
const values = new Map<string, number>()
const listeners = new Map<string, Set<() => void>>()

function notify(key: string): void {
  for (const listener of listeners.get(key) ?? []) listener()
}

function fromStorage(key: string, range: DensityRange): number {
  const fallback = window.innerWidth < NARROW ? range.initialNarrow : range.initial
  try {
    const stored = Number(window.localStorage.getItem(key))
    return Number.isFinite(stored) && stored > 0 ? clamp(stored, range) : fallback
  } catch {
    // Private mode, or storage blocked. A remembered zoom level is a nicety;
    // losing it must not take the gallery with it.
    return fallback
  }
}

/** Memoised: getSnapshot must return the same number until something changes. */
function snapshot(key: string, range: DensityRange): number {
  const cached = values.get(key)
  if (cached !== undefined) return cached
  const value = fromStorage(key, range)
  values.set(key, value)
  return value
}

function write(key: string, value: number): void {
  values.set(key, value)
  try {
    window.localStorage.setItem(key, String(value))
  } catch {
    // See fromStorage(): storage is optional, the in-memory value is not.
  }
  notify(key)
}

export function useDensity(key: string, range: DensityRange): Density {
  const columns = useSyncExternalStore(
    useCallback(
      (onChange: () => void) => {
        const set = listeners.get(key) ?? new Set()
        listeners.set(key, set)
        set.add(onChange)

        // Another tab changing the same preference. Cheap to support, and the
        // alternative is two windows of the same page disagreeing.
        const onStorage = (event: StorageEvent) => {
          if (event.key !== key) return
          values.delete(key)
          notify(key)
        }
        window.addEventListener('storage', onStorage)

        return () => {
          set.delete(onChange)
          window.removeEventListener('storage', onStorage)
        }
      },
      [key]
    ),
    () => snapshot(key, range),
    () => range.initial
  )

  const step = useCallback(
    (delta: number) => {
      write(key, clamp(snapshot(key, range) + delta, range))
    },
    [key, range]
  )

  /*
   * Pinch.
   *
   * Registered by hand rather than through onTouchMove because the listener
   * must be non-passive: pinching is the browser's page-zoom gesture by
   * default, and only preventDefault() stops the whole page scaling instead of
   * the grid reflowing. React attaches touch handlers passively, where
   * preventDefault does nothing.
   *
   * Spreading the fingers means bigger tiles, so FEWER columns — the direction
   * the Photos app uses, and the opposite of what "increase" would suggest.
   */
  const start = useRef<number | null>(null)
  const [grid, setGrid] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!grid) return

    function distance(touches: TouchList): number {
      const [a, b] = [touches[0], touches[1]]
      if (!a || !b) return 0
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }

    function onStart(event: TouchEvent) {
      start.current = event.touches.length === 2 ? distance(event.touches) : null
    }

    function onMove(event: TouchEvent) {
      if (event.touches.length !== 2 || start.current === null) return
      event.preventDefault()

      const spread = distance(event.touches)
      const ratio = spread / start.current
      if (ratio >= STEP_RATIO) {
        step(-1)
        start.current = spread
      } else if (ratio <= 1 / STEP_RATIO) {
        step(1)
        start.current = spread
      }
    }

    function onEnd() {
      start.current = null
    }

    grid.addEventListener('touchstart', onStart, { passive: true })
    grid.addEventListener('touchmove', onMove, { passive: false })
    grid.addEventListener('touchend', onEnd, { passive: true })
    grid.addEventListener('touchcancel', onEnd, { passive: true })

    return () => {
      grid.removeEventListener('touchstart', onStart)
      grid.removeEventListener('touchmove', onMove)
      grid.removeEventListener('touchend', onEnd)
      grid.removeEventListener('touchcancel', onEnd)
    }
  }, [grid, step])

  const setColumns = useCallback(
    (next: number) => write(key, clamp(next, range)),
    [key, range]
  )

  return {
    columns,
    min: range.min,
    max: range.max,
    // Undefined at each end, which disables the button. zoomIn removes a
    // column and is therefore bounded by min, not max.
    // Undefined at each end, which disables the button. zoomIn removes a
    // column and is therefore bounded by min, not max.
    zoomIn: columns > range.min ? () => step(-1) : undefined,
    zoomOut: columns < range.max ? () => step(1) : undefined,
    setColumns,
    attachGrid: setGrid,
  }
}
