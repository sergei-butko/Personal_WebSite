import { footerLinks, linkRel, linkTarget } from '@/lib/links'
import { PlatformIcon } from '@/components/links/platform-icon'
import { profile } from '@/content/profile'
import { withBase } from '@/lib/paths'

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
       * Three blocks on one line: wordmark, copyright, links.
       *
       * Named links are wider than glyphs, so the row does not fit a phone. It
       * stacks below sm — the three centred, in order — rather than leaving
       * `justify-between` to push ragged lines apart.
       *
       * `flex-wrap` is not decoration. Between the sm breakpoint and about
       * 740px the row is in play but too narrow to hold both groups: the
       * copyright will not shrink (whitespace-nowrap) and the links have
       * already wrapped to two rows, so `justify-between` pushed them straight
       * through each other — measured overlapping at 700px and below. Wrapping
       * drops the links to their own line instead, which is what the stacked
       * layout does anyway, one breakpoint down.
       */}
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-5 py-8 text-sm text-muted sm:flex-row sm:flex-wrap sm:justify-between sm:gap-x-4 sm:gap-y-3">
        <div className="flex flex-col items-center gap-2.5 sm:flex-row sm:gap-4">
          {/*
           * The wordmark, from Cloudinary's `public/full` — see public/README.md.
           *
           * Decorative, like the header's monogram: it spells out the same name
           * the copyright beside it already carries, so giving it alt text
           * would say it twice.
           */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={withBase('/logo-wordmark.png')}
            alt=""
            width={400}
            height={144}
            decoding="async"
            className="h-11 w-auto shrink-0"
          />
          {/*
           * Sits beside the wordmark rather than under it, which is what puts
           * all three blocks on one line. `whitespace-nowrap` because "© 2026
           * Serhii Butko" breaking across two lines next to a logo reads as a
           * mistake, and there is room for it at every width that keeps the row.
           */}
          <p className="whitespace-nowrap">
            &copy; {new Date().getFullYear()} {profile.name}
          </p>
        </div>
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
