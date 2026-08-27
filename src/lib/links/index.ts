import { z } from 'zod'
import rawLinks from '@/content/links.json'

/**
 * The links directory.
 *
 * JSON rather than TypeScript is a leftover: it was chosen because the /admin
 * editor read JSON and not `.ts`, and that editor was removed in c6efe65. The
 * file is now hand-edited in the repo like the rest of `src/content/`, so the
 * format buys nothing on its own — the schema below is what does the work,
 * turning a malformed entry into a failed build rather than a broken page.
 */

/**
 * Strict: an unknown key is an error rather than a silent strip. `note` used
 * to live here — a bilingual one-liner per entry that nothing ever rendered —
 * and a plain object schema would quietly drop a leftover one, along with a
 * `foter:` typo that would take an entry out of the footer with no complaint.
 */
const linkSchema = z.strictObject({
  /** Key into the platform registry; unknown ids fall back to a neutral mark. */
  platform: z.string().min(1).optional(),
  label: z.string().min(1),
  /**
   * @handle, username, whatever identifies you there. Not rendered on the
   * links cards — those are the brand and nothing else — but it is what the
   * footer marks put in their `title`, so a hover says which account.
   */
  handle: z.string().min(1).optional(),
  href: z.string().url(),
  /**
   * Listed on /links. Off for a destination that belongs somewhere else on
   * the site — the personal Telegram is a contact route in the footer, not a
   * thing to browse, and the channel is what the directory should offer.
   */
  directory: z.boolean().default(true),
  /**
   * Repeated in the site footer as a bare monochrome mark, on every page.
   * Was `primary`, which claimed to feed "the home card and the hero" — the
   * home links card is gone and there is no hero, so the flag now names the
   * one place that actually reads it. Keep this list short: four marks fit
   * the footer without wrapping on a phone.
   */
  footer: z.boolean().default(false),
  /** rel="me" marks a verified identity link — good for the fediverse and SEO. */
  identity: z.boolean().default(false),
})

const linksSchema = z.array(linkSchema)

export type Link = z.infer<typeof linkSchema>

function load(): Link[] {
  const parsed = linksSchema.safeParse(rawLinks)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid content/links.json:\n${issues}`)
  }
  return parsed.data
}

export const links: Link[] = load()

/** The footer row, in `links.json` order. */
export const footerLinks: Link[] = links.filter((link) => link.footer)

/** The /links directory, in `links.json` order. */
export const directoryLinks: Link[] = links.filter((link) => link.directory)

/**
 * `rel` for an outbound link.
 *
 * `me` marks a verified identity link — that is what lets Mastodon and similar
 * confirm the profile really is yours — and noopener/noreferrer are the usual
 * hardening for anything opening in a new tab.
 */
export function linkRel(link: Link): string {
  return `${link.identity ? 'me ' : ''}noopener noreferrer`.trim()
}

/**
 * `target` for an outbound link. mailto: must open in place — sending it to a
 * new tab leaves an empty one behind once the mail client takes over.
 *
 * This existed at two of the three call sites; the footer hardcoded `_blank`
 * and so opened the mailto address in a new tab. Having one function is the
 * point: the rule cannot be applied in two places out of three.
 */
export function linkTarget(link: Link): '_blank' | undefined {
  return link.href.startsWith('mailto:') ? undefined : '_blank'
}
