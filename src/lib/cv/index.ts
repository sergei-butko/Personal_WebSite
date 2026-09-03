import { z } from 'zod'
import type { Locale } from '@/lib/i18n'
import { documentUrl } from '@/lib/media'
import { cv as rawCv } from '@/content/cv'

/**
 * The CV.
 *
 * Same arrangement as `lib/links`: the data is a plain object in `content/`
 * and the schema here is what turns a malformed entry into a failed build
 * rather than a page that renders "undefined — undefined". Strict objects
 * throughout, so `span:` written as `spans:` is an error instead of a silently
 * dropped field that would collapse the stack mosaic to one column.
 */

/**
 * A string that may or may not be translated.
 *
 * Most of a CV does not translate, and pretending otherwise produces worse
 * Ukrainian than leaving it alone: "Middle DevOps Engineer" has no useful
 * Ukrainian form, and neither does `ASP.NET Core`. So the shape says which is
 * which — a bare string is the same in both languages, an `{ en, uk }` pair is
 * a thing that genuinely differs. What differs, in practice: the name, the
 * months, the durations, the degrees, and the two language rows.
 *
 * A union rather than making every field a pair, because a pair whose halves
 * are identical is a claim that they might diverge, and 40 of those would be
 * 40 places for the Ukrainian half to drift into a stale copy of the English.
 */
const localized = z.union([
  z.string().min(1),
  z.strictObject({ en: z.string().min(1), uk: z.string().min(1) }),
])

export type LocalizedText = z.infer<typeof localized>

/** Reads a translated-or-not string in one language. */
export function text(value: LocalizedText, locale: Locale): string {
  return typeof value === 'string' ? value : value[locale]
}

/**
 * A way to reach him. `platform` keys into the same registry the links
 * directory and the footer use, so the mark is the site's one set of brand
 * icons rather than a second copy.
 *
 * The mark is not decoration here: the LinkedIn and GitHub handles are the
 * same string — `sergei-butko` — so a pill without its icon says nothing about
 * where it goes.
 */
const contactSchema = z.strictObject({
  platform: z.string().min(1),
  /** Accessible name for the mark, and the pill's `title`. */
  label: z.string().min(1),
  /** What is printed on the pill — the handle or the address. */
  value: z.string().min(1),
  href: z.string().url(),
})

/**
 * One line under a role. `lead` is set in ink and the rest in muted grey.
 *
 * Split in two rather than carrying markup, because the alternative is a
 * string with `<strong>` in it and `dangerouslySetInnerHTML` at the render
 * site — a hole in the one file Serhii edits by hand, to save a bold run.
 */
const bulletSchema = z.strictObject({
  lead: z.string().min(1).optional(),
  text: z.string().min(1),
})

const roleSchema = z.strictObject({
  /** English in both languages. A localised job title helps nobody. */
  title: z.string().min(1),
  org: localized,
  from: localized,
  to: localized,
  /** "2 yrs 11 mos" — written out rather than derived; see the note below. */
  span: localized,
  /** The one role that gets a surface in the timeline, and the live dot. */
  current: z.boolean().default(false),
  /**
   * Ran alongside the role above it. Two of these overlap by two years, and
   * without the marker the dates read as an error rather than as two jobs at
   * once.
   */
  concurrent: z.boolean().default(false),
  bullets: z.array(bulletSchema).default([]),
  stack: z.array(z.string().min(1)).default([]),
})

/** How many tracks the stack mosaic is laid out on at full width. */
export const STACK_TRACKS = 12

const skillGroupSchema = z.strictObject({
  /** English in both languages — "Front end" and "Azure" alike. */
  area: z.string().min(1),
  /** Tracks this tile takes of `STACK_TRACKS`. See `stackRowFault`. */
  span: z.number().int().min(1).max(STACK_TRACKS),
  items: z.array(z.string().min(1)).min(1),
})

