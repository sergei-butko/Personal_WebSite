import { Container, PageHeading } from '@/components/layout/container'

/**
 * A route that exists so the nav and the URL work, with nothing written in it
 * yet. About, CV and Projects were three byte-identical files before this.
 *
 * Not a permanent abstraction — when a page gets real content it stops using
 * this, and when the last one does, delete the file.
 */
export function PlaceholderPage({
  title,
  intro,
  body,
}: {
  title: string
  intro: string
  body: string
}) {
  return (
    <Container>
      <PageHeading title={title} intro={intro} />
      <p className="rounded-[var(--radius-card)] border border-dashed border-edge p-6 text-sm text-muted">
        {body}
      </p>
    </Container>
  )
}
