'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { locales, localeNames, isLocale, type Locale } from '@/lib/i18n'

export function LocaleSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname() ?? '/'

  /** Swap the leading locale segment, keeping the rest of the path intact. */
  function hrefFor(target: Locale): string {
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length > 0 && isLocale(parts[0]!)) {
      parts[0] = target
    } else {
      parts.unshift(target)
    }
    return `/${parts.join('/')}/`
  }

  return (
    <div
      aria-label={label}
      className="inline-flex overflow-hidden rounded-md border border-edge font-mono text-[11px] font-medium"
    >
      {locales.map((locale) => {
        const active = locale === current
        return (
          <Link
            key={locale}
            href={hrefFor(locale)}
            hrefLang={locale}
            aria-current={active ? 'true' : undefined}
            className={
              active
                ? 'bg-accent px-2.5 py-1 text-white'
                : 'px-2.5 py-1 text-muted transition hover:text-ink'
            }
          >
            {localeNames[locale]}
          </Link>
        )
      })}
    </div>
  )
}
