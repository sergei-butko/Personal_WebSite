import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { linkGroups } from '@/lib/links'
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

      <div className="flex flex-col gap-8">
        {linkGroups.map((group) => (
          <section key={group.id}>
            <h2 className="mb-3 font-mono text-[10.5px] font-semibold tracking-[0.1em] text-muted uppercase">
              {group.title[locale]}
            </h2>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.links.map((link) => {
                const brand = getPlatform(link.platform)
                return (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                      // rel="me" on identity links is what lets Mastodon and
                      // similar verify the profile really is yours.
                      rel={`${link.identity ? 'me ' : ''}noopener noreferrer`.trim()}
                      style={
                        {
                          ['--brand' as string]: brand.light,
                          ['--brand-dark' as string]: brand.dark,
                        } as React.CSSProperties
                      }
                      className={[
                        'flex h-full items-start gap-3 rounded-[var(--radius-card)] border border-edge bg-surface p-4',
                        'transition duration-200 hover:-translate-y-0.5',
                        // The card takes the brand colour only on hover, so the
                        // page reads as one system at rest rather than eight
                        // competing logos.
                        'hover:border-[var(--brand)] dark:hover:border-[var(--brand-dark)]',
                        'motion-reduce:hover:translate-y-0',
                      ].join(' ')}
                    >
                      <PlatformIcon platform={link.platform} className="mt-0.5 h-6 w-6" />
                      <span className="min-w-0">
                        <span className="block text-[15px] font-semibold">
                          {link.label}
                        </span>
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
          </section>
        ))}
      </div>
    </Container>
  )
}