/**
 * Why the spans have to add up.
 *
 * The mosaic is a plain grid with auto placement, so a row that does not sum
 * to `STACK_TRACKS` does not rebalance — it leaves a hole, and the section
 * ends with a tile sitting alone beside empty canvas. That is the same failure
 * `lib/photos/collage.ts` exists to prevent in the photo cards, and it has the
 * same property: invisible in every screenshot except the one width where it
 * shows.
 *
 * The widths are not arbitrary either. Azure carries eight tools to AWS's six,
 * so it takes seven tracks to AWS's five — the split is what each area holds.
 * Which means adding a tool is not a free edit: it changes what its tile needs,
 * and the row it shares has to give the tracks up. This function is what says
 * so, at build time, instead of the page saying it in production.
 *
 * Exported for `scripts/cv.test.ts`, and pure so that test needs no fixture.
 */
export function stackRowFault(spans: number[]): string | null {
  let row = 0
  for (const [index, span] of spans.entries()) {
    row += span
    if (row > STACK_TRACKS) {
      return `group ${index + 1} takes its row to ${row} of ${STACK_TRACKS} tracks`
    }
    if (row === STACK_TRACKS) row = 0
  }
  return row === 0 ? null : `the last row stops at ${row} of ${STACK_TRACKS} tracks`
}

const educationSchema = z.strictObject({
  title: localized,
  org: localized,
  from: localized,
  to: localized,
})

const certificationSchema = z.strictObject({
  /** A certificate's name is its name; it is not translated. */
  title: z.string().min(1),
  org: z.string().min(1),
  when: localized,
})

const languageSchema = z.strictObject({ name: localized, level: localized })

/**
 * The PDF, in Cloudinary rather than in git — the same rule the photographs
 * follow, for the same reason: bytes do not belong in the repository. Absent
 * is a supported state; the download tile renders without its button rather
 * than offering a link that 404s.
 */
const resumeSchema = z.strictObject({
  publicId: z.string().min(1),
  /** From the upload response. `npm run cv:upload` prints it. */
  version: z.number().int().positive().optional(),
})

const cvSchema = z.strictObject({
  /** The name as the CV's own heading. The site header keeps the English
   * wordmark in both languages — that is the brand, not a translated string. */
  name: localized,
  role: z.string().min(1),
  org: z.string().min(1),
  location: localized,
  /** "5 years at Itransition Group", beside the Experience heading. */
  tenure: localized,
  contacts: z.array(contactSchema).min(1),
  roles: z.array(roleSchema).min(1),
  skills: z
    .array(skillGroupSchema)
    .min(1)
    .superRefine((groups, ctx) => {
      const fault = stackRowFault(groups.map((group) => group.span))
      if (fault) {
        ctx.addIssue({
          code: 'custom',
          message:
            `The stack mosaic leaves a hole: ${fault}. Every row must use ` +
            `exactly ${STACK_TRACKS} tracks — adjust the spans of the groups ` +
            `sharing that row.`,
        })
      }
    }),
  education: z.array(educationSchema).min(1),
  certifications: z.array(certificationSchema).default([]),
  languages: z.array(languageSchema).min(1),
  resume: resumeSchema.optional(),
})

export type Cv = z.infer<typeof cvSchema>
/** The shape `content/cv.ts` is written in — defaults not yet applied. */
export type CvInput = z.input<typeof cvSchema>

export type CvRole = Cv['roles'][number]
export type CvSkillGroup = Cv['skills'][number]
export type CvEducation = Cv['education'][number]
export type CvCertification = Cv['certifications'][number]
export type CvLanguage = Cv['languages'][number]
export type CvContact = Cv['contacts'][number]

function load(): Cv {
  const parsed = cvSchema.safeParse(rawCv)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid content/cv.ts:\n${issues}`)
  }
  return parsed.data
}

export const cv: Cv = load()

/**
 * Where the PDF is served from, or null when none is configured.
 *
 * Null is not a failure — it is the state before the first `npm run cv:upload`,
 * and the page renders around it. A configured-but-absent asset is the failure,
 * and that is what `npm run media:verify` is for.
 */
export const resumeUrl: string | null = cv.resume
  ? documentUrl(cv.resume.publicId, cv.resume.version)
  : null
