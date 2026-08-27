/**
 * Laying an album out inside a fixed-size card.
 *
 * The by-post view is a grid of cards that must all be the same size, and the
 * albums behind them run from one photo to ten. A naive grid of squares makes
 * a one-photo post a lonely tile in a large empty box and a ten-photo post a
 * wall of thumbnails — two shapes, in the same row, neither reading as the
 * same kind of thing.
 *
 * So every card gets the same media area and the album is fitted into it,
 * Telegram-album style: the layout changes with the count, the area does not.
 *
 * ## Why six columns for everything
 *
 * Six is the smallest number divisible by both 2 and 3, so a pair, a triple, a
 * quad and a sextet all land on whole-column boundaries of one grid. One
 * `grid-template-columns` for every case is what keeps the gutters identical
 * across cards — a per-count column count makes the gaps visibly different
 * from card to card, which is exactly the unevenness this is here to avoid.
 *
 * ## Why never more than six tiles
 *
 * Seven and eight do not tile a rectangle without a hole, and a nine-up of
 * thumbnails at a quarter of the page width is unreadable anyway. Above six,
 * the sixth tile carries a `+N` badge and the rest are reached in the lightbox.
 * Every layout below therefore fills its area completely — no card ever shows
 * a gap where a photo should be.
 *
 * Pure and dependency-free, so the rule is pinned by a test rather than by
 * looking at a page.
 */

/** Column count every layout is expressed in. See the note above. */
export const COLLAGE_COLUMNS = 6

/** One tile's footprint, in grid columns and rows. */
export interface CollageTile {
  colSpan: number
  rowSpan: number
}

export interface CollageLayout {
  /** Rows the media area is divided into — one or two. */
  rows: number
  /** Tiles to render, in order. Never more than the album holds. */
  tiles: CollageTile[]
  /** Photos beyond the last tile, for the `+N` badge. Zero when none. */
  overflow: number
}

const wide: CollageTile = { colSpan: COLLAGE_COLUMNS, rowSpan: 1 }
const half: CollageTile = { colSpan: 3, rowSpan: 1 }
const third: CollageTile = { colSpan: 2, rowSpan: 1 }

/**
 * The layout for an album of `count` photos.
 *
 * A count of zero cannot happen — groupByPost only ever emits posts that have
 * photos — but returning an empty layout rather than throwing keeps a bad
 * hand-edit of the snapshot from taking the whole page down over one post.
 */
export function collageFor(count: number): CollageLayout {
  if (count <= 0) return { rows: 1, tiles: [], overflow: 0 }

  if (count === 1) return { rows: 1, tiles: [wide], overflow: 0 }
  if (count === 2) return { rows: 1, tiles: [half, half], overflow: 0 }

  // One large photo with two stacked beside it: three equal tiles across would
  // be a thin strip, and a post of three is usually one picture and two details.
  if (count === 3) {
    return {
      rows: 2,
      tiles: [{ colSpan: 4, rowSpan: 2 }, third, third],
      overflow: 0,
    }
  }

  if (count === 4) return { rows: 2, tiles: [half, half, half, half], overflow: 0 }

  // Two over three — the only way five fills a rectangle at all.
  if (count === 5) {
    return { rows: 2, tiles: [half, half, third, third, third], overflow: 0 }
  }

  return {
    rows: 2,
    tiles: [third, third, third, third, third, third],
    overflow: count - 6,
  }
}
