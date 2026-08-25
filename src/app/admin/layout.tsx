import type { Metadata } from 'next'
import { ThemeScript } from '@/components/layout/theme-script'

import '@fontsource-variable/ibm-plex-sans'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'

import '../globals.css'

/**
 * Root layout for /admin.
 *
 * A third root layout, for the same reason there are already two: each one
 * renders its own <html> so `lang` can be right. This route has no locale and
 * never will — it is a tool, not a page, and its language is English.
 *
 * It sits outside app/[locale]/, so the locale routing and the site chrome
 * never touch it. That is deliberate: the editor should not render a header
 * offering to switch the language of a form.
 */
export const metadata: Metadata = {
  title: 'Editor',
  // The content it edits is public; the editor itself has no business in a
  // search index, and there is nothing here to find without a session anyway.
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  )
}
