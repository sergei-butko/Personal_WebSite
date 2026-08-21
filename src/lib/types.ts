import type { Locale } from '@/lib/i18n'

/**
 * Types with no feature to belong to. Anything that describes one feature's
 * data — a post, a photo, a Threads post — lives in that feature's types.ts
 * instead, so this file stays small rather than becoming the junk drawer
 * every `types.ts` turns into.
 */

/** A value that exists in every supported language. */
export type Localized<T = string> = Record<Locale, T>

export interface Profile {
  name: string
  initials: string
  location: Localized
  headline: Localized
  bio: Localized
}
