/**
 * Fetching audio files out of the channel with the Bot API.
 *
 * The photo sync deliberately needs no credentials: t.me/s/<channel> is a
 * public page and every image URL is in its markup. Audio is the exception,
 * and not by oversight — Telegram renders an audio message as a title/artist
 * card with no file URL anywhere, on /s/ or on ?embed=1. There is no scrape
 * that gets the bytes. A bot is the only public route to them.
 *
 * The awkward part is that the Bot API has no "read message N of channel C".
 * A bot sees a message only when it arrives as an update, and updates expire
 * after 24 hours — useless for a channel with years of history. What does
 * work is forwardMessage: a bot that is a member of the source channel may
 * forward any message out of it, and the reply to that call is the full
 * Message object, file_id included. So each track is forwarded into a private
 * dump chat, its file_id read off the response, the file downloaded, and the
 * forwarded copy deleted again. The dump chat ends up untouched.
 *
 * Everything here is optional. With no token the sync still records each
 * track's title and artist from the HTML, and the site renders a track card
 * that links out to Telegram instead of a player. Setup is in
 * docs/RUNBOOK-CLOUDINARY.md.
 */

const API = 'https://api.telegram.org'

/** Set both, or neither. One without the other is a misconfiguration. */
const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const DUMP_CHAT = process.env.TELEGRAM_AUDIO_CHAT ?? ''

/** The audio metadata Telegram itself holds, which the HTML card only hints at. */
export interface FetchedAudio {
  bytes: Buffer
  /** Seconds. Telegram always sends this for an audio message. */
  duration: number
  /** Tags as Telegram parsed them. Better than the card when they disagree. */
  title: string
  performer: string
}

/**
 * True when the sync can fetch audio bytes at all.
 *
 * Checked once up front so a run without the secrets says so plainly in its
 * first lines rather than logging one skip per track.
 */
export function audioFetchConfigured(): boolean {
  return Boolean(TOKEN && DUMP_CHAT)
}

/**
 * Explains a half-configured setup instead of silently behaving like an
 * unconfigured one — a token with no dump chat looks exactly like "audio is
 * off" in the logs, and is the mistake worth naming.
 */
export function audioFetchStatus(): string {
  if (TOKEN && DUMP_CHAT) return 'configured'
  if (!TOKEN && !DUMP_CHAT) return 'off (no TELEGRAM_BOT_TOKEN)'
  return TOKEN
    ? 'INCOMPLETE: TELEGRAM_BOT_TOKEN is set but TELEGRAM_AUDIO_CHAT is not'
    : 'INCOMPLETE: TELEGRAM_AUDIO_CHAT is set but TELEGRAM_BOT_TOKEN is not'
}

interface ApiResponse<T> {
  ok: boolean
  result?: T
  description?: string
}

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  // A Bot API error is a 4xx with a JSON body that explains itself, so read the
  // body before deciding: `res.ok` alone would throw away the only useful part.
  const payload = (await res.json()) as ApiResponse<T>
  if (!payload.ok || payload.result === undefined) {
    throw new Error(`${method}: ${payload.description ?? `HTTP ${res.status}`}`)
  }
  return payload.result
}

interface ForwardedMessage {
  message_id: number
  audio?: {
    file_id: string
    duration: number
    title?: string
    performer?: string
    file_size?: number
  }
}

/**
 * Forwards one message out of the channel, reads its file_id, downloads the
 * file, and deletes the forwarded copy.
 *
 * Returns null rather than throwing on anything recoverable — a deleted
 * message, a forward the channel forbids, a file past the Bot API's 20 MB
 * download ceiling. One unreachable song must not fail a sync that has
 * already re-hosted a few hundred photos.
 */
export async function fetchAudio(
  channel: string,
  messageId: number,
  maxBytes: number
): Promise<FetchedAudio | null> {
  if (!audioFetchConfigured()) return null

  let forwarded: ForwardedMessage
  try {
    forwarded = await call<ForwardedMessage>('forwardMessage', {
      chat_id: DUMP_CHAT,
      from_chat_id: `@${channel}`,
      message_id: messageId,
      disable_notification: true,
    })
  } catch (error) {
    console.warn(`  ! audio ${messageId}: ${(error as Error).message}`)
    return null
  }

  try {
    const audio = forwarded.audio
    if (!audio) {
      console.warn(`  ! audio ${messageId}: forwarded message carries no audio`)
      return null
    }
    if (audio.file_size && audio.file_size > maxBytes) {
      console.warn(
        `  ! audio ${messageId}: ${Math.round(audio.file_size / 1024 / 1024)} MB ` +
          `exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit, skipping`
      )
      return null
    }

    const file = await call<{ file_path?: string }>('getFile', {
      file_id: audio.file_id,
    })
    if (!file.file_path) {
      console.warn(`  ! audio ${messageId}: getFile returned no path`)
      return null
    }

    const res = await fetch(`${API}/file/bot${TOKEN}/${file.file_path}`)
    if (!res.ok) {
      console.warn(`  ! audio ${messageId}: HTTP ${res.status} downloading the file`)
      return null
    }

    return {
      bytes: Buffer.from(await res.arrayBuffer()),
      duration: audio.duration,
      title: audio.title ?? '',
      performer: audio.performer ?? '',
    }
  } catch (error) {
    console.warn(`  ! audio ${messageId}: ${(error as Error).message}`)
    return null
  } finally {
    // Always, including on the failure paths above: the copy is litter in a
    // chat the owner reads, and leaving it there on every error would fill it.
    try {
      await call('deleteMessage', {
        chat_id: DUMP_CHAT,
        message_id: forwarded.message_id,
      })
    } catch {
      // Deletion is housekeeping. Failing it must not lose a downloaded track.
    }
  }
}
