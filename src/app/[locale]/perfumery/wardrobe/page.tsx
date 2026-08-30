import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { loadThreadsSnapshot } from '@/lib/threads/snapshot'
import { PerfumeryHeader } from '@/components/threads/perfumery-header'
import { Container } from '@/components/layout/container'
import { perfumeryTabs } from '@/lib/threads/tabs'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  const dict = getDictionary(locale)
  return { title: `${dict.threads.viewWardrobe} — ${dict.threads.title} — Serhii Butko` }
}

/**
 * The wardrobe.
 *
 * A named, routable placeholder on purpose. The switch needs two destinations
 * to be a switch, and the standing instruction in CLAUDE.md is to fill empty
 * routes in rather than delete them — a placeholder that says so is honest,
 * where a tab that goes nowhere is a bug report waiting to be filed.
 */
export default async function WardrobePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dict = getDictionary(locale)
  const { username } = await loadThreadsSnapshot()

  return (
    <Container>
      <PerfumeryHeader
        title={dict.threads.title}
        tabs={perfumeryTabs(locale, {
          posts: dict.threads.viewPosts,
          wardrobe: dict.threads.viewWardrobe,
        })}
        current="wardrobe"
        threadsHref={`https://www.threads.com/@${username}`}
        viewOnThreads={dict.threads.viewOnThreads}
      />

      <p className="rounded-[var(--radius-card)] border border-dashed border-edge p-6 text-sm text-muted">
        {dict.threads.wardrobePlaceholder}
      </p>
    </Container>
  )
}
