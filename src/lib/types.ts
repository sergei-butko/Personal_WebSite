import type { Locale } from '@/lib/i18n'
import type { PostFrontmatter } from '@/lib/frontmatter'

/** A value that exists in every supported language. */
export type Localized<T = string> = Record<Locale, T>

export type SocialPlatform =
  'threads' | 'telegram' | 'instagram' | 'github' | 'linkedin' | 'x' | 'email'

export interface SocialLink {
  platform: SocialPlatform
  label: string
  href: string
  /** Surfaced in the hero card, not just the footer. */
  primary?: boolean
}

export interface Profile {
  name: string
  initials: string
  location: Localized
  headline: Localized
  bio: Localized
}

/**
 * A post's validated frontmatter plus everything derived from the file itself.
 * This is what listings render — no MDX body, so it stays cheap to pass around.
 */
export interface PostMeta extends PostFrontmatter {
  slug: string
  locale: Locale
  /** Rounded up from the body word count. */
  readingMinutes: number
  /** Languages this post has been written in, in `locales` order. */
  availableLocales: Locale[]
}

/** A post with its unrendered MDX body. Only post pages need this. */
export interface Post extends PostMeta {
  body: string
}

/** One tag as it appears in a locale's index, with its URL-safe form. */
export interface TagSummary {
  /** As written in the post, in the post's language. */
  label: string
  /** Transliterated, URL-safe. See lib/slug.ts. */
  slug: string
  count: number
}

export type { PostFrontmatter, FragranceMeta, Concentration } from '@/lib/frontmatter'
