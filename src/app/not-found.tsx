import Link from 'next/link'
import { defaultLocale, localePath } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { ThemeScript } from '@/components/layout/theme-script'

/**
 * The global 404, which is the file GitHub Pages serves for any unmatched path.
 *
 * It carries its own fonts, stylesheet and theme script because there is no
 * app/layout.tsx to carry them — see app/[locale]/layout.tsx for why there are
 * two root layouts instead of one. Next renders this page inside a default
 * shell of its own, so it cannot render <html> here (that nests two of them)
 * and cannot set `lang`. That is the one page on the site without a language,
 * and it is Next's shell rather than ours.
 */
import '@fontsource-variable/ibm-plex-sans'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './globals.css'

export default function NotFound() {
  const dict = getDictionary(defaultLocale)
  return (
    <>
      {/*
       * React hoists <title> into <head>. It is here rather than in a metadata
       * export because there is no root layout to carry one, and without it the
       * 404 ships with no title at all.
       */}
      <title>{dict.common.notFoundTitle}</title>
      <ThemeScript />
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-5 text-center">
        <h1 className="text-3xl font-semibold">{dict.common.notFoundTitle}</h1>
        <p className="text-muted">{dict.common.notFoundBody}</p>
        <Link
          href={localePath(defaultLocale)}
          className="mt-2 rounded-md border border-edge px-4 py-2 text-sm transition hover:border-accent"
        >
          {dict.common.backHome}
        </Link>
      </main>
    </>
  )
}
