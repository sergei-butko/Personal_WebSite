import Link from 'next/link'
import { LocaleRedirect } from '@/components/layout/locale-redirect'
import { locales, localeNames, localePath } from '@/lib/i18n'

/**
 * Static export cannot redirect server-side, so `/` is a small detector page.
 * With JS it forwards to the best matching locale; without it, these links work.
 */
export default function RootPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <LocaleRedirect />
      <p className="text-muted">Choose a language / Оберіть мову</p>
      <div className="flex gap-3">
        {locales.map((locale) => (
          <Link
            key={locale}
            href={localePath(locale)}
            hrefLang={locale}
            className="rounded-md border border-edge px-4 py-2 font-mono text-sm transition hover:border-accent"
          >
            {localeNames[locale]}
          </Link>
        ))}
      </div>
    </main>
  )
}
