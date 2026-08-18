import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { linkGroups } from '@/lib/links'
import { Container, PageHeading } from '@/components/layout/Container'
import { Card } from '@/components/ui/Card'

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {linkGroups.map((group) => (
          <Card key={group.id} as="section">
            <h2 className="mb-3 font-mono text-[10.5px] font-semibold tracking-[0.1em] text-muted uppercase">
              {group.title[locale]}
            </h2>
            <ul className="flex flex-col gap-2.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                    // rel="me" on identity links: it is what lets Mastodon and
                    // similar verify that this profile is really yours.
                    rel={`${link.identity ? 'me ' : ''}noopener noreferrer`.trim()}
                    className="group/link flex items-baseline justify-between gap-3 transition"
                  >
                    <span className="text-[15px] font-medium group-hover/link:text-accent">
                      {link.label}
                    </span>
                    {link.note?.[locale] ? (
                      <span className="text-right text-[12.5px] text-muted">
                        {link.note[locale]}
                      </span>
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </Container>
  )
}
