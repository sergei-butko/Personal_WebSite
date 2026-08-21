import { isLocale } from '@/lib/i18n'
import { notFound } from 'next/navigation'
import { getDictionary } from '@/content/i18n'
import { Container, PageHeading } from '@/components/layout/container'

export default async function CvPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDictionary(locale)

  return (
    <Container>
      <PageHeading title={dict.cv.title} intro={dict.cv.intro} />
      <p className="rounded-[var(--radius-card)] border border-dashed border-edge p-6 text-sm text-muted">
        {dict.common.placeholder}
      </p>
    </Container>
  )
}
