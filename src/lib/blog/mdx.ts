import { evaluate, type EvaluateOptions } from '@mdx-js/mdx'
import * as jsxRuntime from 'react/jsx-runtime'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeShiki from '@shikijs/rehype'
import type { MDXComponents } from '@/components/blog/mdx-components'

/**
 * MDX -> React component, at build time.
 *
 * `evaluate` compiles and runs the MDX in-process. That is only acceptable
 * because it happens during the static export, over files from this
 * repository — never over anything a visitor supplies. The output is plain
 * HTML in ./out; none of this ships to the browser.
 */

type MdxContent = (props: { components?: MDXComponents }) => React.JSX.Element

/**
 * Shiki emits both themes at once: the light colours inline, the dark ones as
 * a `--shiki-dark` custom property that globals.css switches on under `.dark`.
 * One highlight pass, no flash, no client-side re-highlighting.
 */
const shikiOptions = {
  themes: { light: 'github-light', dark: 'github-dark' },
  defaultColor: 'light',
} as const

export async function compileMdx(source: string): Promise<MdxContent> {
  const { default: Content } = await evaluate(source, {
    ...(jsxRuntime as unknown as EvaluateOptions),
    development: false,
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          // `wrap` turns the heading text itself into the anchor, so there is
          // no decorative link icon for a screen reader to announce.
          behavior: 'wrap',
          properties: { className: 'heading-anchor' },
        },
      ],
      [rehypeShiki, shikiOptions],
    ],
  })

  return Content as MdxContent
}
