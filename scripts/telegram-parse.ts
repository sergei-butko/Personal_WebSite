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

export interface ParsedPost {
  id: number
  permalink: string
  /** ISO 8601 from <time datetime>. */
  timestamp: string
  /** Usually empty: this channel captions almost nothing. */
  caption: string
  images: ParsedImage[]
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

    posts.push({
      id,
      permalink: `https://t.me/${handle}/${id}`,
      timestamp: new Date(timestamp).toISOString(),
      caption: node.find('.tgme_widget_message_text').first().text().trim(),
      images,
    })
  })

  // Telegram pages backwards: this attribute carries the id to ask for next.
  const before = $('[data-before]').first().attr('data-before')
  const nextBefore = before && Number.isFinite(Number(before)) ? Number(before) : null

  return { channel, posts, nextBefore }
}
