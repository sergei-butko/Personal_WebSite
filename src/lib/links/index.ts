import { z } from 'zod'
import rawLinks from '@/content/links.json'

/**
 * The links directory.
 *
 * JSON rather than TypeScript, deliberately: this file is edited from /admin,
 * and the CMS reads JSON, YAML and Markdown — not `.ts`. Validation happens
 * here instead, so a malformed entry still fails the build rather than
 * shipping a broken page.
 */

const localized = z.object({
  en: z.string().min(1),
  uk: z.string().min(1),
})

const linkSchema = z.object({
  /** Key into the platform registry; unknown ids fall back to a neutral mark. */
  platform: z.string().min(1).optional(),
  label: z.string().min(1),
  /** Shown under the label — @handle, username, whatever identifies you there. */
  handle: z.string().min(1).optional(),
  href: z.string().url(),
  /** Optional one-liner shown under the label. */
  note: localized.partial().optional(),
  /** Surfaced on the home card and in the hero, not just the links page. */
  primary: z.boolean().default(false),
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

/** For the hero and the footer, where space is tight. */
export const primaryLinks: Link[] = links.filter((link) => link.primary)

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
