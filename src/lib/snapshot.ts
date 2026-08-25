/**
 * Build-time loader for the generated snapshots.
 *
 * The photo and Threads snapshots are not in this repository. They are JSON
 * `raw` assets in Cloudinary, written by the sync scripts, so that running a
 * sync produces no commit and `main` carries no generated content.
 *
 * That is a deliberate trade against the older design, where the snapshots
 * were committed .ts files and a failed sync merely stopped new content from
 * appearing. Now the build depends on Cloudinary being reachable. It fails
 * loudly when it is not — the same choice `media.ts` makes about a missing
 * cloud name, and for the same reason: a build that green-lights an empty
 * gallery is worse than one that stops.
 *
 * A missing asset (404) is NOT an error. It means that sync has never run,
 * which is the correct state for a fresh clone, and the caller supplies an
 * empty snapshot so the page renders its "not synced yet" branch.
 *
 * What comes back IS validated. This is remote JSON over a CDN — a truncated
 * body, a cached error document, or a snapshot written by an older sync all
 * arrive with a 200. Without a check they surface as a TypeError inside a
 * component, or worse as a silently empty gallery. The blog does the same
 * thing to MDX frontmatter, for the same reason.
 */

import type { ZodType } from 'zod'

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD ?? ''

/**
 * One cache-buster per build process, not per request.
 *
 * It helps and it is NOT what makes this correct. Cloudinary raw delivery is
 * eventually consistent, and a query string does not defeat it — measured on
 * this account, an overwrite took about four seconds to become visible through
 * a busted URL, and a deleted asset was still served.
 *
 * What makes it correct is upstream: `scripts/cloudinary.ts` does not report a
 * sync as finished until the CDN actually serves the new bytes, so by the time
 * a deploy is dispatched there is nothing stale left to fetch. The build has no
 * Cloudinary credentials and so cannot use the strongly-consistent Admin API
 * route the Worker takes; it does not need to.
 */
const VERSION = Date.now().toString(36)

/** Memoised per process, so one build fetches each snapshot once. */
const inFlight = new Map<string, Promise<unknown>>()

async function get<T>(publicId: string, schema: ZodType<T>): Promise<T | null> {
  if (!CLOUD_NAME) {
    throw new Error(
      `NEXT_PUBLIC_CLOUDINARY_CLOUD is not set, but the build needs it to fetch ` +
        `"${publicId}". Set it in the environment (deploy.yml sets it in CI) or ` +
        `the site would build with an empty gallery and look fine.`
    )
  }

  const url =
    `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${encodeURI(publicId)}` +
    `?v=${VERSION}`

  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(
      `Could not fetch "${publicId}" from Cloudinary: HTTP ${res.status}. ` +
        `The site build needs it; run the relevant sync workflow, or check that ` +
        `NEXT_PUBLIC_CLOUDINARY_CLOUD points at the right cloud.`
    )
  }
  let json: unknown
  try {
    json = await res.json()
  } catch (error) {
    throw new Error(
      `"${publicId}" came back from Cloudinary as a 200 but is not valid JSON ` +
        `(${(error as Error).message}). A truncated or cached error document is ` +
        `the usual cause; re-run the sync that writes it.`
    )
  }

  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new Error(
      `"${publicId}" is not a valid snapshot: ${parsed.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join('.') || '(root)'} — ${issue.message}`)
        .join('; ')}. Re-run the sync that writes it.`
    )
  }
  return parsed.data
}

/**
 * Fetches and validates a snapshot, or returns `empty` when the sync has never
 * run.
 *
 * Memoised per process. Next builds static pages across several worker
 * processes, so each worker fetches once — a handful of requests for a file of
 * tens of kilobytes, which is not worth a shared cache.
 */
export async function loadSnapshot<T>(
  publicId: string,
  schema: ZodType<T>,
  empty: T
): Promise<T> {
  let promise = inFlight.get(publicId) as Promise<T | null> | undefined
  if (!promise) {
    promise = get<T>(publicId, schema)
    inFlight.set(publicId, promise)
  }
  return (await promise) ?? empty
}
