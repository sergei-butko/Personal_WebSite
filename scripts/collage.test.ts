/**
 * The album-into-card layout rule. No network, no DOM.
 *
 *   npm run test:collage
 *
 * The property worth pinning is not which tile goes where — it is that the
 * layout accounts for EVERY photo and never emits an empty row. A dropped
 * photo, or a row of zero tiles collapsing to a hairline, looks like a
 * rendering bug in one card out of two hundred and is invisible in a screenshot
 * of the other one hundred and ninety-nine.
 */

import { collageFor } from '../src/lib/photos/collage'

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

// A Telegram album holds at most ten, but the snapshot is hand-editable, so the
// rule should hold past that rather than only up to it.
const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 25]

function main(): void {
  for (const count of COUNTS) {
    const { rows } = collageFor(count)
    const placed = rows.reduce((sum, n) => sum + n, 0)

    checkThat(
      `${count} photos: every photo is placed`,
      placed === count,
      `laid out ${placed} of ${count}`
    )
    checkThat(
      `${count} photos: no empty row`,
      rows.every((n) => n >= 1),
      `rows were ${JSON.stringify(rows)}`
    )
    checkThat(
      `${count} photos: rows differ by at most one tile`,
      Math.max(...rows) - Math.min(...rows) <= 1,
      `rows were ${JSON.stringify(rows)} — an uneven split reads as a mistake`
    )
    checkThat(
      `${count} photos: at most four across`,
      rows.every((n) => n <= 4),
      `rows were ${JSON.stringify(rows)}`
    )
    checkThat(
      `${count} photos: the fuller rows come first`,
      rows.every((n, i) => i === 0 || n <= (rows[i - 1] ?? n)),
      `rows were ${JSON.stringify(rows)} — the album's lead photo should not shrink`
    )
  }

  check('one photo fills the area', collageFor(1), { rows: [1] })
  check('three sit in a single row', collageFor(3), { rows: [3] })
  check('five split three over two', collageFor(5), { rows: [3, 2] })
  check('seven split four over three', collageFor(7), { rows: [4, 3] })
  check('nine split evenly in threes', collageFor(9), { rows: [3, 3, 3] })
  // The case that drove the rewrite: ten photos, all ten shown, no +N badge.
  check('ten photos are all shown', collageFor(10), { rows: [4, 3, 3] })
  check('an empty post renders nothing rather than throwing', collageFor(0), { rows: [] })

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
  if (failures > 0) process.exit(1)
}

main()
