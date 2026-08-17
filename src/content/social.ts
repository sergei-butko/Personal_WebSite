import type { SocialLink } from '@/lib/types'

// TODO(serhii): verify — real handles needed for Threads and Telegram.
export const socialLinks: SocialLink[] = [
  {
    platform: 'threads',
    label: 'Threads',
    href: 'https://www.threads.net/',
    primary: true,
  },
  { platform: 'telegram', label: 'Telegram', href: 'https://t.me/', primary: true },
  { platform: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/' },
  {
    platform: 'github',
    label: 'GitHub',
    href: 'https://github.com/sergei-butko',
    primary: true,
  },
  { platform: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/' },
  { platform: 'x', label: 'X', href: 'https://x.com/' },
  {
    platform: 'email',
    label: 'Email',
    href: 'mailto:sergei.butko24@gmail.com',
    primary: true,
  },
]
