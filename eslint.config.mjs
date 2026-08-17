import next from 'eslint-config-next'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

/**
 * Flat config. eslint-config-next v16 exports flat configs directly —
 * the older FlatCompat shim is unnecessary and breaks on ESLint 9.39.
 */
const config = [
  { ignores: ['out/**', '.next/**', 'node_modules/**', 'next-env.d.ts'] },
  ...next,
  ...nextCoreWebVitals,
  ...nextTypescript,
]

export default config
