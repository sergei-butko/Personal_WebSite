import { notFound } from 'next/navigation'
import { isLocale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { PlaceholderPage } from '@/components/layout/placeholder-page'

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dict = getDictionary(locale)

  return (
    <PlaceholderPage
      title={dict.about.title}
      intro={dict.about.intro}
      body={dict.common.placeholder}
    />
  )
}
