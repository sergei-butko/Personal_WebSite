/**
 * Threads token helper.
 *
 *   npm run threads:exchange -- <short-lived-token>
 *   npm run threads:refresh  -- <long-lived-token>
 *
 * Short-lived tokens last 1 hour and must be exchanged before they expire.
 * Long-lived tokens last 60 days, can only be refreshed once they are at
 * least 24 hours old, and die permanently if not refreshed inside the window.
 *
 * Docs: https://developers.facebook.com/docs/threads/get-started/long-lived-tokens
 */

const HOST = 'https://graph.threads.net'

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

/**
 * Meta's error envelope. `message` alone is close to useless here — both a
 * wrong client_secret and an already-long-lived token come back as the same
 * flat "Invalid parameter". The code/subcode pair is what distinguishes them,
 * so all of it gets printed.
 */
interface MetaError {
  message?: string
  type?: string
  code?: number
  error_subcode?: number
  error_user_msg?: string
  fbtrace_id?: string
}

/** Known code/subcode meanings, so the reader is not left googling. */
function explain(error: MetaError): string {
  if (error.code === 190) {
    return (
      'The token is expired, malformed, or from a different app. Short-lived ' +
      'tokens last one hour — generate a fresh one and retry immediately.'
    )
  }
  if (error.code === 100) {
    return (
      'Usually one of: (a) client_secret is the Facebook app secret rather ' +
      'than the THREADS app secret — see step 3; (b) the token is already ' +
      'long-lived, in which case skip the exchange and store it as-is; ' +
      '(c) the token was truncated or copied with surrounding whitespace.'
    )
  }
  if (error.code === 10 || error.code === 200) {
    return 'threads_basic was not granted, or the tester invitation is unaccepted.'
  }
  return ''
}

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

async function call(url: URL): Promise<TokenResponse> {
  const res = await fetch(url)
  const text = await res.text()

  // Meta does not always answer with JSON — maintenance pages, rate-limit
  // interstitials and proxy errors arrive as HTML. Parsing blindly turns those
  // into "Unexpected token '<'", which says nothing useful in a CI log. A
  // token that silently fails to refresh is the costliest failure here, so the
  // error has to be readable.
  let body: TokenResponse & { error?: MetaError }
  try {
    body = JSON.parse(text) as TokenResponse & { error?: MetaError }
  } catch {
    fail(
      `Threads API ${res.status} returned non-JSON (${text.length} bytes): ` +
        `${text.slice(0, 200).replace(/\s+/g, ' ')}`
    )
  }

  if (!res.ok || !body.access_token) {
    const error = body.error
    if (!error) fail(`Threads API ${res.status}: ${JSON.stringify(body)}`)

    const parts = [`Threads API ${res.status}: ${error.message ?? 'unknown error'}`]
    const codes = [
      error.type,
      error.code !== undefined ? `code ${error.code}` : undefined,
      error.error_subcode !== undefined ? `subcode ${error.error_subcode}` : undefined,
    ].filter(Boolean)
    if (codes.length > 0) parts.push(`  (${codes.join(', ')})`)
    if (error.error_user_msg) parts.push(`  ${error.error_user_msg}`)

    const hint = explain(error)
    if (hint) parts.push(`\n  Likely cause: ${hint}`)
    if (error.fbtrace_id) parts.push(`\n  fbtrace_id: ${error.fbtrace_id}`)

    fail(parts.join('\n'))
  }
  return body
}

function report(token: TokenResponse): void {
  // THREADS_TOKEN_RAW=1 prints the bare token and nothing else, so CI can
  // capture it directly. Parsing prose out of stdout is how these break.
  if (process.env.THREADS_TOKEN_RAW === '1') {
    process.stdout.write(token.access_token)
    return
  }

  const days = Math.round(token.expires_in / 86_400)
  const expiry = new Date(Date.now() + token.expires_in * 1000).toISOString()
  console.log(`\n${token.access_token}\n`)
  console.log(`Valid ${days} days, until ${expiry}.`)
  console.log('Store it as the THREADS_ACCESS_TOKEN repository secret.')
}

async function main(): Promise<void> {
  const [mode, token] = [process.argv[2], process.argv[3]]

  if (!token) fail('Usage: tsx scripts/threads-token.ts <exchange|refresh> <token>')

  if (mode === 'exchange') {
    const secret = process.env.THREADS_APP_SECRET
    if (!secret) fail('THREADS_APP_SECRET is not set. Export it before exchanging.')

    const url = new URL('/access_token', HOST)
    url.searchParams.set('grant_type', 'th_exchange_token')
    url.searchParams.set('client_secret', secret)
    url.searchParams.set('access_token', token)
    report(await call(url))
    return
  }

  if (mode === 'refresh') {
    const url = new URL('/refresh_access_token', HOST)
    url.searchParams.set('grant_type', 'th_refresh_token')
    url.searchParams.set('access_token', token)
    report(await call(url))
    return
  }

  fail(`Unknown mode "${mode}". Use "exchange" or "refresh".`)
}

// Not top-level await: tsx transpiles these to CJS (the package is not
// type: module), and esbuild rejects top-level await in CJS output.
// An explicit entrypoint works under either format.
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
