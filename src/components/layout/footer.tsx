import { footerLinks, linkRel, linkTarget } from '@/lib/links'
import { PlatformIcon } from '@/components/links/platform-icon'
import { profile } from '@/content/profile'

/**
 * The marks are monochrome — `currentColor` rather than each platform's brand
 * hue — because the footer carries five of them side by side on every page of
 * the site. Brand colours belong on the links page, where each card is the
 * subject; repeated in chrome they read as a toolbar. Colour is left to say
 * one thing here: hover.
 *
 * Each mark is named. A row of bare glyphs asks a reader to recognise five
 * silhouettes at 16px, and two of them — Threads and X — are close enough at
 * that size to be each other; the mail envelope is not a brand at all. The
 * names also make the accessible name visible rather than hidden in an
 * `aria-label`, which is what WCAG 2.5.3 asks for and what let the earlier
 * version drift: nothing on screen said what the anchor announced.
 *
 * `title` is still the sighted hover, and it carries the handle where there is
 * one — the label says Telegram, the tooltip says which account.
 */
export function Footer() {
  /*
   * No top margin. The page container sets the gap on every other side with its
   * own padding, and `mt-16` here made the space below the last card three
   * times the space above the first — visible on the home page, where the bento
   * grid sits between the two. The layout's flex-1 on the content still pushes
   * this to the bottom of a short page, which is what the margin was mistaken
   * for.
   */
  return (
    <footer className="border-t border-edge">
      {/*
       * Named links are wider than glyphs, so the row no longer fits a phone.
       * It stacks there — copyright above, links below, both centred — rather
       * than leaving `justify-between` to push two ragged lines apart. From sm
       * up it is the single row it always was.
       */}
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-5 py-8 text-sm text-muted sm:flex-row sm:justify-between sm:gap-4">
        <p>
          &copy; {new Date().getFullYear()} {profile.name}
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
          {footerLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target={linkTarget(link)}
                rel={linkRel(link)}
                title={link.handle ?? link.label}
                className="flex items-center gap-1.5 text-muted transition hover:text-ink"
              >
                <PlatformIcon
                  platform={link.platform}
                  forceColor="currentColor"
                  className="h-4 w-4"
                />
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
