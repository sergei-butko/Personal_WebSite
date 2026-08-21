import Link from 'next/link'
import { localePath, type Locale } from '@/lib/i18n'
import type { Dictionary } from '@/content/i18n'
import { profile } from '@/content/profile'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { LocaleSwitcher } from '@/components/layout/locale-switcher'

/**
 * Single source of truth for navigation. Adding a route is one line here.
 *
 * `blog` and `projects` are deliberately absent: both routes still build and
 * are reachable by URL, they are just not advertised while there is nothing
 * published in them. Re-add a line to bring either back.
 */
export const navItems = [
  { key: 'home', path: '' },
  { key: 'threads', path: 'threads' },
  { key: 'photos', path: 'photos' },
  { key: 'links', path: 'links' },
  { key: 'about', path: 'about' },
  { key: 'cv', path: 'cv' },
] as const

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <header className="border-b border-edge">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Link href={localePath(locale)} className="text-lg font-semibold tracking-tight">
          {profile.name}
        </Link>

        <div className="flex flex-wrap items-center gap-4">
          <nav aria-label={dict.common.menu}>
            <ul className="flex flex-wrap gap-4 text-sm font-medium text-muted">
              {navItems.map((item) => (
                <li key={item.key}>
                  <Link
                    href={localePath(locale, item.path)}
                    className="transition hover:text-ink"
                  >
                    {dict.nav[item.key]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <LocaleSwitcher current={locale} label={dict.common.language} />
          <ThemeToggle label={dict.common.theme} />
        </div>
      </div>
    </header>
  )
}
