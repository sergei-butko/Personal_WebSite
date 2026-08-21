export function Chip({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-chip px-2.5 py-0.5 text-[11px] font-medium text-chip-ink">
      {children}
    </span>
  )
}

export function Eyebrow({ children }: { children: string }) {
  return (
    <p className="mb-2.5 font-mono text-[10.5px] font-semibold tracking-[0.1em] text-muted uppercase">
      {children}
    </p>
  )
}
