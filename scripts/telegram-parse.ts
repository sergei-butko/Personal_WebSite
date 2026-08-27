/**
 * Parsing for t.me/s/<channel> preview pages.
 *
 * Kept separate from the sync so it can be tested against a saved fixture
 * without touching the network. Telegram will change this markup eventually;
 * when it does, `npm run test:telegram` fails with a useful message instead
 * of the sync silently producing nothing.
 */

import * as cheerio from 'cheerio'

export interface ParsedImage {
  /** Signed telesco.pe URL. Expires — download, never link. */
  url: string
  /** Intrinsic display size from Telegram's inline layout, when present. */
  width?: number
  height?: number
}

/**
 * The track card Telegram renders for an audio message.
 *
 * Title and performer are all the public preview page gives up — there is no
 * file URL anywhere in the markup, on /s/ or on ?embed=1, because Telegram
 * does not serve audio documents to logged-out clients the way it serves
 * photos and videos. Fetching the bytes needs the Bot API; see
 * ./telegram-bot.ts. What is here is enough to label a player.
 */
export interface ParsedAudio {
  /** Track title, from the document title row. */
  title: string
  /** Artist, from the "extra" row under it. Sometimes empty. */
  performer: string
}

export interface ParsedPost {
  id: number
  permalink: string
  /** ISO 8601 from <time datetime>. */
  timestamp: string
  /** Usually empty: this channel captions almost nothing. */
  caption: string
  images: ParsedImage[]
  /** Present when the post is an audio message rather than photos. */
  audio?: ParsedAudio
}

export interface ParsedPage {
  channel: string
  posts: ParsedPost[]
  /** Message id to pass as ?before= for the previous page, if any. */
  nextBefore: number | null
}

const CSS_URL = /background-image:\s*url\('([^']+)'\)/
const PX = (style: string, prop: string): number | undefined => {
  const match = new RegExp(`(?:^|;)\\s*${prop}:\\s*(\\d+(?:\\.\\d+)?)px`).exec(style)
  return match ? Math.round(Number(match[1])) : undefined
}

export function parseChannelPage(html: string): ParsedPage {
  const $ = cheerio.load(html)
  const posts: ParsedPost[] = []
  let channel = ''

  $('.tgme_widget_message').each((_, element) => {
    const node = $(element)
    const dataPost = node.attr('data-post') ?? ''
    const [handle, rawId] = dataPost.split('/')
    const id = Number(rawId)
    if (!handle || !Number.isFinite(id)) return
    channel ||= handle

    const timestamp = node.find('time[datetime]').first().attr('datetime') ?? ''
    if (!timestamp) return

    // A post is often an album, so collect every photo in it. The URL lives in
    // an inline background-image rather than an <img src>.
    const images: ParsedImage[] = []
    node.find('.tgme_widget_message_photo_wrap').each((__, photo) => {
      const style = $(photo).attr('style') ?? ''
      const match = CSS_URL.exec(style)
      if (!match?.[1]) return
      images.push({
        url: match[1],
        width: PX(style, 'width'),
        height: PX(style, 'height'),
      })
    })

    // An audio message renders as a document card whose icon carries the
    // `audio` class. Scoping to that class matters: a PDF or a zip is the same
    // markup with a different icon, and would otherwise be read as a song.
    const document = node.find('.tgme_widget_message_document_wrap').first()
    const isAudio = document.find('.tgme_widget_message_document_icon.audio').length > 0
    const title = document
      .find('.tgme_widget_message_document_title')
      .first()
      .text()
      .trim()
    const audio: ParsedAudio | undefined =
      isAudio && title
        ? {
            title,
            performer: document
              .find('.tgme_widget_message_document_extra')
              .first()
              .text()
              .trim(),
          }
        : undefined

    posts.push({
      id,
      permalink: `https://t.me/${handle}/${id}`,
      timestamp: new Date(timestamp).toISOString(),
      caption: node.find('.tgme_widget_message_text').first().text().trim(),
      images,
      ...(audio ? { audio } : {}),
    })
  })

  // Telegram pages backwards: this attribute carries the id to ask for next.
  const before = $('[data-before]').first().attr('data-before')
  const nextBefore = before && Number.isFinite(Number(before)) ? Number(before) : null

  return { channel, posts, nextBefore }
}

/** An audio post matched to the album it belongs to. */
export interface PairedAudio extends ParsedAudio {
  /** Telegram message id of the AUDIO post — what getFile needs to reach. */
  id: number
  permalink: string
}

/**
 * Which album each song belongs to.
 *
 * The channel's habit — and the only signal there is — is that the track is
 * posted immediately after the photos it goes with. Nothing in Telegram's
 * markup links the two, so the rule is positional: an audio-only post binds to
 * the post directly before it in message order, and only if that post has
 * photos. A song following another song, or opening a page, binds to nothing
 * and is dropped rather than guessed at.
 *
 * Sorting by id rather than trusting document order is what makes this safe
 * across pagination: the sync walks history backwards in pages, so an album
 * and its track can land in separate fetches, and a page-local rule would miss
 * exactly the pairs that straddle a boundary.
 *
 * Returns album post id → track. Pure, so the fixture test pins the rule.
 */
export function pairAudio(posts: readonly ParsedPost[]): Map<number, PairedAudio> {
  const ordered = [...posts].sort((a, b) => a.id - b.id)
  const paired = new Map<number, PairedAudio>()

  for (const [index, post] of ordered.entries()) {
    if (!post.audio || post.images.length > 0) continue

    const previous = ordered[index - 1]
    if (!previous || previous.images.length === 0) continue
    // First song wins. A second track after the same album would otherwise
    // overwrite the first, and there is no way to tell which was meant.
    if (paired.has(previous.id)) continue

    paired.set(previous.id, {
      ...post.audio,
      id: post.id,
      permalink: post.permalink,
    })
  }

  return paired
}
