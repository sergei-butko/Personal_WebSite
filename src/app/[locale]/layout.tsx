import { notFound } from 'next/navigation'
import { locales, isLocale, type Locale } from '@/lib/i18n'
import { getDictionary } from '@/content/i18n'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const typed: Locale = locale
  const dict = getDictionary(typed)

  return (
    <div lang={typed} className="flex min-h-dvh flex-col">
      <Header locale={typed} dict={dict} />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  )
}
