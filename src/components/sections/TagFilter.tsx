import Link from 'next/link'
import { localePath, type Locale } from '@/lib/i18n'
import type { TagSummary } from '@/lib/types'

interface TagFilterProps {
  tags: TagSummary[]
  locale: Locale
  /** Tag slug currently being viewed; undefined on the unfiltered index. */
  activeSlug?: string
  allLabel: string
  legend: string
}

/**
 * Tag filtering as navigation rather than state: every filter is a real,
 * pre-rendered URL. Nothing here needs JavaScript, which is the only way it
 * could work under `output: 'export'` anyway.
 */
export function TagFilter({
  tags,
  locale,
  activeSlug,
  allLabel,
  legend,
}: TagFilterProps) {
  if (tags.length === 0) return null

  const base =
    'rounded-full border px-3 py-1 font-mono text-[11px] font-medium transition'
  const inactive = 'border-edge text-muted hover:border-accent hover:text-ink'
  const active = 'border-accent bg-accent text-white'

  return (
    <nav aria-label={legend} className="mb-8">
      <ul className="flex flex-wrap gap-1.5">
        <li>
          <Link
            href={localePath(locale, 'blog')}
            aria-current={activeSlug === undefined ? 'page' : undefined}
            className={`${base} ${activeSlug === undefined ? active : inactive}`}
          >
            {allLabel}
          </Link>
        </li>
        {tags.map((tag) => (
          <li key={tag.slug}>
            <Link
              href={localePath(locale, `blog/tag/${tag.slug}`)}
              aria-current={tag.slug === activeSlug ? 'page' : undefined}
              className={`${base} ${tag.slug === activeSlug ? active : inactive}`}
            >
              {tag.label}{' '}
              <span className="opacity-60" aria-hidden="true">
                {tag.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
