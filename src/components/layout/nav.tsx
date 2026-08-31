'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { localePath, type Locale } from '@/lib/i18n'

export interface NavItem {
  href: string
  label: string
}

/**
 * The header nav, with the current page marked.
 *
 * A Client Component for one reason: the header is rendered once by the locale
 * layout, which has no idea which page is below it. `usePathname` is the only
 * way to know without threading a segment through every page — and every page
 * having to remember to declare itself is exactly how one of them ends up not
 * doing so.
 *
 * `usePathname` returns the path WITHOUT basePath, so this compares against
 * `localePath` output directly and keeps working when the site moves to a
 * custom domain and the prefix disappears.
 *
 * ## Matching by prefix, not equality
 *
 * /en/perfumery/shelf must light up "Perfumery". Equality would leave the
 * nav looking like nothing is selected on every sub-view, which reads as a bug.
 * Home is the exception and matches exactly, since every path starts with
 * "/en/" and it would otherwise be permanently active.
 *
 * aria-current is the part that matters beyond the colour: without it the
 * active state is a shade of text a screen reader cannot perceive.
 */
export function Nav({
  locale,
  items,
  label,
}: {
  locale: Locale
  items: NavItem[]
  label: string
}) {
  const pathname = usePathname()
  const home = localePath(locale)
  // Both sides carry a trailing slash (trailingSlash: true, and localePath
  // adds one), but a stray difference here silently disables every match.
  const here = pathname.endsWith('/') ? pathname : `${pathname}/`

  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-4 text-sm font-medium">
        {items.map((item) => {
          const active = item.href === home ? here === home : here.startsWith(item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'text-ink underline decoration-accent decoration-2 underline-offset-[6px]'
                    : 'text-muted transition hover:text-ink'
                }
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
