import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { isLocale, locales, type Locale } from '@/lib/i18n'
import { slugify } from './slug'
import { formatFrontmatterError, postFrontmatterSchema } from './frontmatter'
import type { Post, PostMeta, TagSummary } from './types'

/**
 * Reads `src/content/posts/<slug>.<locale>.mdx` at build time.
 *
 * Node-only by design — every consumer is a Server Component rendered during
 * the static export, so the filesystem is available and nothing here ever
 * reaches the browser.
 */

const POSTS_DIR = path.join(process.cwd(), 'src', 'content', 'posts')

/** `<slug>.<locale>.mdx`, with the slug constrained to lowercase kebab-case. */
const FILENAME = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.([a-z]{2})\.mdx$/

const WORDS_PER_MINUTE = 200

/**
 * Drafts are visible in `next dev` and absent from the export. The flag is
 * read once here so the rule lives in exactly one place.
 */
const includeDrafts = process.env.NODE_ENV !== 'production'

function readingMinutes(body: string): number {
  const words = body
    .replace(/```[\s\S]*?```/g, ' ') // fenced code is scanned, not read
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
}

async function loadPost(file: string, slug: string, locale: Locale): Promise<Post> {
  const raw = await readFile(path.join(POSTS_DIR, file), 'utf8')
  const { data, content } = matter(raw)

  const parsed = postFrontmatterSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(formatFrontmatterError(file, parsed.error))
  }

  return {
    ...parsed.data,
    slug,
    locale,
    body: content,
    readingMinutes: readingMinutes(content),
    // Filled in once every file has been read; a post cannot know about its
    // own translations in isolation.
    availableLocales: [],
  }
}

/** Newest first; ties broken by slug so the order never depends on readdir. */
function byDateDesc(a: PostMeta, b: PostMeta): number {
  return b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug)
}

async function readAllPosts(): Promise<Post[]> {
  let files: string[]
  try {
    files = await readdir(POSTS_DIR)
  } catch {
    return [] // no posts directory yet — an empty blog, not a broken build
  }

  const loaded = await Promise.all(
    files
      .filter((file) => file.endsWith('.mdx'))
      .map((file) => {
        const match = FILENAME.exec(file)
        if (!match) {
          throw new Error(
            `Unexpected post filename content/posts/${file}. ` +
              'Expected <kebab-case-slug>.<locale>.mdx, e.g. reading-batch-codes.en.mdx'
          )
        }
        const slug = match[1]!
        const locale = match[2]!
        if (!isLocale(locale)) {
          throw new Error(
            `Unknown locale "${locale}" in content/posts/${file}. ` +
              `Supported locales: ${locales.join(', ')}`
          )
        }
        return loadPost(file, slug, locale)
      })
  )

  // A post's translations are a property of the whole set, so resolve them
  // here rather than making every caller group by slug.
  const localesBySlug = new Map<string, Locale[]>()
  for (const post of loaded) {
    if (!includeDrafts && post.draft) continue
    const existing = localesBySlug.get(post.slug)
    if (existing) existing.push(post.locale)
    else localesBySlug.set(post.slug, [post.locale])
  }

  return loaded.map((post) => ({
    ...post,
    availableLocales: locales.filter((locale) =>
      (localesBySlug.get(post.slug) ?? []).includes(locale)
    ),
  }))
}

/**
 * Module-level memo rather than React `cache()`: during a static export each
 * page is its own request, so request-scoped caching would re-read every file
 * for every page. Skipped in dev so edits show up without a restart.
 */
let memo: Promise<Post[]> | null = null

function allPosts(): Promise<Post[]> {
  if (process.env.NODE_ENV === 'development') return readAllPosts()
  memo ??= readAllPosts()
  return memo
}

/** Published posts written in `locale`, newest first. */
export async function getPosts(locale: Locale): Promise<PostMeta[]> {
  const posts = await allPosts()
  return posts
    .filter((post) => post.locale === locale && (includeDrafts || !post.draft))
    .sort(byDateDesc)
}

/** A single post with its MDX body, or undefined if not written in `locale`. */
export async function getPost(locale: Locale, slug: string): Promise<Post | undefined> {
  const posts = await allPosts()
  return posts.find(
    (post) =>
      post.slug === slug && post.locale === locale && (includeDrafts || !post.draft)
  )
}

/**
 * Every slug that exists in at least one language. Post routes are generated
 * for all of these in every locale — the untranslated ones render a pointer to
 * the language that has the post, which beats a dead end when someone flips
 * the language switcher mid-article.
 */
export async function getAllSlugs(): Promise<string[]> {
  const posts = await allPosts()
  const slugs = new Set(
    posts.filter((post) => includeDrafts || !post.draft).map((post) => post.slug)
  )
  return [...slugs].sort()
}

/** Which languages a given post exists in. Empty if the slug is unknown. */
export async function getTranslations(slug: string): Promise<Locale[]> {
  const posts = await allPosts()
  return posts.find((post) => post.slug === slug)?.availableLocales ?? []
}

/** Tags used in `locale`, most-used first, then alphabetical. */
export async function getTags(locale: Locale): Promise<TagSummary[]> {
  const posts = await getPosts(locale)
  const counts = new Map<string, TagSummary>()

  for (const post of posts) {
    for (const label of post.tags) {
      const slug = slugify(label)
      if (!slug) continue
      const existing = counts.get(slug)
      if (existing) existing.count += 1
      else counts.set(slug, { label, slug, count: 1 })
    }
  }

  return [...counts.values()].sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label)
  )
}

export async function getPostsByTag(
  locale: Locale,
  tagSlug: string
): Promise<PostMeta[]> {
  const posts = await getPosts(locale)
  return posts.filter((post) => post.tags.some((tag) => slugify(tag) === tagSlug))
}

/**
 * Neighbours in reading order for the post footer. `previous` is the older
 * post, `next` the newer one — chronological, not list order.
 */
export async function getAdjacentPosts(
  locale: Locale,
  slug: string
): Promise<{ previous?: PostMeta; next?: PostMeta }> {
  const posts = await getPosts(locale)
  const index = posts.findIndex((post) => post.slug === slug)
  if (index === -1) return {}
  return { next: posts[index - 1], previous: posts[index + 1] }
}
