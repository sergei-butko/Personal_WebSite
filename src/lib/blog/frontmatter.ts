import { z } from 'zod'

/**
 * Frontmatter contract for `src/content/posts/<slug>.<locale>.mdx`.
 *
 * Deliberately strict: an unknown key is an error, not a shrug. A typo like
 * `tag:` instead of `tags:` would otherwise silently drop a post out of every
 * tag listing, and nobody would notice for months. Failing the build is the
 * cheapest possible moment to find out.
 */

/** YYYY-MM-DD, and a date that actually exists — the regex alone allows 2026-13-45. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  }, 'is not a real calendar date')

const concentrations = [
  'Cologne',
  'EDC',
  'EDT',
  'EDP',
  'Parfum',
  'Extrait',
  'Elixir',
  'Oil',
] as const

/**
 * The fragrance a post is about, when it is about one. Only `house` is
 * required — batch archaeology often starts with everything else unknown,
 * and a card that can show three fields is more useful than a post that
 * cannot be published until all six are found.
 */
const fragranceSchema = z.strictObject({
  house: z.string().min(1),
  name: z.string().min(1).optional(),
  perfumer: z.string().min(1).optional(),
  concentration: z.enum(concentrations).optional(),
  year: z.number().int().min(1700).max(2200).optional(),
  batchCode: z.string().min(1).optional(),
})

export const postFrontmatterSchema = z.strictObject({
  title: z.string().min(1),
  summary: z.string().min(1),
  date: isoDate,
  /** Set when a post is materially revised; shown next to the original date. */
  updated: isoDate.optional(),
  tags: z.array(z.string().min(1)).default([]),
  /** Drafts render in `next dev` and are excluded from production builds. */
  draft: z.boolean().default(false),
  fragrance: fragranceSchema.optional(),
})

export type PostFrontmatter = z.infer<typeof postFrontmatterSchema>
export type FragranceMeta = z.infer<typeof fragranceSchema>

/** Flatten a Zod issue list into something readable in CI logs. */
export function formatFrontmatterError(file: string, error: z.ZodError): string {
  const issues = error.issues
    .map((issue) => {
      const at = issue.path.length > 0 ? issue.path.join('.') : '(root)'
      return `  - ${at}: ${issue.message}`
    })
    .join('\n')
  return `Invalid frontmatter in content/posts/${file}:\n${issues}`
}
