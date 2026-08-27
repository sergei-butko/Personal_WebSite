/**
 * The album-into-card layout rule. No network, no DOM.
 *
 *   npm run test:collage
 *
 * The property worth pinning is not which tile goes where — it is that every
 * layout fills its rectangle exactly. A layout that leaves a hole, or overflows
 * its rows, looks like a rendering bug in one card out of two hundred and is
 * invisible in a screenshot of the other one hundred and ninety-nine.
 */

import { COLLAGE_COLUMNS, collageFor } from '../src/lib/photos/collage'

let failures = 0

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(
    `${ok ? '✓' : '✗'} ${label}` +
      (ok ? '' : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
  )
}

function checkThat(label: string, condition: boolean, detail = ''): void {
  if (!condition) failures++
  console.log(`${condition ? '✓' : '✗'} ${label}${condition ? '' : ` — ${detail}`}`)
}

// A Telegram album holds at most ten, but the snapshot is hand-editable and the
// rule should hold past that rather than only up to it.
const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 25]

function main(): void {
  for (const count of COUNTS) {
    const { rows, tiles, overflow } = collageFor(count)
    const area = tiles.reduce((sum, tile) => sum + tile.colSpan * tile.rowSpan, 0)

    checkThat(
      `${count} photos: the tiles fill the card exactly`,
      area === COLLAGE_COLUMNS * rows,
      `covered ${area} of ${COLLAGE_COLUMNS * rows} cells`
    )
    checkThat(
      `${count} photos: no tile is taller than the card`,
      tiles.every((tile) => tile.rowSpan <= rows),
      'a tile spans more rows than the layout has'
    )
    checkThat(
      `${count} photos: no tile is wider than the card`,
      tiles.every((tile) => tile.colSpan <= COLLAGE_COLUMNS),
      'a tile spans more columns than the grid has'
    )
    checkThat(
      `${count} photos: every tile has a photo and every extra is counted`,
      tiles.length + overflow === count,
      `${tiles.length} tiles + ${overflow} overflow != ${count}`
    )
    checkThat(`${count} photos: at most six tiles`, tiles.length <= 6, 'too many tiles')
  }

  check('a single photo fills the whole area', collageFor(1), {
    rows: 1,
    tiles: [{ colSpan: 6, rowSpan: 1 }],
    overflow: 0,
  })
  check('three photos are one large and two stacked', collageFor(3), {
    rows: 2,
    tiles: [
      { colSpan: 4, rowSpan: 2 },
      { colSpan: 2, rowSpan: 1 },
      { colSpan: 2, rowSpan: 1 },
    ],
    overflow: 0,
  })
  check('a ten-photo album shows six and counts four', collageFor(10).overflow, 4)
  check('an empty post renders nothing rather than throwing', collageFor(0), {
    rows: 1,
    tiles: [],
    overflow: 0,
  })

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
  if (failures > 0) process.exit(1)
}

main()
