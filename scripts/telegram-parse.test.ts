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
import { pairAudio, parseChannelPage } from './telegram-parse'

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

  // Audio. Three of the six posts are songs, each posted seconds after the
  // album it belongs to — the pattern the pairing rule reads.
  check(
    'audio posts are recognised',
    page.posts.filter((p) => p.audio).map((p) => p.id),
    [554, 570, 579]
  )
  check(
    'title and performer are read off the document card',
    page.posts.find((p) => p.id === 554)?.audio,
    { title: 'The Future Is Now', performer: 'The Offspring' }
  )
  checkThat(
    'a post with photos is never read as audio',
    page.posts.every((p) => p.images.length === 0 || p.audio === undefined),
    'a photo album carried an audio card'
  )

  const paired = pairAudio(page.posts)
  check(
    'each song binds to the album directly before it',
    [...paired.entries()].map(([album, track]) => [album, track.id]),
    [
      [547, 554],
      [563, 570],
      [571, 579],
    ]
  )
  check('the paired track keeps its own message id and permalink', paired.get(547), {
    title: 'The Future Is Now',
    performer: 'The Offspring',
    id: 554,
    permalink: 'https://t.me/just_my_photos/554',
  })
  // The rule is positional, so the two ways it can be wrong are worth pinning:
  // a song with no album before it, and a second song after the same album.
  const orphan = { ...page.posts[1]!, id: 1, permalink: 'https://t.me/x/1' }
  check('a song with nothing before it binds to nothing', pairAudio([orphan]).size, 0)
  check(
    'a second song after the same album does not displace the first',
    pairAudio([...page.posts, { ...page.posts[1]!, id: 555 }]).get(547)?.id,
    554
  )

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
  if (failures > 0) process.exit(1)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
