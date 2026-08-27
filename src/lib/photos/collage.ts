/**
 * Laying an album out inside a fixed-size card.
 *
 * The by-post view is a grid of cards that must all be the same size, and the
 * albums behind them run from one photo to ten. A naive grid of squares makes a
 * one-photo post a lonely tile in a large empty box and a ten-photo post a wall
 * of thumbnails — two shapes, in the same row, neither reading as the same kind
 * of thing.
 *
 * So every card gets the same media area and the album is fitted into it: the
 * layout changes with the count, the area does not.
 *
 * ## Every photo is shown
 *
 * An earlier version capped this at six tiles and badged the rest as `+N`,
 * because seven and eight cannot tile a *fixed-column* grid without leaving a
 * hole. That constraint was self-inflicted. Rows are laid out independently
 * here — each row is its own flex line whose tiles share the width evenly — so
 * a row of three and a row of four sit under each other with no common divisor
 * needed, and no count is unrepresentable. The card shows the whole album.
 *
 * The cost is real and worth stating: at ten photos in a card a quarter of the
 * page wide, each tile is small. That is the trade the `+N` badge was avoiding,
 * and showing the post as it was actually published is worth more than tile
 * size — the lightbox is still there for looking closely.
 */

/** Tiles per row, top to bottom. Every entry is at least 1. */
export interface CollageLayout {
  rows: number[]
}

/**
 * How many rows an album of `count` photos is split across.
 *
 * Up to three across in a single row: four abreast in one line is a strip, and
 * the eye reads it as a filmstrip rather than a group. Past that the album
 * grows downward, four per row at most, which keeps a tile from falling below
 * roughly a thumbnail's useful size on the narrowest card the grid produces.
 */
function rowCount(count: number): number {
  if (count <= 3) return 1
  if (count <= 8) return 2
  return Math.ceil(count / 4)
}

/**
 * The layout for an album of `count` photos.
 *
 * Rows are as even as they can be, with the extra photos going to the TOP rows.
 * Front-loading matters: Telegram albums lead with the picture the author chose
 * first, and a heavier top row keeps that one larger than the ones under it.
 *
 * A count of zero cannot happen — groupByPost only ever emits posts that have
 * photos — but returning an empty layout rather than throwing keeps a bad hand
 * edit of the snapshot from taking the whole page down over one post.
 */
export function collageFor(count: number): CollageLayout {
  if (count <= 0) return { rows: [] }

  const total = rowCount(count)
  const base = Math.floor(count / total)
  const remainder = count % total

  return {
    rows: Array.from({ length: total }, (_, index) =>
      index < remainder ? base + 1 : base
    ),
  }
}
