import type { Locale } from '@/lib/i18n'
import { type CvContact, type LocalizedText, text } from '@/lib/cv'
import { PlatformIcon } from '@/components/links/platform-icon'
import { Card } from '@/components/ui/card'

/**
 * Who this is, and how to reach him — the top of the sticky rail.
 *
 * The contact pills carry their brand mark and stack vertically rather than
 * wrapping into a row. Both reasons are the same one: the LinkedIn and GitHub
 * handles are the identical string, so the mark is the only thing that says
 * where a pill goes, and a wrapped row hides it at the start of the second
 * line as often as not.
 */
export function IdentityCard({
  name,
  initials,
  role,
  org,
  location,
  contacts,
  locale,
}: {
  name: LocalizedText
  initials: string
  role: string
  org: string
  location: LocalizedText
  contacts: CvContact[]
  locale: Locale
}) {
  return (
    <Card as="section" featured>
      <span
        aria-hidden="true"
        className="grid h-14 w-14 place-items-center rounded-2xl bg-linear-135 from-accent to-accent-2 text-lg font-bold text-white"
      >
        {initials}
      </span>

      <h2 className="mt-3.5 text-xl font-semibold tracking-tight">
        {text(name, locale)}
      </h2>
      <p className="mt-0.5 text-[13px] font-semibold text-accent">{role}</p>
      <p className="text-xs text-muted">
        {org} · {text(location, locale)}
      </p>

      <ul className="mt-4 flex flex-col gap-1.5">
        {contacts.map((contact) => (
          <li key={contact.href}>
            <a
              href={contact.href}
              title={contact.label}
              // mailto: must open in place — a new tab is left behind empty
              // once the mail client takes over. Same rule as lib/links.
              target={contact.href.startsWith('mailto:') ? undefined : '_blank'}
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-2 rounded-full border border-edge bg-surface py-1 pr-3 pl-2.5 font-mono text-[11.5px] text-chip-ink transition hover:border-accent hover:text-ink"
            >
              <PlatformIcon platform={contact.platform} className="h-3.5 w-3.5" />
              <span className="truncate">{contact.value}</span>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  )
}
