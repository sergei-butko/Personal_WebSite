import Link from 'next/link'
import { defaultLocale, localePath } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'

export default function NotFound() {
  const dict = getDictionary(defaultLocale)
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-5 text-center">
      <h1 className="font-serif text-3xl font-semibold">{dict.common.notFoundTitle}</h1>
      <p className="text-muted">{dict.common.notFoundBody}</p>
      <Link
        href={localePath(defaultLocale)}
        className="mt-2 rounded-md border border-edge px-4 py-2 text-sm transition hover:border-accent"
      >
        {dict.common.backHome}
      </Link>
    </main>
  )
}
