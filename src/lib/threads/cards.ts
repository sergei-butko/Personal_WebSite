/**
 * A post as the bottles grid wants it.
 *
 * Extracted from the page because it is now needed twice: once on the server,
 * where the build turns the snapshot into HTML, and once in the browser, where
 * `useLiveSnapshot` hands back a newer snapshot that has to become the same
 * shape. Two copies of this mapping would drift, and the drift would show as
 * cards that change subtly the moment the refresh lands.
 *
 * `ScentCard` is imported as a TYPE, which the lib/ boundary allows — this
 * describes the shape a component takes, it does not pull the component in.
 */

import type { ScentCard } from '@/components/threads/scent-grid'
import type { ThreadsPost } from './types'

export function toScentCards(posts: readonly ThreadsPost[]): ScentCard[] {
  return posts.map((post) => {
    const image = post.images[0]
    return {
      id: post.id,
      permalink: post.permalink,
      ...(image ? { image } : {}),
      ...(post.fragrance ? { fragrance: post.fragrance } : {}),
      fallbackText: post.text,
      images: post.images,
      text: post.text,
    }
  })
}
