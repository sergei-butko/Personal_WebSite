import type { CSSProperties } from 'react'
import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { links } from '@/lib/links'
import { getPlatform } from '@/lib/platforms'
import { Container, PageHeading } from '@/components/layout/Container'
import { PlatformIcon } from '@/components/ui/PlatformIcon'

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
        {links.map((link) => {
          const brand = getPlatform(link.platform)
          return (
            <li key={link.href}>
              <a
                href={link.href}
                target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                // rel="me" on identity links is what lets Mastodon and similar
                // verify the profile really is yours.
                rel={`${link.identity ? 'me ' : ''}noopener noreferrer`.trim()}
                style={{ ['--brand']: brand.light } as CSSProperties}
                className={[
                  'relative flex h-24 items-center overflow-hidden rounded-[var(--radius-card)]',
                  'bg-[var(--brand)] px-6 text-white',
                  'transition duration-200 hover:-translate-y-0.5 hover:brightness-110',
                  'motion-reduce:hover:translate-y-0',
                ].join(' ')}
              >
                {/* Oversized mark, white, bleeding off the right edge. */}
                <PlatformIcon
                  platform={link.platform}
                  forceColor="#ffffff"
                  className="pointer-events-none absolute -right-5 h-28 w-28 opacity-20"
                />

                <span className="relative flex items-center gap-3">
                  <PlatformIcon
                    platform={link.platform}
                    forceColor="#ffffff"
                    className="h-7 w-7"
                  />
                  {/*
                   * 20px bold, deliberately. Four of these brand colours sit
                   * between 3:1 and 4.5:1 against white — enough for WCAG
                   * large text (14pt bold) but not for body copy. Sizing the
                   * name to actually be large text is the honest fix; nudging
                   * the brand colours until they pass would make them wrong.
                   */}
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
