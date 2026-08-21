/**
 * The small mono uppercase label above a card or a section.
 *
 * This treatment was hand-written at four call sites and had already drifted —
 * three different margins and two different colours — which is the same failure
 * the "design tokens only" rule exists to prevent, applied to type rather than
 * colour. Spacing stays a prop because it genuinely differs per context; the
 * type treatment does not.
 */
export function Eyebrow({
  children,
  tone = 'muted',
  className = 'mb-2.5',
}: {
  children: string
  /** `accent` marks a state worth noticing — a draft, for instance. */
  tone?: 'muted' | 'accent'
  /** Spacing for this context. Replaces the default rather than adding to it. */
  className?: string
}) {
  const colour = tone === 'accent' ? 'text-accent' : 'text-muted'
  return (
    <p
      className={`${className} font-mono text-[10.5px] font-semibold tracking-[0.1em] ${colour} uppercase`}
    >
      {children}
    </p>
  )
}
