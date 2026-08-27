import type { ReactNode } from 'react'

export function Container({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-5xl px-5 py-8">{children}</div>
}

/**
 * A page's title, with two optional companions.
 *
 * `intro` is optional because a standfirst is not always worth its space. The
 * photos page carried "Mirrored from my Telegram channel" above the mirror
 * itself — a line that explained what the page below it already showed, and
 * pushed the pictures down to make room for saying so.
 *
 * `action` is the page's one outward link, kept on the heading row rather than
 * in the body so it does not compete with whatever the page is actually for.
 */
export function PageHeading({
  title,
  intro,
  action,
}: {
  title: string
  intro?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {intro ? <p className="mt-2 text-muted">{intro}</p> : null}
      </div>
      {action}
    </div>
  )
}
