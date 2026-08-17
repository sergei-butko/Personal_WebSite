import type { Locale } from '@/lib/i18n'

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

/** Placeholder shape. Phase 3 replaces this with real MDX frontmatter. */
export interface PostPreview {
  slug: string
  title: string
  summary: string
  date: string
  tags: string[]
  readingMinutes: number
}
