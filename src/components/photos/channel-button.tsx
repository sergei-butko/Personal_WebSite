import { PlatformIcon } from '@/components/links/platform-icon'

/**
 * "View on Telegram" — the way out to the channel itself.
 *
 * A real button-shaped link rather than the underlined text that used to sit in
 * the sync note at the foot of the page. The channel is the source of
 * everything on this page and following people there is the point of mirroring
 * it, so it gets the weight of a button and sits with the heading instead of
 * below four hundred images.
 *
 * Telegram's own blue rather than the site accent: it names a destination, not
 * a site action, and the mark is meaningless in indigo.
 */
export function ChannelButton({ channel, label }: { channel: string; label: string }) {
  return (
    <a
      href={`https://t.me/${channel}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#229ED9] px-4 py-2 text-[13px] font-medium text-white shadow-sm transition hover:bg-[#0088CC] focus-visible:bg-[#0088CC]"
    >
      <PlatformIcon platform="telegram" className="h-4 w-4" forceColor="currentColor" />
      {label}
    </a>
  )
}
