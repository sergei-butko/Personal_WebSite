import type { Locale } from '@/lib/i18n'
import { type CvRole, text } from '@/lib/cv'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'

/**
 * The career as a dated spine.
 *
 * Only the current role gets a surface. Six cards would flatten the hierarchy
 * — a lift that everything has stops meaning anything — so the other five sit
 * flat on the line and the one that matters is the one that is raised.
 *
 * That costs a small alignment problem: a card's padding pushes its first line
 * about 20px down, so the node and the connecting line have to move with it or
 * the dot lands on the card's top border instead of beside the "Now" badge.
 * Hence the two offsets below rather than one.
 */
function Node({ current, last }: { current: boolean; last: boolean }) {
  return (
    <>
      {/* The line down to the next role. The last entry has nothing to join. */}
      {last ? null : (
        <span
          aria-hidden="true"
          className={`absolute bottom-0 left-[4.5px] w-px bg-edge ${current ? 'top-[38px]' : 'top-2'}`}
        />
      )}
      <span
        aria-hidden="true"
        className={[
          'absolute left-0 h-2.5 w-2.5 rounded-full border-[1.5px]',
          current
            ? 'top-[25px] border-accent bg-accent ring-3 ring-accent/20'
            : 'top-1.5 border-edge bg-canvas',
        ].join(' ')}
      />
    </>
  )
}

function Body({ role, concurrentLabel }: { role: CvRole; concurrentLabel: string }) {
  return (
    <>
      {role.concurrent ? (
        <span className="mt-2 inline-flex border-l-2 border-accent pl-2 font-mono text-[10px] tracking-[0.07em] text-accent uppercase">
          {concurrentLabel}
        </span>
      ) : null}

      {role.bullets.length > 0 ? (
        <ul className="mt-2">
          {role.bullets.map((bullet) => (
            <li key={bullet.text} className="relative mt-1 pl-4 text-[13.5px] text-muted">
              <span
                aria-hidden="true"
                className="absolute top-[0.62em] left-0 h-px w-[5px] bg-edge"
              />
              {bullet.lead ? (
                <>
                  <strong className="font-semibold text-ink">{bullet.lead}</strong>
                  {' — '}
                </>
              ) : null}
              {bullet.text}
            </li>
          ))}
        </ul>
      ) : null}

      {role.stack.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {role.stack.map((tool) => (
            <Chip key={tool}>{tool}</Chip>
          ))}
        </div>
      ) : null}
    </>
  )
}

function Head({
  role,
  locale,
  nowLabel,
}: {
  role: CvRole
  locale: Locale
  nowLabel: string
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
      <div className="min-w-0">
        {role.current ? (
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] font-semibold tracking-[0.1em] text-accent uppercase">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-accent ring-3 ring-accent/20"
            />
            {nowLabel}
          </span>
        ) : null}
        <h3
          className={`text-[15px] font-semibold tracking-tight ${role.current ? 'mt-1.5' : ''}`}
        >
          {role.title}
        </h3>
        <p className="mt-px text-xs text-muted">{text(role.org, locale)}</p>
      </div>
      <span className="font-mono text-[11.5px] tabular-nums text-muted">
        {text(role.from, locale)} — {text(role.to, locale)} · {text(role.span, locale)}
      </span>
    </div>
  )
}

export function ExperienceTimeline({
  roles,
  locale,
  nowLabel,
  concurrentLabel,
}: {
  roles: CvRole[]
  locale: Locale
  nowLabel: string
  concurrentLabel: string
}) {
  return (
    <ol className="pt-3">
      {roles.map((role, index) => {
        const last = index === roles.length - 1
        const inner = (
          <>
            <Head role={role} locale={locale} nowLabel={nowLabel} />
            <Body role={role} concurrentLabel={concurrentLabel} />
          </>
        )

        return (
          <li
            key={`${role.title}-${text(role.from, locale)}`}
            className={`relative pl-6 ${role.current ? 'pb-6' : 'pb-5'}`}
          >
            <Node current={role.current} last={last} />
            {role.current ? (
              <Card as="article" featured>
                {inner}
              </Card>
            ) : (
              <article>{inner}</article>
            )}
          </li>
        )
      })}
    </ol>
  )
}
