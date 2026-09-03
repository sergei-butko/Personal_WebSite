import { Card } from '@/components/ui/card'
import { Eyebrow } from '@/components/ui/eyebrow'

/**
 * The foot of the rail: the same CV on one A4 page, and the profile it was
 * assembled from.
 *
 * `resumeUrl` is null until the PDF has been uploaded — `npm run cv:upload` —
 * and in that state the tile renders without its download button rather than
 * offering a link that 404s. A dead download is worse than an absent one:
 * nothing on the page would say which it was.
 */
export function ResumeCard({
  label,
  note,
  downloadLabel,
  resumeUrl,
  profileLabel,
  profileHref,
}: {
  label: string
  note: string
  downloadLabel: string
  resumeUrl: string | null
  profileLabel: string
  profileHref: string
}) {
  const button =
    'inline-flex items-center justify-center rounded-full px-4 py-2 text-[12.5px] font-medium transition'

  return (
    <Card as="section" className="flex flex-col gap-2">
      <Eyebrow className="mb-0">{label}</Eyebrow>
      <p className="mb-1 text-xs text-muted">{note}</p>

      {resumeUrl ? (
        <a
          href={resumeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${button} bg-accent text-white hover:brightness-110`}
        >
          {downloadLabel}
        </a>
      ) : null}

      <a
        href={profileHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`${button} border border-edge bg-surface hover:border-accent`}
      >
        {profileLabel}
      </a>
    </Card>
  )
}
