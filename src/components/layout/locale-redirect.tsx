'use client'

import { useEffect } from 'react'
import { defaultLocale, isLocale, localePath } from '@/lib/i18n'
import { withBase } from '@/lib/paths'

/** Picks a locale from the browser's languages and forwards to it. */
export function LocaleRedirect() {
  useEffect(() => {
    const candidates = navigator.languages?.length
      ? navigator.languages
      : [navigator.language ?? defaultLocale]

    const match = candidates
      .map((lang) => lang.split('-')[0]?.toLowerCase() ?? '')
      .find((lang) => isLocale(lang))

    // window.location is outside Next's router, so basePath must be added here.
    window.location.replace(withBase(localePath(match ?? defaultLocale)))
  }, [])

  return null
}
