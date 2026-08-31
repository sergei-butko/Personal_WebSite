import { localePath, type Locale } from '@/lib/i18n'
import type { ViewTab } from '@/components/ui/view-switch'

/**
 * The perfumery page's two views.
 *
 * In lib/ rather than in either page, because both need it and a page
 * importing from another page is how a route ends up with a circular import —
 * and Next gives no warning until the build folds in on itself.
 *
 * `ViewTab` is a type-only import, which the lib/ boundary rule allows: this
 * describes the shape the component takes, it does not pull the component in.
 */
export function perfumeryTabs(
  locale: Locale,
  labels: { posts: string; shelf: string }
): ViewTab[] {
  return [
    { view: 'posts', href: localePath(locale, 'perfumery'), label: labels.posts },
    {
      view: 'shelf',
      href: localePath(locale, 'perfumery/shelf'),
      label: labels.shelf,
    },
  ]
}
