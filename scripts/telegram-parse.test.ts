/**
 * Fixture test for the t.me parser. No network.
 *
 *   npm run test:telegram
 *
 * The fixture is a real saved channel page. If Telegram changes its markup,
 * refresh the fixture and this test tells you exactly what broke.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseChannelPage } from './telegram-parse'

const FIXTURE = path.join(import.meta.dirname, '__fixtures__', 'channel-page.html')

let failures = 0

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(
    `${ok ? '✓' : '✗'} ${label}${ok ? '' : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`
  )
}

function checkThat(label: string, condition: boolean, detail = ''): void {
  if (!condition) failures++
  console.log(`${condition ? '✓' : '✗'} ${label}${condition ? '' : ` — ${detail}`}`)
}

async function main(): Promise<void> {
  const page = parseChannelPage(await readFile(FIXTURE, 'utf8'))

  check('channel handle', page.channel, 'just_my_photos')
  check('post count', page.posts.length, 6)
  check('pagination cursor', page.nextBefore, 547)
  check(
    'post ids, newest first in document order',
    page.posts.map((p) => p.id),
    [547, 554, 563, 570, 571, 579]
  )

  // 22, not the 25 background-image occurrences a naive grep finds: the other
  // three are emoji sprites, which is exactly why this scopes to photo wraps.
  const total = page.posts.reduce((sum, p) => sum + p.images.length, 0)
  check('total images across all posts', total, 22)
  checkThat(
    'emoji sprites are not mistaken for photos',
    page.posts.every((p) => p.images.every((i) => !i.url.includes('/img/emoji/'))),
    'an emoji sprite was parsed as a photo'
  )
  checkThat(
    'posts are albums — at least one has multiple photos',
    page.posts.some((p) => p.images.length > 1),
    'grouped media handling may have regressed'
  )

  checkThat(
    'every post has a valid ISO timestamp',
    page.posts.every((p) => !Number.isNaN(Date.parse(p.timestamp))),
    'one or more timestamps failed to parse'
  )
  checkThat(
    'every image URL is on telesco.pe',
    page.posts.every((p) => p.images.every((i) => i.url.includes('telesco.pe'))),
    'an image URL did not look like a Telegram CDN URL'
  )
  checkThat(
    'permalinks point at the channel',
    page.posts.every((p) => p.permalink === `https://t.me/just_my_photos/${p.id}`),
    'permalink shape changed'
  )
  // This channel captions almost nothing, which is why photo-meta.ts exists.
  checkThat(
    'captions are absent in this fixture',
    page.posts.every((p) => p.caption === ''),
    'a caption appeared — good, but the alt-text fallback assumption needs revisiting'
  )

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
  if (failures > 0) process.exit(1)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
