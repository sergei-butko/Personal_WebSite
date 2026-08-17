export const locales = ['en', 'uk'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const localeNames: Record<Locale, string> = { en: 'EN', uk: 'UK' }

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}

/**
 * Build a locale-prefixed path. Always trailing-slashed to match
 * next.config trailingSlash: true and GitHub Pages directory serving.
 */
export function localePath(locale: Locale, path = ''): string {
  const clean = path.replace(/^\/+|\/+$/g, '')
  return clean ? `/${locale}/${clean}/` : `/${locale}/`
}
