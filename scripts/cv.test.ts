/**
 * Pins the rule that keeps the CV's stack mosaic free of holes.
 * `npm run test:cv`.
 *
 * The tiles are laid on a fixed twelve-track grid and placed automatically, so
 * a row whose spans do not add to twelve does not rebalance — it leaves empty
 * canvas beside the last tile in that row. This is the same class of bug as
 * the photo collage's seven-tile album: it appears at one breakpoint, in one
 * section, and a screenshot of the rest of the page looks perfect.
 *
 * The widths are content, not styling — Azure takes seven tracks to AWS's five
 * because it holds eight tools to AWS's six — so the check has to run against
 * whatever is in `content/cv.ts` today, not against a fixture. The last case
 * below does exactly that, which is what makes adding a tool without giving up
 * the tracks a failed build rather than a visual bug.
 */

import { STACK_TRACKS, cv, stackRowFault } from '../src/lib/cv'

let failed = 0

function check(label: string, actual: unknown, expected: unknown): void {
  if (actual === expected) {
    console.log(`✓ ${label}`)
  } else {
    failed += 1
    console.error(
      `✗ ${label}\n    expected ${String(expected)}\n    actual   ${String(actual)}`
    )
  }
}

function main(): void {
  check('twelve tracks is the grid the spans are counted against', STACK_TRACKS, 12)

  check('an empty stack has no rows to leave holes in', stackRowFault([]), null)
  check('one full-width tile fills its row', stackRowFault([12]), null)
  check('an uneven pair is fine so long as it adds up', stackRowFault([5, 7]), null)
  check('so are three tiles', stackRowFault([4, 4, 4]), null)
  check('and several rows in a run', stackRowFault([5, 7, 7, 5, 6, 6]), null)

  // The failure this exists to catch: a tile widened without its neighbour
  // giving up the tracks. The row runs long, and everything after it shifts.
  check(
    'a row that runs over is reported, with the group that did it',
    stackRowFault([5, 8]),
    'group 2 takes its row to 13 of 12 tracks'
  )

  // The other half: a final row that never closes. This is what a newly added
  // group looks like before its row has been rebalanced.
  check(
    'a row left short is reported too',
    stackRowFault([5, 7, 6]),
    'the last row stops at 6 of 12 tracks'
  )

  // A single tile too wide to sit anywhere. Caught by the schema's max as
  // well, but the message here is the one that explains the consequence.
  check(
    'a tile wider than the grid cannot start a row',
    stackRowFault([13]),
    'group 1 takes its row to 13 of 12 tracks'
  )

  // The real thing. `cv` is already schema-validated on import — this asserts
  // the invariant against live content rather than against examples.
  check(
    'the shipped stack fills every row',
    stackRowFault(cv.skills.map((group) => group.span)),
    null
  )

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`)
    process.exit(1)
  }
  console.log('\nAll CV checks passed.')
}

main()
