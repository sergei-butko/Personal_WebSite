/**
 * The two blocks both photo views need, kept in one place so the roll and the
 * "by post" page cannot drift apart on what an empty channel looks like or on
 * how the sync date is worded.
 */

export function PhotosEmpty({
  message,
  channel,
  viewChannel,
}: {
  message: string
  channel: string
  viewChannel: string
}) {
  return (
    <p className="rounded-[var(--radius-card)] border border-dashed border-edge p-6 text-sm text-muted">
      {message}{' '}
      <a
        href={`https://t.me/${channel}`}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 transition hover:text-ink"
      >
        {viewChannel}
      </a>
    </p>
  )
}

export function SyncedNote({
  syncedAt,
  channel,
  label,
}: {
  syncedAt: string
  channel: string
  label: string
}) {
  return (
    <p className="mt-6 font-mono text-[10.5px] text-muted">
      {label} <time dateTime={syncedAt}>{syncedAt.slice(0, 10)}</time> ·{' '}
      <a
        href={`https://t.me/${channel}`}
        target="_blank"
        rel="noopener noreferrer"
        className="transition hover:text-ink"
      >
        @{channel}
      </a>
    </p>
  )
}
