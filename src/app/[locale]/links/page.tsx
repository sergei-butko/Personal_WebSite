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
                style={
                  {
                    ['--brand']: brand.light,
                    ['--brand-dark']: brand.dark,
                  } as CSSProperties
                }
                className={[
                  'relative flex h-full items-start gap-3 overflow-hidden rounded-[var(--radius-card)]',
                  'border border-edge p-4 pl-5',
                  // 8% is the ceiling: at 12% the muted note text drops below
                  // 4.5:1 against the tint on the strongest brands. Measured,
                  // not guessed.
                  'bg-[color-mix(in_srgb,var(--brand)_8%,var(--color-surface))]',
                  'dark:bg-[color-mix(in_srgb,var(--brand-dark)_8%,var(--color-surface))]',
                  'transition duration-200 hover:-translate-y-0.5',
                  'hover:border-[var(--brand)] dark:hover:border-[var(--brand-dark)]',
                  'motion-reduce:hover:translate-y-0',
                ].join(' ')}
              >
                {/* Brand stripe — carries the colour at full strength where no
                    text sits, so the card reads as the platform's without
                    tinting anything that has to stay readable. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 w-1 bg-[var(--brand)] dark:bg-[var(--brand-dark)]"
                />

                {/* Oversized watermark, bottom-right, well behind the text. */}
                <PlatformIcon
                  platform={link.platform}
                  className="pointer-events-none absolute -right-6 -bottom-7 h-28 w-28 opacity-[0.09]"
                />

                <PlatformIcon
                  platform={link.platform}
                  className="relative mt-0.5 h-6 w-6"
                />
                <span className="relative min-w-0">
                  <span className="block text-[15px] font-semibold">{link.label}</span>
                  {link.handle ? (
                    <span className="block font-mono text-[11px] text-muted">
                      {link.handle}
                    </span>
                  ) : null}
                  {link.note?.[locale] ? (
                    <span className="mt-1.5 block text-[12.5px] leading-relaxed text-muted">
                      {link.note[locale]}
                    </span>
                  ) : null}
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </Container>
  )
}
