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

const groupSchema = z.object({
  id: z.string().min(1),
  title: localized,
  links: z.array(linkSchema).min(1),
})

export const linksSchema = z.array(groupSchema)

export type LinkGroup = z.infer<typeof groupSchema>
export type Link = z.infer<typeof linkSchema>

function load(): LinkGroup[] {
  const parsed = linksSchema.safeParse(rawLinks)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid content/links.json:\n${issues}`)
  }
  return parsed.data
}

export const linkGroups: LinkGroup[] = load()

/** Flattened, for the hero and the home card. */
export const primaryLinks: Link[] = linkGroups
  .flatMap((group) => group.links)
  .filter((link) => link.primary)
