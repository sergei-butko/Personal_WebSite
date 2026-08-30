import { footerLinks, linkRel, linkTarget } from '@/lib/links'
import { PlatformIcon } from '@/components/links/platform-icon'
import { profile } from '@/content/profile'

/**
 * The marks are monochrome — `currentColor` rather than each platform's brand
 * hue — because the footer carries four of them side by side on every page of
 * the site. Brand colours belong on the links page, where each card is the
 * subject; repeated in chrome they read as a toolbar. Colour is left to say
 * one thing here: hover.
 *
 * The mark alone is the whole link, so the label has to reach a screen reader
 * some other way. `PlatformIcon` renders its `<svg>` `aria-hidden`, which
 * takes its `<title>` out of the tree with it — hence `aria-label` on the
 * anchor. `title` is for the sighted hover.
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
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-muted">
        <p>
          &copy; {new Date().getFullYear()} {profile.name}
        </p>
        <ul className="flex flex-wrap items-center gap-5">
          {footerLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target={linkTarget(link)}
                rel={linkRel(link)}
                aria-label={link.label}
                title={link.handle ?? link.label}
                className="block text-muted transition hover:text-ink"
              >
                <PlatformIcon
                  platform={link.platform}
                  forceColor="currentColor"
                  className="h-5 w-5"
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
