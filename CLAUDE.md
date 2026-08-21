# CLAUDE.md

Context for Claude Code working in this repo. Read before making changes.

## What this is

Serhii Butko's personal site. **A perfumery blog is the centre of it** — not a CV.
Priority order, and the home page must reflect it:

1. Perfumery writing (long-form: reformulations, batch archaeology, perfumer craft)
2. Photography (mirror of the Telegram channel)
3. Engineering identity (CV, projects) — present and credible, but never leading

Live: https://sergei-butko.github.io/Personal_WebSite/

## Stack

Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 · Node 22.
Static export (`output: 'export'`) to GitHub Pages via Actions.

## Non-negotiable constraints

**Static export means no server, ever.** No middleware, no redirects, no rewrites,
no Server Actions, no route handlers reading the request, no ISR, no
`next/image` optimisation. If a solution needs a server, it is the wrong
solution here — do the work at build time instead.

**`basePath` is `/Personal_WebSite`.** It comes from `NEXT_PUBLIC_BASE_PATH`, set in
`deploy.yml`. `next/link` and `next/image` prefix it automatically; **raw `<a href>`,
`<img src>`, and anything touching `window.location` do not** — those must go through
`withBase()` in `src/lib/paths.ts`. This is the single easiest way to ship a broken
link here. Moving to a custom domain = set that env var to `''` plus a `CNAME`; no
code changes.

**Bilingual EN + UK.** One route tree under `app/[locale]/` with
`generateStaticParams()`. `/` is a client-side locale detector because static export
cannot redirect. `uk.ts` is typed against `en.ts`, so a missing key is a compile
error rather than English leaking into the Ukrainian site.

## Layering

```
content/     data + MDX — the only files Serhii edits by hand
lib/         types, i18n, pure logic
components/ui        dumb primitives (Card, BentoGrid, Chip)
components/sections  composed, content-aware
app/         routing + metadata only
```

Components never import from `content/` — pages pass data down. Keep it that way.

## Conventions

- **Design tokens only.** Colour, radius, and fonts live in the `@theme` block in
  `src/app/globals.css`; the dark palette is the `.dark` block below it. Never
  hardcode a colour in a component.
- **Visual direction is "Bento"** — asymmetric card mosaic, indigo/violet accent.
- **One typeface: IBM Plex Sans + Plex Mono**, self-hosted via Fontsource. Mono only
  where columns must align (code, diagrams, tabular metadata). No third-party request
  from visitors and no build-time network dependency — do not switch to
  `next/font/google`. There is no serif; don't reintroduce one.
- **No client state library.** URL plus server data covers everything here.
- `'use client'` only where genuinely needed: theme toggle, locale switcher, locale
  detector. Everything else is a Server Component.
- Conventional Commits. Work on `feat/*` branches via PR; **Serhii approves every
  merge to `main`.**
- **Invented content ships as `draft: true`, not just a `TODO` comment.** MDX comments
  are invisible to readers; five fabricated first-person articles once reached
  production because the only safeguard was a comment. Frontmatter is enforced by the
  build. Placeholder prose also keeps `TODO(serhii): verify`.
- **Run scripts before shipping them.** Typecheck and build do not execute anything.
  Two shipped scripts failed on first run — top-level await in a CJS transpile, and a
  non-JSON API response. Both would have been caught by running them once.

## Gotchas already paid for

- **GitHub Pages must be enabled manually** (Settings → Pages → Source: GitHub
  Actions). `configure-pages` can self-enable but only with a PAT stored as a secret
  — not worth it. If deploy fails with `Get Pages site failed`, this is why.
- **Keep Actions versions current.** `upload-pages-artifact@v3` depends on the retired
  v3 artifact actions and hard-fails. Currently on checkout v7, setup-node v7,
  configure-pages v6, upload-pages-artifact v5, deploy-pages v5.
- **Threads cannot be scraped** — `robots.txt` disallows it and it violates Meta's
  ToS. The mirror uses the official API (`threads_basic`). Blog posts are authored
  here as MDX; the site is canonical and Serhii cross-posts outward.
- **Generated data files are committed, not gitignored** (`threads.generated.ts`,
  `photos.generated.ts`). A failed sync then stops new content appearing instead
  of breaking the build. Preserve this property.
- **Image bytes are never committed.** They live in Cloudinary; the repo holds
  only public ids. `/public/images/` is gitignored. The first version of the
  photo sync keyed filenames on `sha1(<telegram CDN url>)` — those URLs are
  signed and rotate per fetch, so the cache never hit, every run re-encoded the
  whole channel under new names, and nothing was deleted: 402 photos became
  10,377 files and 827 MB across thirteen runs. **Any re-hosting key must derive
  from a stable source id**, which is why public ids are `<postId>-<slot>`.
  See `docs/RUNBOOK-CLOUDINARY.md`.

## State

Shipped: bilingual skeleton, light/dark, bento home, CI + Pages deploy, Threads
mirror (dormant until `THREADS_ACCESS_TOKEN` is set — see `docs/SETUP-THREADS.md`).

Placeholder routes awaiting content: `/blog`, `/photos`, `/about`, `/cv`, `/projects`.

**Shipped since:** MDX blog (zod frontmatter, tag pages, fragrance card), Threads
mirror, single-typeface pass. Seed posts are all `draft: true` and unverified —
they are fabricated placeholder prose, not Serhii's writing.

**Superseded — the original Phase 3 note, kept for context:** MDX pipeline (`remark-gfm`, `rehype-slug`,
`rehype-autolink-headings`, `shiki`), zod-validated frontmatter so a malformed post
fails the build, post index with tag filtering, post pages, a fragrance metadata card
(house, perfumer, concentration, year, batch code), seed posts in both languages.
Posts live at `content/posts/<slug>.<locale>.mdx`; a post existing in only one
language should appear in that locale and be absent from the other, not 404.

Then Phase 4 (Telegram photo mirror from `t.me/s/just_my_photos` — public, parseable,
captions mostly absent so alt text needs care), Phase 5 (CV/projects content),
Phase 6 (SEO, OG images, sitemap with hreflang, a11y and Lighthouse pass).

Pending Dependabot majors: **ESLint 10** and **TypeScript 7**. Take them one at a
time and verify each; don't fold them into feature work.

## Before you call anything done

`npm run typecheck && npm run lint && npm run format:check && npm run build`

The build must be run with `NEXT_PUBLIC_BASE_PATH=/Personal_WebSite` to match CI,
and `NEXT_PUBLIC_CLOUDINARY_CLOUD=<cloud>` once the photo snapshot is non-empty —
`lib/media.ts` throws rather than emitting empty `src` attributes.

Scripts must be **executed**, not just typechecked. `sync-threads.ts` passed
typecheck and build for weeks while failing at runtime on every scheduled run.
The full plan lives in Serhii's "Programming" project as `personal-website/plan.md`.
