import next from 'eslint-config-next'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

/**
 * Flat config. eslint-config-next v16 exports flat configs directly —
 * the older FlatCompat shim is unnecessary and breaks on ESLint 9.39.
 */

/**
 * Import boundaries.
 *
 * The layering is the one the folder names imply:
 *
 *   app/  ->  components/  ->  lib/  ->  content/
 *
 * Each rule exists because the prose version of it did not hold.
 * "Components never import from content/" was written in CLAUDE.md for months
 * while header.tsx and footer.tsx both imported @/content/profile — a rule
 * nothing checks is a rule that has already been broken somewhere you have not
 * looked yet. These fail `npm run lint` instead.
 *
 * `@typescript-eslint/no-restricted-imports` rather than the core rule, because
 * `allowTypeImports` is the difference between "this module describes a shape"
 * and "this module pulls in code".
 */
const boundaries = [
  {
    // lib/ is data and logic. It must not reach up into presentation — a type
    // is fine (mdx.ts needs the MDXComponents shape), a value is not.
    files: ['src/lib/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/components/**'],
              allowTypeImports: true,
              message:
                'lib/ holds data and logic; components render it. Import a type if ' +
                'you need the shape, otherwise invert it — let the component call lib/.',
            },
            { group: ['@/app/**'], message: 'lib/ cannot import from a route.' },
          ],
        },
      ],
    },
  },
  {
    // Reusable components take their data as props, which is what lets the same
    // card render a real post, a fixture, or a preview.
    //
    // components/layout/ is deliberately exempt: header and footer are site
    // chrome, instantiated once by the locale layout and reusable by nobody, so
    // reading content/profile directly is honest rather than prop-drilled.
    // vercel/commerce does the same — its footer.tsx fetches its own menu.
    files: ['src/components/**/*.{ts,tsx}'],
    ignores: ['src/components/layout/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/content/*', '@/content/**'],
              message:
                'Components take content as props. Read it in lib/ or in the page ' +
                'and pass it down. (components/layout/ is exempt — see eslint.config.mjs.)',
            },
            { group: ['@/app/**'], message: 'A component cannot import from a route.' },
          ],
        },
      ],
    },
  },
  {
    // content/ is data. It may name a type to describe its own shape, but
    // importing a value would put application code behind the one directory
    // Serhii edits by hand.
    files: ['src/content/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/**', '@/components/**', '@/app/**'],
              allowTypeImports: true,
              message:
                'content/ holds data, not behaviour. A type-only import is fine; ' +
                'importing a value belongs in lib/ or in a page.',
            },
          ],
        },
      ],
    },
  },
]

const config = [
  { ignores: ['out/**', '.next/**', 'node_modules/**', 'next-env.d.ts'] },
  ...next,
  ...nextCoreWebVitals,
  ...nextTypescript,
  ...boundaries,
]

export default config
