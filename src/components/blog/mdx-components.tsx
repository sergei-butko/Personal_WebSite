import Link from 'next/link'
import type { AnchorHTMLAttributes, ImgHTMLAttributes } from 'react'
import { withBase } from '@/lib/paths'

/**
 * Element overrides handed to a compiled MDX post.
 *
 * Only the elements that would otherwise break under `basePath` or static
 * export are overridden. Everything else is styled by the `.prose` rules in
 * globals.css, which keeps the MDX authoring surface plain Markdown.
 */

export type MDXComponents = Record<string, React.ComponentType<never>>

/**
 * Markdown produces raw `<a>`, which does not get the basePath prefix. Route
 * internal links through next/link so `/en/blog/x/` resolves under
 * /Personal_WebSite/, and give external ones the usual rel hardening.
 */
function MdxLink({ href = '', ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isInternal = href.startsWith('/')
  const isFragment = href.startsWith('#')

  if (isInternal) return <Link href={href} {...props} />
  if (isFragment) return <a href={href} {...props} />

  return <a href={href} target="_blank" rel="noopener noreferrer" {...props} />
}

/**
 * `next/image` optimisation needs a server, so posts use plain `<img>`.
 * Root-relative sources still need the basePath prefix by hand.
 */
function MdxImage({ src, alt = '', ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const resolved = typeof src === 'string' && src.startsWith('/') ? withBase(src) : src

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={resolved} alt={alt} loading="lazy" decoding="async" {...props} />
}

/**
 * An aside for the sort of caveat a perfumery post is full of — "this is one
 * bottle, not a sample set". Available in MDX as <Note>…</Note>.
 */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <aside className="my-6 rounded-[var(--radius-card)] border border-edge bg-chip px-5 py-4 text-[14px] text-muted">
      {children}
    </aside>
  )
}

export const mdxComponents = {
  a: MdxLink,
  img: MdxImage,
  Note,
} as unknown as MDXComponents
