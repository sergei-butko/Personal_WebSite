import type { CSSProperties, ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  /** Tailwind col/row span classes, e.g. "sm:col-span-2 lg:col-span-3". */
  className?: string
  /** Adds the subtle accent wash used by the hero tile. */
  featured?: boolean
  as?: 'div' | 'article' | 'section'
  /**
   * Inline custom properties, for a value that comes from content rather than
   * from the source — the CV's stack tiles carry their grid span this way,
   * because a Tailwind span utility has to be a literal to be emitted at all.
   */
  style?: CSSProperties
}

export function Card({
  children,
  className = '',
  featured = false,
  as = 'div',
  style,
}: CardProps) {
  const Tag = as
  return (
    <Tag
      style={style}
      className={[
        'group min-w-0 rounded-[var(--radius-card)] border border-edge p-5',
        'transition duration-200 hover:-translate-y-0.5 hover:border-accent',
        'hover:shadow-[0_12px_34px_-14px_rgba(99,102,241,0.4)]',
        'motion-reduce:hover:translate-y-0',
        featured
          ? 'bg-linear-145 from-accent/12 via-surface via-60% to-surface'
          : 'bg-surface',
        className,
      ].join(' ')}
    >
      {children}
    </Tag>
  )
}
