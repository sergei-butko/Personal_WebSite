'use client'

/**
 * The two perfumery views, re-rendered from the config when it changes.
 *
 * Each takes the snapshot the BUILD fetched and renders it — so the HTML a
 * visitor receives is complete, indexable and needs no JavaScript, exactly as
 * before. `useLiveSnapshot` then re-reads `data/threads.json` in the browser
 * and, if Cloudinary holds something newer, the view re-renders from that.
 *
 * What this buys: `npm run content:push` is now the whole procedure. Rename a
 * bottle, push, reload — no deploy. Before this, an edit reached Cloudinary and
 * sat there until the site was rebuilt.
 *
 * ## Why the snapshot is the prop, rather than the cards or the shelves
 *
 * Both views derive their shape from the posts — `toScentCards` for one,
 * `buildShelves` for the other — and that derivation has to happen again when
 * a newer snapshot arrives. Passing the derived shape would mean shipping it
 * AND the snapshot it came from, so the payload would carry the reviews twice.
 * The snapshot is the smaller, more honest prop, and the derivation is pure.
 *
 * ## The empty state refreshes too
 *
 * A never-synced site renders the "nothing here yet" notice, and the first sync
 * should replace it. Deciding that on the server would freeze the answer into
 * the HTML, so the decision lives here, where it is made again on every
 * refresh.
 */

import { useLiveSnapshot } from '@/lib/live-snapshot'
import { threadsSnapshotSchema } from '@/lib/threads/schema'
import { toScentCards } from '@/lib/threads/cards'
import { buildShelves } from '@/lib/threads/shelves'
import { isUnsynced, type ThreadsSnapshot } from '@/lib/threads/types'
import type { Locale } from '@/lib/i18n'
import { ScentGrid, type ScentGridStrings } from './scent-grid'
import { Shelves, type ShelvesStrings } from './shelves'
import { PerfumeryEmpty } from './notices'

/** The raw asset both views read. Same id the build fetches. */
const SNAPSHOT = 'data/threads.json'

interface EmptyStrings {
  message: string
  href: string
  linkLabel: string
}

export function LiveScentGrid({
  initial,
  strings,
  empty,
}: {
  initial: ThreadsSnapshot
  strings: ScentGridStrings
  empty: EmptyStrings
}) {
  const snapshot = useLiveSnapshot(SNAPSHOT, threadsSnapshotSchema, initial)

  if (isUnsynced(snapshot)) return <PerfumeryEmpty {...empty} />
  return <ScentGrid cards={toScentCards(snapshot.posts)} strings={strings} />
}

export function LiveShelves({
  initial,
  locale,
  strings,
  empty,
}: {
  initial: ThreadsSnapshot
  /** Shelf order is collated per locale, so the grouping needs to know it. */
  locale: Locale
  strings: ShelvesStrings
  empty: EmptyStrings
}) {
  const snapshot = useLiveSnapshot(SNAPSHOT, threadsSnapshotSchema, initial)

  if (isUnsynced(snapshot)) return <PerfumeryEmpty {...empty} />
  return <Shelves shelves={buildShelves(snapshot.posts, locale)} strings={strings} />
}
