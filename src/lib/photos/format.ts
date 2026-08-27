import type { Locale } from '@/lib/i18n'

/** BCP 47 tags. 'en' alone gives US month/day order, which reads wrong here. */
const TAGS: Record<Locale, string> = { en: 'en-GB', uk: 'uk-UA' }

/**
 * A post's date and time, formatted on the server.
 *
 * Fixed to UTC on purpose, and not as a shortcut. Telegram stamps every post
 * in UTC and the pages are statically exported, so the formatting happens once
 * at build time — a visitor's own zone is not knowable then, and formatting in
 * the client instead would mean the server HTML and the first client render
 * disagree on every card. React calls that a hydration error; a reader sees
 * the timestamps flicker.
 *
 * So the time shown is the time the post carries, the same for everyone,
 * which is also the time Telegram itself shows next to the post.
 */
export function formatPostDateTime(timestamp: string, locale: Locale): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(TAGS[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date)
}

/** `3:07` from 187 seconds. Undefined duration renders nothing. */
export function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return ''
  const whole = Math.floor(seconds)
  const minutes = Math.floor(whole / 60)
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`
}
