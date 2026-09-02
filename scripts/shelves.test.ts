/**
 * Pins the shelf order. `npm run test:shelves`.
 *
 * The rule is three-tiered — houses A to Z, then each house's bottles by line
 * and then by scent — and every tier of it is invisible in a screenshot: a
 * shelf sorted by scent alone looks exactly like a shelf sorted correctly
 * unless you know which line each bottle belongs to. That is the same reason
 * the collage rule is pinned rather than eyeballed.
 */

import { buildShelves } from '../src/lib/threads/shelves'
import type { ThreadsPost } from '../src/lib/threads/types'

let failed = 0

function check(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a === b) {
    console.log(`✓ ${label}`)
  } else {
    failed += 1
    console.error(`✗ ${label}\n    expected ${b}\n    actual   ${a}`)
  }
}

let seq = 0

function bottle(brand?: string, name?: string, collection?: string): ThreadsPost {
  seq += 1
  return {
    id: String(seq),
    permalink: `https://www.threads.com/p/${seq}`,
    timestamp: '2026-01-01T00:00:00.000Z',
    mediaType: 'IMAGE',
    text: '',
    images: [],
    isQuotePost: false,
    ...(brand && name
      ? { fragrance: { brand, ...(collection ? { collection } : {}), name } }
      : {}),
  }
}

/** The scent names on one shelf, in the order the shelf puts them. */
function names(brand: string | null, posts: ThreadsPost[]): string[] {
  const shelf = buildShelves(posts, 'en').find((s) => s.brand === brand)
  return shelf?.bottles.map((b) => b.fragrance?.name ?? '(unnamed)') ?? []
}

function main(): void {
  // A house with no lines at all is a plain alphabetical shelf — what this was
  // before collections existed, and what most of the archive still is.
  check(
    'no collections: alphabetical',
    names('Orto Parisi', [
      bottle('Orto Parisi', 'Stercus'),
      bottle('Orto Parisi', 'Bergamask'),
      bottle('Orto Parisi', 'Megamare'),
    ]),
    ['Bergamask', 'Megamare', 'Stercus']
  )

  // The load-bearing case: sorted by scent alone this would interleave the two
  // lines as Grey Vetiver, Oud Wood, Tobacco Vanille, White Suede.
  check(
    'lines group before names collate',
    names('Tom Ford', [
      bottle('Tom Ford', 'White Suede', 'Private Blend'),
      bottle('Tom Ford', 'Grey Vetiver', 'Signature'),
      bottle('Tom Ford', 'Oud Wood', 'Private Blend'),
      bottle('Tom Ford', 'Tobacco Vanille', 'Private Blend'),
    ]),
    ['Oud Wood', 'Tobacco Vanille', 'White Suede', 'Grey Vetiver']
  )

  // A bottle outside every line is not the head of the first one.
  check(
    'bottles with no line come last',
    names('Nishane', [
      bottle('Nishane', 'Zephyr'),
      bottle('Nishane', 'Hacivat', 'Prestige'),
      bottle('Nishane', 'Ani'),
      bottle('Nishane', 'Ege', 'Prestige'),
    ]),
    ['Ege', 'Hacivat', 'Ani', 'Zephyr']
  )

  // The collator, not `<`: code-unit order files Écrin after Zephyr, and folds
  // no case, so "private blend" would sort clear of "Private Blend".
  check(
    'lines collate by locale, case- and accent-insensitively',
    names('Test', [
      bottle('Test', 'c', 'Zephyr'),
      bottle('Test', 'b', 'écrin'),
      bottle('Test', 'a', 'Écrin'),
    ]),
    ['a', 'b', 'c']
  )

  // Houses A to Z, and the shelf of unnamed bottles after all of them.
  const shelves = buildShelves(
    [
      bottle(),
      bottle('Nasomatto', 'Duro'),
      bottle('Chanel', 'Bleu de Chanel', 'Les Exclusifs'),
    ],
    'en'
  )
  check(
    'houses A to Z, unnamed shelf last',
    shelves.map((s) => s.brand),
    ['Chanel', 'Nasomatto', null]
  )

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed`)
    process.exit(1)
  }
  console.log('\nAll shelf-order checks passed.')
}

main()
