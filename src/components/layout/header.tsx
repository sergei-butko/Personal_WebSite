import Link from 'next/link'
import { Nav } from '@/components/layout/nav'
import { localePath, type Locale } from '@/lib/i18n'
import type { Dictionary } from '@/content/i18n'
import { profile } from '@/content/profile'
import { withBase } from '@/lib/paths'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { LocaleSwitcher } from '@/components/layout/locale-switcher'

/**
 * Single source of truth for navigation. Adding a route is one line here.
 *
 * `blog` and `projects` are deliberately absent: both routes still build and
 * are reachable by URL, they are just not advertised while there is nothing
 * published in them. Re-add a line to bring either back.
 */
const navItems = [
  { key: 'home', path: '' },
  { key: 'perfumery', path: 'perfumery' },
  { key: 'photos', path: 'photos' },
  { key: 'links', path: 'links' },
  { key: 'about', path: 'about' },
  { key: 'cv', path: 'cv' },
] as const

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  return (
    <header className="border-b border-edge">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <Link
          href={localePath(locale)}
          className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"
        >
          {/*
           * The monogram, from Cloudinary's `public/main` — see public/README.md.
           *
           * alt is empty on purpose: the link already contains the name, so
           * describing the logo would make a screen reader announce "Serhii
           * Butko Serhii Butko". Decorative here is the accurate answer, not a
           * shortcut.
           *
           * A raw <img> because next/image is unavailable under output:
           * 'export', and therefore withBase() — basePath is not applied to a
           * hand-written src. width/height are the file's real pixels so the
           * box is reserved before it loads; the class is what sizes it.
           */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={withBase('/logo-mark.png')}
            alt=""
            width={96}
            height={96}
            decoding="async"
            className="h-7 w-7 shrink-0"
          />
          {profile.name}
        </Link>

        <div className="flex flex-wrap items-center gap-4">
          {/*
           * The nav is a Client Component because marking the current page
           * needs the pathname, and the header is rendered once by the layout,
           * which does not know it. Everything else here stays on the server.
           */}
          <Nav
            locale={locale}
            label={dict.common.menu}
            items={navItems.map((item) => ({
              href: localePath(locale, item.path),
              label: dict.nav[item.key],
            }))}
          />
          <LocaleSwitcher current={locale} label={dict.common.language} />
          <ThemeToggle label={dict.common.theme} />
        </div>
      </div>
    </header>
  )
}
