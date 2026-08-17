'use client'

import { useSyncExternalStore } from 'react'

/**
 * The theme lives on <html class="dark">, which is an external system —
 * it is set by ThemeScript before React ever runs. useSyncExternalStore is
 * the correct way to read it: no setState-in-effect, no cascading render,
 * and no hydration mismatch (the server snapshot is always light).
 */
const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains('dark')
}

function getServerSnapshot(): boolean {
  return false
}

export function ThemeToggle({ label }: { label: string }) {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  function toggle() {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      // Storage blocked (Safari private mode, hardened browsers).
      // The choice will not persist, which is acceptable — never fatal.
    }
    listeners.forEach((notify) => notify())
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={isDark}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-edge text-sm text-muted transition hover:border-muted hover:text-ink"
    >
      <span aria-hidden="true">{isDark ? '☀' : '◐'}</span>
    </button>
  )
}
