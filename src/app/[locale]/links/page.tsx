import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { directoryLinks, linkRel, linkTarget } from '@/lib/links'
import { getPlatform } from '@/lib/links/platforms'
import { PlatformIcon } from '@/components/links/platform-icon'
import { Container, PageHeading } from '@/components/layout/container'

/**
 * One card per destination, and the card is nothing but the brand: its own
 * fill, its own mark, its name. No handle, no note, no second surface — the
 * card is a door, and a door does not need a caption.
 *
 * That keeps the whole tile inside the brand's colours, which is also what
 * lets the name be 20px bold white: at that size it is WCAG large text and
 * needs 3:1, and `platforms.ts` orients every gradient so the name never
 * reaches a stop that misses it.
 */
export default async function LinksPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDictionary(locale)

  return (
    <Container>
      <PageHeading title={dict.links.title} intro={dict.links.intro} />

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {directoryLinks.map((link) => {
          const brand = getPlatform(link.platform)
          return (
            <li key={link.href}>
              <a
                href={link.href}
                target={linkTarget(link)}
                rel={linkRel(link)}
                style={{ background: brand.fill, color: brand.fg }}
                className={[
                  'relative flex h-24 items-center overflow-hidden px-6',
                  'rounded-[var(--radius-card)] border border-edge',
                  'transition duration-200 hover:-translate-y-0.5 hover:brightness-110',
                  'hover:shadow-[0_12px_34px_-14px_rgba(99,102,241,0.4)]',
                  'motion-reduce:hover:translate-y-0',
                ].join(' ')}
              >
                {/* Oversized mark bleeding off the right edge. */}
                <PlatformIcon
                  platform={link.platform}
                  forceColor={brand.fg}
                  className="pointer-events-none absolute -right-5 h-28 w-28 opacity-20"
                />

                <span className="relative flex items-center gap-3">
                  <PlatformIcon
                    platform={link.platform}
                    forceColor={brand.fg}
                    className="h-7 w-7"
                  />
                  <span className="text-[20px] leading-none font-bold">{link.label}</span>
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </Container>
  )
}
