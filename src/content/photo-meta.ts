import type { PhotoOverride } from '@/lib/photos'

/**
 * Hand-written overrides, keyed by Telegram message id.
 *
 * The sync never touches this file. Add an entry when you want a caption in
 * both languages, real alt text, or a photo hidden.
 *
 * Alt text matters more here than anywhere else on the site: most posts in
 * the channel have no caption, so without an entry a screen reader gets only
 * a generic label. Worth filling in for anything you care about.
 */
export const photoOverrides: Record<number, PhotoOverride> = {
  // 547: {
  //   caption: { en: 'Morning, Podil', uk: 'Ранок, Поділ' },
  //   alt: { en: 'Empty street in low sun', uk: 'Порожня вулиця на низькому сонці' },
  // },
  // 512: { hidden: true },
}
