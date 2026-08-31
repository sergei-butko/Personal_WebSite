import type { Locale } from '@/lib/i18n'
import type { ThreadsPost } from './types'

/**
 * One brand's shelf.
 *
 * `brand` is null for the shelf of bottles nobody has named yet — the
 * `fragrance` block is hand-written, so a freshly synced post carries none.
 * Those posts get a shelf at the end rather than being dropped: a wardrobe
 * quietly holding fewer bottles than the archive does is the failure this repo
 * keeps paying for elsewhere (see the photo sync's silent truncation).
 */
export interface Shelf {
  /** Display name of the house, or null for the not-yet-named shelf. */
  brand: string | null
  /** Grouping key, and React's key for the shelf. */
  key: string
  bottles: ThreadsPost[]
}

/** Key for the shelf of posts with no fragrance named. Never a real brand. */
const UNNAMED = ' unnamed'

/**
 * Group the archive into shelves: one per house, A to Z, bottles A to Z on it.
 *
 * Sorted with a locale collator rather than `<`, because `<` compares UTF-16
 * code units — which files "Ex Nihilo" before "Escentric Molecules" (uppercase
 * N sorts below lowercase s) and every Cyrillic house after every Latin one.
 * The collator folds case and accents too, so "Hermès" lands under H where a
 * reader looks for it.
 *
 * Houses group case-insensitively for the same reason: "Le Labo" and "le labo"
 * are one shelf, not two adjacent ones that look like a bug. The label shown is
 * the spelling on the shelf's first bottle, so the fix for an inconsistent
 * spelling is editing the snapshot rather than the code.
 */
export function buildShelves(posts: ThreadsPost[], locale: Locale): Shelf[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  const groups = new Map<string, ThreadsPost[]>()

  for (const post of posts) {
    const brand = post.fragrance?.brand.trim() ?? ''
    const key = brand ? brand.toLocaleLowerCase(locale) : UNNAMED
    const bottles = groups.get(key)
    if (bottles) bottles.push(post)
    else groups.set(key, [post])
  }

  const shelves: Shelf[] = []
  for (const [key, bottles] of groups) {
    bottles.sort((a, b) =>
      collator.compare(a.fragrance?.name.trim() ?? '', b.fragrance?.name.trim() ?? '')
    )
    shelves.push({
      key,
      brand: key === UNNAMED ? null : (bottles[0]?.fragrance?.brand.trim() ?? ''),
      bottles,
    })
  }

  // The unnamed shelf last, wherever its label would otherwise collate.
  return shelves.sort((a, b) => {
    if (a.brand === null) return 1
    if (b.brand === null) return -1
    return collator.compare(a.brand, b.brand)
  })
}
