import Link from 'next/link'
import { localePath, type Locale } from '@/lib/i18n'

export type PhotoView = 'all' | 'posts'

/**
 * The roll / by-post switch.
 *
 * Two <Link>s rather than a client-side tab, which is what lets both views be
 * prerendered: each is its own URL, so it is shareable, it works with JS off,
 * and — with 443 photos — a visitor downloads only the view they asked for
 * instead of both. Next still routes between them on the client, so it
 * behaves like a tab.
 *
 * aria-current is the part a segmented control usually gets wrong: without it
 * the active state is a colour difference and nothing else, which a screen
 * reader cannot see.
 */
export function PhotoViewSwitch({
  locale,
  current,
  allLabel,
  byPostLabel,
}: {
  locale: Locale
  current: PhotoView
  allLabel: string
  byPostLabel: string
}) {
  const tabs = [
    { view: 'all' as const, href: localePath(locale, 'photos'), label: allLabel },
    {
      view: 'posts' as const,
      href: localePath(locale, 'photos/posts'),
      label: byPostLabel,
    },
  ]

  return (
    <div className="inline-flex rounded-full border border-edge bg-surface p-1">
      {tabs.map((tab) => {
        const active = tab.view === current
        return (
          <Link
            key={tab.view}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={[
              'rounded-full px-4 py-1.5 text-[13px] font-medium transition',
              active
                ? 'bg-accent text-white'
                : 'text-muted hover:text-ink focus-visible:text-ink',
            ].join(' ')}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
