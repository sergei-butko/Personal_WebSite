import type { Locale } from '@/lib/i18n'
import { en, type Dictionary } from '@/content/i18n/en'
import { uk } from '@/content/i18n/uk'

const dictionaries: Record<Locale, Dictionary> = { en, uk }

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale]
}

export type { Dictionary }
