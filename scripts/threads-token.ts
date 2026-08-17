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

export {} // Makes this a module, so top-level await is allowed.

const HOST = 'https://graph.threads.net'

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

async function call(url: URL): Promise<TokenResponse> {
  const res = await fetch(url)
  const body = (await res.json()) as TokenResponse & { error?: { message?: string } }

  if (!res.ok || !body.access_token) {
    fail(`Threads API ${res.status}: ${body.error?.message ?? JSON.stringify(body)}`)
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

  if (!token) fail(`Usage: tsx scripts/threads-token.ts <exchange|refresh> <token>`)

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

await main()
