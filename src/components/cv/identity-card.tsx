import type { Locale } from '@/lib/i18n'
import { type CvContact, type CvPortrait, type LocalizedText, text } from '@/lib/cv'
import { PlatformIcon } from '@/components/links/platform-icon'
import { Card } from '@/components/ui/card'
import { CloudinaryImage } from '@/components/ui/cloudinary-image'

/**
 * Who this is, and how to reach him — the top of the sticky rail.
 *
 * The contact pills carry their brand mark and stack vertically rather than
 * wrapping into a row. Both reasons are the same one: the LinkedIn and GitHub
 * handles are the identical string, so the mark is the only thing that says
 * where a pill goes, and a wrapped row hides it at the start of the second
 * line as often as not.
 *
 * The portrait keeps the monogram's square-with-rounded-corners rather than
 * becoming a circle, so the tile reads as the same object the About card on the
 * home page already is — and falls back to the monogram outright when there is
 * no photograph configured.
 */
export function IdentityCard({
  name,
  initials,
  role,
  org,
  location,
  contacts,
  portrait,
  locale,
}: {
  name: LocalizedText
  initials: string
  role: string
  org: string
  location: LocalizedText
  contacts: CvContact[]
  portrait?: CvPortrait
  locale: Locale
}) {
  return (
    <Card as="section" featured>
      {portrait ? (
        <span className="block h-16 w-16 overflow-hidden rounded-2xl border border-edge">
          <CloudinaryImage
            asset={portrait}
            // Empty on purpose: the name sits directly beneath, so describing
            // the portrait would have a screen reader announce him twice. Same
            // call the header's monogram makes.
            alt=""
            sizes="64px"
            priority
            className="h-full w-full object-cover"
          />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="grid h-16 w-16 place-items-center rounded-2xl bg-linear-135 from-accent to-accent-2 text-lg font-bold text-white"
        >
          {initials}
        </span>
      )}

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
