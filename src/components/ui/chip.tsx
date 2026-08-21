export function Chip({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-chip px-2.5 py-0.5 text-[11px] font-medium text-chip-ink">
      {children}
    </span>
  )
}
