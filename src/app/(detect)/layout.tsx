import type { Metadata } from 'next'
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
 * Root layout for the routes that sit outside a locale — `/` and the 404.
 *
 * There are two root layouts rather than one, because `<html lang>` has to be
 * right and a single shared root cannot know the locale: it has no params.
 * See app/[locale]/layout.tsx for the other one. `(detect)` is a route group,
 * so it contributes nothing to the URL.
 *
 * lang="en" is a genuine choice here, not a default: this page is the language
 * chooser, so it is the one page that exists before a language does.
 */
export const metadata: Metadata = {
  title: 'Serhii Butko',
  description: 'Perfumery writing, photography, and engineering.',
}

export default function DetectLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  )
}
