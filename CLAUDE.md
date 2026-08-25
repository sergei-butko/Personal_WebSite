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
cannot redirect.

**There are two root layouts, not one, and that is deliberate.** `<html lang>` has
to be the real locale, and a shared `app/layout.tsx` has no params, so it can only
emit a bare `<html>` — which is what shipped for months. `app/[locale]/layout.tsx`
and `app/(detect)/layout.tsx` each render their own `<html>`, which is why the font
and `globals.css` imports appear in both, and a third time in `not-found.tsx`.
Next renders the global 404 in a shell of its own that we cannot set `lang` on;
adding an `<html>` there nests two of them. Do not try to merge these back into one
root layout without checking what happens to `lang` and to the 404's stylesheet. `uk.ts` is typed against `en.ts`, so a missing key is a compile
error rather than English leaking into the Ukrainian site.

## Layering

Grouped by domain one level deep, following the layout Vercel uses in its own
open repos (`vercel/commerce`, `vercel/chatbot`): `app/` + `components/` +
`lib/`, no `features/`, no `shared/`, no re-export barrels.

```
src/
  app/         routing + metadata only. Every folder with a page.tsx is a URL.
  components/  blog/ photos/ threads/ links/ layout/ ui/
  lib/         blog/ photos/ threads/ links/ + i18n, media, paths, types
  content/     data + MDX — the only files Serhii edits by hand
```

Dependencies point one way: `app/ -> components/ -> lib/ -> content/`.

- `lib/` never imports a component value. A type is fine — `lib/blog/mdx.ts`
  needs the `MDXComponents` shape.
- `components/` never import `content/`; they take props. **One exception:**
  `components/layout/` is site chrome, instantiated once by the locale layout
  and reusable by nobody, so `header.tsx` and `footer.tsx` read
  `@/content/profile` directly. `vercel/commerce` does the same — its
  `footer.tsx` fetches its own menu.
- `content/` may name a type to describe its own shape, never import a value.

**Enforced in `eslint.config.mjs`, not by hand.** The prose version of the
components rule sat in this file for months while `header.tsx` and `footer.tsx`
both broke it. If you add a layer, add its zone there — and write a deliberately
wrong import to confirm the rule fires, because a misconfigured zone passes
silently and looks exactly like a clean codebase.

**Naming:** kebab-case filenames, PascalCase exports (`post-card.tsx` exports
`PostCard`) — the Vercel convention, and it sidesteps case-only renames on
macOS's case-insensitive filesystem. Same-folder siblings import relatively
(`./post-card`); everything else uses `@/`.

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
- **Generated snapshots live in Cloudinary, not in git.** `data/photos.json`,
  `data/photo-hashes.json` and `data/threads.json` are `raw` assets written by
  the syncs and fetched at build time by `src/lib/snapshot.ts`. They used to be
  committed `.ts` files, so that a failed sync stopped new content appearing
  rather than breaking the build. That property is **gone on purpose**: the
  syncs now produce no commits, and the price is that the build fails when
  Cloudinary is unreachable. It fails loudly, the same way `lib/media.ts` does
  for a missing cloud name — a green build with an empty gallery is the worse
  outcome. A 404 on a snapshot is not an error; it means that sync has never
  run, and the page renders its unsynced state.
- **Image bytes are never committed.** They live in Cloudinary; the repo holds
  only public ids. `/public/images/` is gitignored. The first version of the
  photo sync keyed filenames on `sha1(<telegram CDN url>)` — those URLs are
  signed and rotate per fetch, so the cache never hit, every run re-encoded the
  whole channel under new names, and nothing was deleted: 402 photos became
  10,377 files and 827 MB across thirteen runs. **Any re-hosting key must derive
  from a stable source id**, which is why public ids are `<postId>-<slot>`.
  See `docs/RUNBOOK-CLOUDINARY.md`.
- **Both syncs are manual only** (`workflow_dispatch`). No schedules, no
  `chore: sync` commits — a run uploads to Cloudinary and then dispatches
  `deploy.yml` itself, because with nothing pushed there is no push event to
  trigger a deploy. `refresh-threads-token.yml` stays on its weekly schedule:
  it touches no content, and a Threads token that misses its 60-day window dies
  permanently.

- **Cloudinary raw delivery is eventually consistent.** An overwrite took ~4s
  to become visible on this account, and a `?v=<now>` cache-buster does not
  defeat it — a deleted asset was still served from cache. Two consequences,
  both handled, neither obvious: `scripts/cloudinary.ts` does not report a sync
  finished until the CDN serves the new bytes (otherwise the deploy it
  dispatches builds the previous snapshot), and the Worker reads through the
  Admin API for a version-pinned URL (otherwise its read-modify-write silently
  destroys whatever it could not see). Never trust a plain raw URL for
  read-after-write.

- **Sync caps must not silently truncate.** `SYNC_MAX_PHOTOS` defaulted to 400
  against a larger channel; the walk is newest-first, so it dropped the oldest
  27 photos and reported it in a console warning nobody read. No photo cap
  now, and hitting the page guard is a hard failure rather than a truncated
  snapshot. If a limit ever bounds output, it fails or it is impossible to
  miss — never a warning.
- **Images are deduplicated by content hash** (sha256 of the bytes), mapped in
  `data/photo-hashes.json` in Cloudinary. Never by URL — signed URLs differ per
  fetch.
  `npm run test:dedup` pins the rule.

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
and `NEXT_PUBLIC_CLOUDINARY_CLOUD=<cloud>` **always** — the build fetches its
content snapshots from Cloudinary, so `lib/snapshot.ts` and `lib/media.ts` both
throw without it rather than emitting an empty gallery. A local build therefore
needs network access.

`.env` is not read by `next build` the way you might expect, and sourcing it in
a shell expands any `$` in the Cloudinary secret. Pass the cloud name
explicitly, or use `node --env-file=.env` for scripts (never for `next build` —
Turbopack workers reject `--env-file` in `NODE_OPTIONS`).

Also run `npm run test:telegram`, `npm run test:dedup` and `npm run test:admin`.

Scripts must be **executed**, not just typechecked. `sync-threads.ts` passed
typecheck and build for weeks while failing at runtime on every scheduled run.
The full plan lives in Serhii's "Programming" project as `personal-website/plan.md`.
