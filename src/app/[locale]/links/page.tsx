import type { CSSProperties } from 'react'
import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { links, linkRel, linkTarget } from '@/lib/links'
import { getPlatform } from '@/lib/links/platforms'
import { PlatformIcon } from '@/components/links/platform-icon'
import { Container, PageHeading } from '@/components/layout/container'

/**
 * Each card is two zones, and the split is a contrast requirement rather than
 * a stylistic one.
 *
 * The brand fill can only carry the platform name, because four of these
 * colours land between 3:1 and 4.5:1 against white — Instagram 3.85, Telegram
 * 3.89, Apple Music 3.90, Email 4.47 (measured, not eyeballed). That clears
 * WCAG for large bold text and fails it for body copy, so the name stays 20px
 * bold on the fill and the handle and note sit below it on the card's own
 * surface, in the ordinary ink and muted tokens. Tinting the brand colours
 * until small white text passed would make them the wrong colours.
 *
 * A card with neither handle nor note lets the brand zone take the whole tile,
 * so an entry with nothing to say still looks deliberate rather than clipped.
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
        {links.map((link) => {
          const brand = getPlatform(link.platform)
          const note = link.note?.[locale]
          const hasDetail = Boolean(link.handle || note)
          return (
            <li key={link.href} className="h-full">
              <a
                href={link.href}
                target={linkTarget(link)}
                rel={linkRel(link)}
                style={{ ['--brand']: brand.light } as CSSProperties}
                className={[
                  'flex h-full min-h-24 flex-col overflow-hidden',
                  'rounded-[var(--radius-card)] border border-edge bg-surface',
                  'transition duration-200 hover:-translate-y-0.5',
                  'hover:border-[var(--brand)] hover:brightness-105',
                  'motion-reduce:hover:translate-y-0',
                ].join(' ')}
              >
                <span
                  className={[
                    'relative flex items-center overflow-hidden',
                    'bg-[var(--brand)] px-6 text-white',
                    hasDetail ? 'h-24' : 'flex-1',
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
                    <span className="text-[20px] leading-none font-bold">
                      {link.label}
                    </span>
                  </span>
                </span>

                {hasDetail ? (
                  <span className="flex flex-col gap-1 px-6 py-4">
                    {link.handle ? (
                      <span className="font-mono text-[12px] text-muted">
                        {link.handle}
                      </span>
                    ) : null}
                    {note ? (
                      <span className="text-[13px] leading-snug text-ink">{note}</span>
                    ) : null}
                  </span>
                ) : null}
              </a>
            </li>
          )
        })}
      </ul>
    </Container>
  )
}
