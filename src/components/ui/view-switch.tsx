import Link from 'next/link'

/**
 * A segmented control over two or more routes.
 *
 * Links rather than a client-side tab, which is what lets every view be
 * prerendered: each is its own URL, so it is shareable, it works with JS off,
 * and — with 443 photos — a visitor downloads only the view they asked for
 * instead of all of them. Next still routes between them on the client, so it
 * behaves like a tab.
 *
 * aria-current is the part a segmented control usually gets wrong: without it
 * the active state is a colour difference and nothing else, which a screen
 * reader cannot see.
 *
 * Generic because the photos and perfumery pages want the same control over
 * different routes, and the second copy is where the aria-current gets left
 * out.
 */
export interface ViewTab {
  /** Stable key for React, and what `current` is compared against. */
  view: string
  href: string
  label: string
}

export function ViewSwitch({ tabs, current }: { tabs: ViewTab[]; current: string }) {
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
