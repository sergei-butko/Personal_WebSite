import type { ReactNode } from 'react'

export function Container({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-5xl px-5 py-8">{children}</div>
}

export function PageHeading({ title, intro }: { title: string; intro: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted">{intro}</p>
    </div>
  )
}
