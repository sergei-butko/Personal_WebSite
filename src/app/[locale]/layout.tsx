import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { locales, isLocale, type Locale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { ThemeScript } from '@/components/layout/theme-script'

// Self-hosted fonts. Deliberate: no request to Google from your visitors'
// browsers, and the build has no network dependency so CI cannot fail
// because a font CDN was slow.
import '@fontsource-variable/ibm-plex-sans'
// Plex Mono has no variable build; two weights is all the UI uses.
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'

import '../globals.css'

/**
 * Root layout for every localised route — it renders <html> itself.
 *
 * This is a root layout rather than a nested one so that `lang` can be the
 * actual locale. A single shared root layout at app/layout.tsx has no params,
 * so it can only ever emit a bare <html> or a hardcoded language; both /en/ and
 * /uk/ shipped without any `lang` at all until this. The language was on an
 * inner <div>, which is not where a screen reader picks its voice, so every
 * Ukrainian page was announced in English (WCAG 3.1.1).
 *
 * The cost is two root layouts and one duplicated font/CSS import block — see
 * app/(detect)/layout.tsx for the other. That is the whole price of a correct
 * `lang` under static export, where there is no server to set it per request.
 */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

/**
 * Deliberately identical for both languages for now. The title is a name, so it
 * does not translate; the description is English and should not be guessed at.
 * TODO(serhii): a Ukrainian description, and per-locale openGraph.
 */
export const metadata: Metadata = {
  title: 'Serhii Butko',
  description: 'Perfumery writing, photography, and engineering.',
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const typed: Locale = locale
  const dict = getDictionary(typed)

  return (
    <html lang={typed} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <div className="flex min-h-dvh flex-col">
          <Header locale={typed} dict={dict} />
          <div className="flex-1">{children}</div>
          <Footer />
        </div>
      </body>
    </html>
  )
}
