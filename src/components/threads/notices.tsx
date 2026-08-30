/**
 * The unsynced state, kept in one place so both perfumery views cannot drift
 * apart on what an empty mirror looks like.
 */
export function PerfumeryEmpty({
  message,
  href,
  linkLabel,
}: {
  message: string
  href: string
  linkLabel: string
}) {
  return (
    <p className="rounded-[var(--radius-card)] border border-dashed border-edge p-6 text-sm text-muted">
      {message}{' '}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 transition hover:text-ink"
      >
        {linkLabel}
      </a>
    </p>
  )
}
