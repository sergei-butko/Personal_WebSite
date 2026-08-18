import { primaryLinks } from '@/lib/links'
import { profile } from '@/content/profile'

export function Footer() {
  return (
    <footer className="mt-16 border-t border-edge">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-muted">
        <p>
          &copy; {new Date().getFullYear()} {profile.name}
        </p>
        <ul className="flex flex-wrap gap-4">
          {primaryLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel={`${link.identity ? 'me ' : ''}noopener noreferrer`.trim()}
                className="transition hover:text-ink"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
