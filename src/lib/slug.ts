/**
 * Tag slugs.
 *
 * Tags are written in the language of the post, so Ukrainian posts carry
 * Cyrillic tags. Those cannot go into a URL as-is: a static export turns each
 * tag into a directory on disk, and a percent-encoded directory name is a
 * reliable way to discover which of GitHub Pages, git, and macOS normalises
 * Unicode differently. Transliterating to ASCII keeps `/uk/blog/tag/…/` a
 * plain, linkable path.
 *
 * Table follows the Ukrainian national romanisation (KMU 55:2010), which is
 * what a Ukrainian reader expects to see in a URL.
 */
const CYRILLIC: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ie',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ю: 'iu',
  я: 'ia',
  ь: '',
  ъ: '',
  ы: 'y',
  э: 'e',
  ё: 'e',
}

/**
 * Lowercase ASCII kebab-case. Latin accents are stripped via NFD so that
 * "Guerlain Après l'Ondée" and "Apres l'Ondee" land on the same slug.
 */
export function slugify(value: string): string {
  const transliterated = value
    .toLowerCase()
    .split('')
    .map((char) => CYRILLIC[char] ?? char)
    .join('')

  return transliterated
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
