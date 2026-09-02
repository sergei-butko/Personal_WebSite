'use client'

/**
 * Re-reads a snapshot in the browser, so an edit to the config shows up
 * without rebuilding the site.
 *
 * `lib/snapshot.ts` fetches the same documents at BUILD time and bakes the
 * result into static HTML. That is still what a visitor sees first, and it is
 * why the reviews are in the markup at all — indexable, present without
 * JavaScript, painted before any network call. This runs afterwards and only
 * replaces what it finds newer.
 *
 * ## Why this exists
 *
 * `output: 'export'` means there is no server to read the config per request,
 * so a change to `data/threads.json` could only reach the site through a
 * rebuild. `content:push` had to be followed by a deploy, by hand. Now the
 * push is enough: the next page load fetches the new document and renders it.
 *
 * ## Failing quietly is the point
 *
 * `lib/snapshot.ts` throws when Cloudinary is unreachable, because a build that
 * green-lights an empty gallery is worse than one that stops. Here the opposite
 * is true — the page is already rendered and correct as of the last deploy, so
 * a failed fetch, a 404, a truncated body or a document that does not validate
 * all end the same way: keep what the build produced and say nothing. A
 * refresh that cannot happen must never be worse than not refreshing.
 *
 * The document is validated with the SAME zod schema the build uses, which is
 * what makes that promise keepable: a snapshot written by a newer sync, or a
 * half-written one, is rejected rather than rendered.
 */

import { useEffect, useState } from 'react'
import type { ZodType } from 'zod'

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD ?? ''

/**
 * The freshest version of a snapshot: what the build saw, replaced by what
 * Cloudinary holds now once that has arrived and validated.
 *
 * @param publicId  the raw asset, e.g. `data/threads.json`
 * @param schema    the same schema the build validates with
 * @param initial   what the build fetched, already rendered into the HTML
 */
export function useLiveSnapshot<T>(publicId: string, schema: ZodType<T>, initial: T): T {
  const [snapshot, setSnapshot] = useState(initial)

  useEffect(() => {
    if (!CLOUD_NAME) return

    // Cancelled on unmount so a slow response cannot set state on a component
    // that has gone, and so a locale switch does not race its own refetch.
    let live = true
    const controller = new AbortController()

    async function refresh(): Promise<void> {
      try {
        /*
         * `cache: 'no-store'` rather than a cache-busting query string.
         *
         * A `?v=` parameter is what the build uses, and it is the wrong tool
         * here: it makes every visitor's request unique, so the CDN edge never
         * serves two people the same object and the whole file crosses the
         * network every time. Asking the BROWSER not to reuse its own copy is
         * the part that matters — the edge is allowed to do its job.
         */
        const response = await fetch(
          `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${encodeURI(publicId)}`,
          { cache: 'no-store', signal: controller.signal }
        )
        // 404 means that sync has never run, which is a real state and not an
        // error. Either way there is nothing newer than what we already have.
        if (!response.ok) return

        const parsed = schema.safeParse(await response.json())
        if (!parsed.success) return
        if (live) setSnapshot(parsed.data)
      } catch {
        // Offline, aborted, blocked, malformed — the built content stands.
      }
    }

    void refresh()
    return () => {
      live = false
      controller.abort()
    }
    // publicId and schema are module constants at every call site. `initial`
    // is deliberately not a dependency: it is a fresh object on every render,
    // so depending on it would refetch in a loop.
  }, [publicId, schema])

  return snapshot
}
