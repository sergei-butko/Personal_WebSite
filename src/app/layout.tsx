import type { Metadata } from 'next'
import { ThemeScript } from '@/components/layout/ThemeScript'

// Self-hosted fonts. Deliberate: no request to Google from your visitors'
// browsers, and the build has no network dependency so CI cannot fail
// because a font CDN was slow.
import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/jetbrains-mono'

import './globals.css'

export const metadata: Metadata = {
  title: 'Serhii Butko',
  description: 'Perfumery writing, photography, and engineering.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  )
}
