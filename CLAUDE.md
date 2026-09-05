# CLAUDE.md

Context for Claude Code working in this repo. Read before making changes.

## What this is

Serhii Butko's personal site. **The perfumery writing is the centre of it** — not
a CV. Priority order, which the home page reflects:

1. Perfumery writing (long-form MDX: reformulations, batch archaeology, craft)
2. Photography (mirror of the Telegram channel `@just_my_photos`)
3. Engineering identity (CV, projects) — present and credible, never leading

Live: https://sergei-butko.github.io/Personal_WebSite/ — a GitHub Pages **project
page**, hence the `/Personal_WebSite` prefix on every URL.

Bilingual English + Ukrainian, one route tree, both languages fully generated.

## Stack

Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 · Node 24
(`.nvmrc`) · zod for every content contract · MDX for posts · Cloudinary for all
media and generated data.

Static export (`output: 'export'`, `trailingSlash: true`) published to GitHub
Pages by Actions. Prettier: no semicolons, single quotes, 90 columns.

## The constraints that shape every decision

**Static export means no server, ever.** No middleware, no redirects, no
rewrites, no Server Actions, no route handlers, no ISR, no `next/image`
optimisation. If a solution needs a server it is the wrong solution here — do
the work at build time instead. `/` is a client-side locale detector
(`app/(detect)/`) precisely because a static host cannot redirect.

**The one thing that is not frozen at build time is snapshot content.** The
perfumery and photo views render the snapshot the build fetched — so the HTML
is complete, indexable and works without JavaScript — and then re-read it in
the browser through `lib/live-snapshot.ts`, replacing what they show if
Cloudinary holds something newer. That is what makes `npm run content:push` the
whole procedure for a content edit instead of push-then-deploy. It is a refresh
on top of a real prerender, NOT a client-side-only page: delete the build-time
fetch and the pages lose their content to search engines and to anyone without
JavaScript.

**`basePath` is `/Personal_WebSite`,** from `NEXT_PUBLIC_BASE_PATH`, set in
`deploy.yml` and `ci.yml`. `next/link` and `next/image` prefix it automatically;
**raw `<a href>`, `<img src>`, and anything touching `window.location` do not** —
those go through `withBase()` in `src/lib/paths.ts`. This is the single easiest
way to ship a broken link here. Moving to a custom domain = set that var to `''`
plus a `CNAME` in `public/`; no code changes.

**There are two root layouts, not one, and that is deliberate.** `<html lang>`
must be the real locale, and a shared `app/layout.tsx` has no params, so it can
only emit a bare `<html>` — which is what shipped for months, announcing every
Ukrainian page in an English voice (WCAG 3.1.1). `app/[locale]/layout.tsx` and
`app/(detect)/layout.tsx` each render their own `<html>`, which is why the font
and `globals.css` imports appear in both, and a third time in `not-found.tsx`
(Next renders the global 404 in a shell of its own that cannot take a `lang`).
Do not merge these back into one root layout without checking what happens to
`lang` and to the 404's stylesheet.

**`uk.ts` is typed against `en.ts`,** so a missing key is a compile error rather
than English leaking into the Ukrainian site.

## Layering

Grouped by domain one level deep, the layout Vercel uses in its own open repos
(`vercel/commerce`, `vercel/chatbot`): `app/` + `components/` + `lib/`. No
`features/`, no `shared/`, no re-export barrels.

```
src/
  app/         routing + metadata only. A folder with page.tsx is a URL.
  components/  blog/ photos/ threads/ links/ layout/ ui/
  lib/         blog/ photos/ threads/ links/ + i18n, media, paths, snapshot, types
  content/     data + MDX — the only files Serhii edits by hand
```

Dependencies point one way: `app/ → components/ → lib/ → content/`.

- `lib/` never imports a component value. A type is fine — `lib/blog/mdx.ts`
  needs the `MDXComponents` shape.
- `components/` never import `content/`; they take props. **One exception:**
  `components/layout/` is site chrome, instantiated once by the locale layout and
  reusable by nobody, so `header.tsx` and `footer.tsx` read `@/content/profile`
  directly. `vercel/commerce` does the same with its footer.
- `content/` may name a type to describe its own shape, never import a value.

**Enforced in `eslint.config.mjs`, not by hand.** The prose version of the
components rule sat in this file for months while `header.tsx` and `footer.tsx`
both broke it. If you add a layer, add its zone there — and write a deliberately
wrong import to confirm the rule fires, because a misconfigured zone passes
silently and looks exactly like a clean codebase.

**Naming:** kebab-case filenames, PascalCase exports (`post-card.tsx` exports
`PostCard`) — sidesteps case-only renames on macOS. Same-folder siblings import
relatively (`./post-card`); everything else uses `@/`.

## Where the content actually lives

Three different stores, and the distinction matters:

| Content                           | Lives in                        | Edited by                      |
| --------------------------------- | ------------------------------- | ------------------------------ |
| Blog posts                        | `src/content/posts/*.mdx` (git) | Hand, in the repo              |
| UI strings, profile, links        | `src/content/` (git)            | Hand, in the repo              |
| Photo + Threads snapshots, images | **Cloudinary**                  | Sync workflows, then pull/push |

**Nothing generated is in git.** `data/photos.json`, `data/photo-hashes.json`
and `data/threads.json` are `raw` assets in Cloudinary, written by the sync
scripts and fetched at build time by `src/lib/snapshot.ts`. Image bytes are
Cloudinary assets; the repo holds only public ids. `/public/images/` and
`/content-local/` are gitignored.

They used to be committed `.ts` files, so a failed sync merely stopped new
content appearing rather than breaking the build. **That property is gone on
purpose:** the syncs now produce no commits, and the price is that the build
fails when Cloudinary is unreachable. It fails loudly, the same way
`lib/media.ts` does for a missing cloud name — a green build with an empty
gallery is the worse outcome. A 404 on a snapshot is _not_ an error; it means
that sync has never run, and the page renders its unsynced state.

**The snapshots are canonical, not a mirror.** Every field of a `Photo` or a
`ThreadsPost` is editable and edits survive: a sync only appends items newer
than the newest already stored. Do not edit `timestamp` — it is the high-water
mark the next sync reads.

**Editing is local, not a CMS.** `npm run content:pull` writes the snapshots
into `content-local/`, you edit the JSON, `npm run content:push` validates and
uploads. Push refuses on two conditions, both already demonstrated to fire: the
edit failing the same zod schema the build uses, and Cloudinary having changed
since the pull — a whole-document write would otherwise delete whatever a sync
appended while the file sat open. A `/admin` editor plus a Cloudflare Worker,
and later a Netlify port, were built and then removed; the history has them.
Don't rebuild one without a reason that has changed.

## The two syncs

**Threads runs daily at 10:30 UTC; photos is manual only** (`workflow_dispatch`).
Both were manual for a while: they used to run every six hours and push
`chore: sync` commits to `main` — four pipeline runs a day against feeds nobody
is waiting on, for a `main` history made of bot commits. The schedule came back
for Threads once that cost was gone, because a run now commits nothing at all;
once a day is not four times, and `main` stays clean either way.

A run uploads to Cloudinary and then dispatches `deploy.yml` itself, because
with nothing pushed there is no push event to trigger a deploy. It dispatches
against the **default branch**, never the branch the run started from, so
syncing from a feature branch cannot publish that branch.

**`inputs` does not exist on a scheduled run,** and the deploy step used to be
gated on `inputs.deploy` directly. Left that way, every nightly sync would write
to Cloudinary and never rebuild the site — and it would not look broken, because
`lib/live-snapshot.ts` re-reads the snapshot in the browser, so the page would
show new posts while the prerendered HTML that search engines and no-JS visitors
get went quietly stale. `sync-threads.yml` computes `WANTS_DEPLOY` once at
workflow level for this reason. **Give `sync-telegram.yml` the same treatment
before putting it on a schedule.**

Cron is UTC and takes no timezone, so 10:30 UTC is 13:30 in Kyiv only while
Ukraine is on EEST; the run lands an hour earlier in local terms in winter.
There is no way to express a local time here — an hour of drift is the cheaper
answer. The `:30` is deliberate too: scheduled runs are best-effort and GitHub
queues them heavily on the hour.

**Photos** (`sync-telegram.ts`): reads `t.me/s/<channel>`, a plain public
preview page — no API key, no bot. Walks history backwards via `?before=`,
re-hosts each photo in Cloudinary, writes `data/photos.json`.

The walk stops a week past the cursor rather than reading the whole channel —
22 pages and 259 posts became one page and six, for the same answer. The week
is not slack: the channel posts a song seconds AFTER its album, so a run that
lands between the two must still see that album next time to pair them. Three
things need the whole channel and force it: `SYNC_REPAIR` (which reaches a 2019
photo), `SYNC_FORCE`, and `SYNC_FETCH_ALL=1`. That last one exists because the
full walk also drove the audio and caption backfills, both of which are
complete — a full walk today adds 0 songs and repairs 0 captions — but which
are the thing to re-run if either ever looks incomplete again. Parsing is
isolated in `telegram-parse.ts` and pinned by `npm run test:telegram` against a
saved fixture, so a Telegram markup change fails locally and loudly.
`SYNC_DRY_RUN=1` does everything except write, which is how the script gets run
before it ships without touching the live snapshot.

**The song under each post is half-scraped and half-bot, and that split is
forced.** The channel posts a track seconds after the album it belongs to, and
`pairAudio` binds each song to the post directly before it in message order —
sorted by id, not document order, so a pair straddling a `?before=` page still
matches. Title and artist come free off the preview page. **The file does not
exist there:** Telegram serves audio to nobody who is not logged in, on `/s/`
and on `?embed=1` alike. Don't go looking again — it was checked.

So `telegram-bot.ts` fetches the bytes with `TELEGRAM_BOT_TOKEN` +
`TELEGRAM_AUDIO_CHAT`, both optional. The Bot API has no "read message N of
channel C" either — updates expire after 24 hours — so it uses `forwardMessage`,
whose reply carries the `file_id`, then `getFile`, then deletes the forwarded
copy. Without the secrets the sync still records every track and the site
renders a card that links to Telegram; the player is what is missing, not the
song. Setup is in `docs/RUNBOOK-CLOUDINARY.md`.

The first sync with a token in place back-fills the whole archive, because every
existing row predates the feature. That is the **one** case where a sync edits a
row it has already captured; it only ever adds an absent `audio` field and never
overwrites one.

**Threads** (`sync-threads.ts`): the official Graph API with `threads_basic`.
**Threads cannot be scraped** — `robots.txt` disallows it and it violates Meta's
ToS. A perfumery review is posted there as a post plus a follow-up comment; the
sync joins the two into one post at capture time, and nothing downstream knows
there were ever two pieces.

It asks for posts `since` the cursor rather than pulling the whole feed to
decide nothing changed — 133 posts over three requests became one post over
two, and it stops growing with the archive. `since` is only a hint: the
client-side filter still decides what counts as new, and the request starts an
hour before the cursor so that a rounding difference at the server cannot drop
a post into a gap the cursor has already moved past. `THREADS_FETCH_ALL=1`
walks everything, for when you suspect a backdated post was missed and do not
want to touch `syncedThrough`.

**The fragrance a post reviews is named automatically too**, immediately after
the sync, in the same job. `scripts/name-fragrances.ts` (`npm run threads:name`)
asks Claude what bottle a post is about and writes only what two gates in
`scripts/fragrance-gates.ts` corroborate: the house and the scent must appear in
the post text — squashed of punctuation first, since a house is usually written
as `@handle` rather than prose — and a house LINE (`UNUM`, `Private Blend`) is
written only when this store already records that line for that house,
because a line is a fact about the house, not the post, and nothing in the
prose can confirm one the store has never seen. Either gate failing leaves the
row exactly as absent-fragrance has always meant: rendered as its picture
alone, with the model's guess printed in the run log for Serhii to apply by
hand. `npm run test:threads-name` pins both gates against fixtures quoted from
real posts, with no API call and no cost.

A wrong bottle is not a free mistake to correct: `fragrance` drives the shelf a
post files under, the card's title, and — because `npm run media:organise` now
also runs automatically, right after naming, in the same job — the Cloudinary
public ids of the post's pictures. So `media:organise` running daily is not
new; what changed is that a fresh fragrance is usually waiting for it every
time, where a hand-naming session used to be the only thing that fed it.

**When a gate holds a bottle back, `name-bottle.yml` is how it gets named** —
Actions → Name a bottle → Run workflow, three boxes (house, scent, line) and a
run that does everything else: `scripts/set-fragrance.ts` (`npm run
threads:set`) writes the row, then `media:organise` renames the pictures,
`media:verify` checks them and the deploy publishes. It is the same field
written the same way, so nothing downstream knows or cares which half of the
pair filled it in.

Two things about it are load-bearing. **The post defaults to the newest one
without a bottle**, because that is almost always the post that just synced and
hunting for an id to name it is the friction this exists to remove. And
**replacing a bottle that is already there needs `overwrite` ticked**, because
the expensive mistake is a mistyped id landing on a post that was already
right: `fragrance` drives the pictures' public ids, so a wrong write renames
real Cloudinary assets and costs a second rename and a second deploy to undo.
Refusing by default turns that from an incident into a message. The grounding
check still runs and still prints, but only as a warning — a person saying what
a bottle is outranks it, and 8 of the 96 rows named by hand would fail it — so
its real job here is to flag the shape a wrong id makes.

Both workflows take the **same `sync-threads` concurrency group**. They each
read `data/threads.json`, edit it and write the whole document back, so two
overlapping runs would have the second silently discard the first's work.

Every input reaches the script through `env:`, never interpolated into a
`run:` line. A `workflow_dispatch` input is arbitrary text and
`${{ inputs.brand }}` spliced into a shell command is the standard Actions
injection; `set-fragrance.ts` reads them from the environment for that reason
alone. Do not "simplify" it into flags on the command line.

Naming is the optional layer: without an `ANTHROPIC_API_KEY` repository secret
the step announces the skip and every post keeps arriving unnamed, which
`media:organise` and the deploy gate both already treat as a normal outcome —
the sync does not fail over an enhancement it does not need in order to
publish. A per-post API error (a rate limit, a network blip) is caught the
same way: that one post is skipped and retried automatically tomorrow, rather
than the failure aborting the run and costing the day's real synced content its
organise/verify/deploy. `ANTHROPIC_WORKSPACE_ID` is read alongside the key only
because a workspace-scoped key needs it; a plain key ignores it.

`refresh-threads-token.yml` stays on its weekly schedule — it touches no content,
and a Threads long-lived token that misses its 60-day window dies **permanently**:
there is no grace period, and recovery means going back through Meta's auth flow
rather than running one command.

It self-skips unless `GH_SECRETS_PAT` is set — a fine-grained PAT scoped to this
repository with _Secrets: read and write_, because the built-in `GITHUB_TOKEN`
may not write secrets. **It is not set today, so every weekly run is a no-op
that reports success.** The fallback is that the daily Threads sync fails once
the token dies and GitHub emails about it; that is loud, but loud is not the
same as safe — by the time it fires the 60 days are already gone. Refreshing by
hand is `npm run threads:refresh -- <current token>`, then updating
`THREADS_ACCESS_TOKEN`.

This was the whole argument for putting Threads back on a schedule at all: with
both syncs manual, nothing touched the token between runs, so an expiry
announced itself only when someone happened to sync by hand.

## Gotchas already paid for

- **Any re-hosting key must derive from a stable source id.** The first photo
  sync keyed filenames on `sha1(<telegram CDN url>)` — those URLs are signed and
  rotate per fetch, so the cache never hit, every run re-encoded the whole
  channel under new names, and nothing was deleted: 402 photos became 10,377
  files and 827 MB across thirteen runs. Public ids are `<postId>-<slot>` now, so
  a re-upload replaces in place. **A Threads image ends up named after its
  bottle** (`threads/images/Tom_Ford-Oud_Wood-1`) — but not at upload time,
  because the fragrance is hand-written or model-proposed and does not exist
  yet when the sync itself runs. The sync still writes the id-shaped name;
  `npm run media:organise` renames it once a fragrance lands, whether that was
  `threads:name` a few seconds later in the same CI job or a hand edit through
  `content:push` weeks after. Do not try to move the rename into the sync.
- **A Cloudinary folder is not a public id prefix.** This cloud is in dynamic
  folder mode: `asset_folder` is what the Media Library groups by, `public_id`
  is what the delivery URL is built from, and they are independent. `rename`
  does not set the former and `upload` did not either — so 653 assets sat in the
  root of the Media Library for months while every id said `telegram/…`, and
  after the migration a newly synced post put two more back there. Uploads now
  derive it from the id (`placement` in `scripts/cloudinary.ts`);
  `uploader.explicit` is what repairs one after the fact. `api.update` does too, and is the wrong call:
  it is an Admin API request, the free plan allows 500 an hour, and a full
  `media:organise` touches 651 assets. Renaming changes delivery URLs, so a run
  is followed by a deploy — the published HTML is static and holds the old ids.
- **A hand upload through the Media Library is unreachable by default.** The
  console files an asset in the folder you pick but names it with a generated
  UUID unless you set the public id yourself — and delivery is by public id, so
  seven bottle photographs added on 2026-09-02 sat in `threads/images` under
  the right display names while every row pointing at them 404'd. Nothing
  caught it: `content:push` validates the SHAPE of a public id, and the build
  reads ids without asking whether they resolve. `npm run media:verify` is that
  missing check — run it after adding a picture by hand. Set the public id at
  upload time and it never arises.
- **A 404 on a derived URL is cached by the edge, and outlives the fix.** The
  site asks for `f_auto,q_auto,c_limit,w_{400,800,1200,1600}`; a request for one
  of those widths while the asset is absent caches the error against that exact
  derived URL, so the picture stays broken at one width after the asset is in
  place. `uploader.explicit` with `invalidate` is asynchronous and took longer
  than it was worth waiting for; renaming the asset out to a temp id and back
  clears it at once, because the edge keys the cached error on the version.
- **A delivery URL carries the asset's version, and must.** A public id here is
  POSITIONAL — `<Brand>-<Scent>-<n>`, n being the index — so reordering a post's
  pictures renames nothing; it swaps the bytes under two stable ids. Cloudinary
  serves images with `max-age=2592000`, so on 2026-09-02 four bottles were
  reordered, the store was right within seconds, and every browser that had
  already loaded the page kept the old order for up to thirty days. `version`
  is now a field on every image and song row, emitted as `/v<n>/` by
  `lib/media.ts`, so replaced bytes get a URL of their own. It is OPTIONAL: a
  row without one delivers the versionless URL, which still resolves. The syncs
  record it from the upload response and `media:organise` backfills it from the
  store — which is also the pass to run after replacing a picture by hand.
- **Deduplication is by sha256 of the bytes,** never by URL, mapped in
  `data/photo-hashes.json`. The rule is pure and pinned by `npm run test:dedup`.
- **A card's collage must fill its rectangle.** The by-post view sizes every
  card the same, so an album of one and an album of ten get the same media area
  — `lib/photos/collage.ts` decides the tiling and never emits more than six
  tiles, because seven and eight cannot tile a rectangle without a hole. A hole
  appears in one card out of two hundred and is invisible in a screenshot of the
  rest, so the rule is pinned by `npm run test:collage` rather than by looking.
  The tiles' images are `absolute inset-0`: as ordinary flow content their
  intrinsic height becomes the tile's minimum, the `1fr` rows grow past the
  container's aspect ratio, and cards holding portrait photos come out taller
  than cards holding landscape ones.
- **Cloudinary raw delivery is eventually consistent.** An overwrite took ~4s to
  become visible on this account, and a `?v=<now>` cache-buster does not defeat
  it — a deleted asset was still served from cache. So `scripts/cloudinary.ts`
  does not report a sync finished until the CDN actually serves the new bytes;
  otherwise the deploy it dispatches builds the previous snapshot. Never trust a
  plain raw URL for read-after-write.
- **Sync caps must not silently truncate.** `SYNC_MAX_PHOTOS` defaulted to 400
  against a larger channel; the walk is newest-first, so it dropped the oldest 27
  photos and said so only in a console warning nobody read. No photo cap now, and
  hitting the page guard is a hard failure. If a limit ever bounds output, it
  fails or it is impossible to miss — never a warning.
- **GitHub Pages must be enabled manually** (Settings → Pages → Source: GitHub
  Actions). If deploy fails with `Get Pages site failed`, this is why.
- **Keep Actions versions current.** `upload-pages-artifact@v3` depends on the
  retired v3 artifact actions and hard-fails. Currently checkout v7, setup-node
  v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5.

## Conventions

- **Design tokens only.** Colour, radius and fonts live in the `@theme` block in
  `src/app/globals.css`; the dark palette is the `.dark` block below it. Never
  hardcode a colour in a component. Contrast ratios in that file are measured,
  not eyeballed.
- **Visual direction is "Bento"** — asymmetric card mosaic, indigo/violet accent.
- **One typeface: IBM Plex Sans + Plex Mono,** self-hosted via Fontsource. Mono
  only where columns must align. No third-party request from visitors and no
  build-time network dependency — do not switch to `next/font/google`. There is
  no serif; don't reintroduce one.
- **The post body styling is hand-rolled `.prose`,** not
  `@tailwindcss/typography` — the plugin ships its own grey ramp, which would
  quietly become a second source of truth for the palette.
- **No client state library.** URL plus build-time data covers everything.
- `'use client'` only where genuinely needed: theme toggle, locale switcher,
  locale detector, photo lightbox. Everything else is a Server Component.
- **Prettier does not touch `src/content/posts`** — its MDX parser predates MDX
  v3 and rewrites `{/* … */}` into something that no longer compiles.
- Conventional Commits. Work on `feat/*` branches via PR; **Serhii approves every
  merge to `main`.**
- **Invented content ships as `draft: true`, not just a `TODO` comment.** MDX
  comments are invisible to readers; five fabricated first-person articles once
  reached production because the only safeguard was a comment. Placeholder prose
  also keeps `TODO(serhii): verify`.
- **Run scripts before shipping them.** Typecheck and build execute nothing. Two
  shipped scripts failed on first run — top-level await in a CJS transpile, and a
  non-JSON API response. Both would have been caught by running them once.

## Writing a post

`src/content/posts/<slug>.<locale>.mdx`; the filename is the URL. Frontmatter is
a **strict** zod schema (`lib/blog/frontmatter.ts`) — an unknown key is an error,
because `tag:` for `tags:` would silently drop a post from every tag listing.
Required: `title`, `summary`, `date` (a real calendar date, not just the shape).
Optional: `updated`, `tags`, `draft`, and a `fragrance` block (house required,
everything else optional — batch archaeology often starts with the rest unknown).

Translations are independent: a post in one language is listed only there, and
its URL in the other language renders a pointer rather than a dead end. Tags are
per-language and transliterated for URLs (`коди партій` → `kody-partii`).

## Current state

Shipped: bilingual routing, light/dark, bento home, CI + Pages deploy, the
Threads mirror, the Telegram photo mirror, the links directory, the MDX blog
(tag pages, fragrance card, shiki highlighting).

Placeholder routes awaiting real content: `/about` and `/projects`. `blog`
and `projects` are absent from the header nav while there is nothing published
in them; `about` is advertised and currently renders "this page is a
placeholder". One line in `components/layout/header.tsx` controls each.

**`/cv` is real.** Data in `src/content/cv.ts`, schema in `lib/cv`, components in
`components/cv/`. Sourced from the LinkedIn profile rather than
`docs/CV_Serhii_Butko_2025.pdf`, which is a year behind it; the PDF's
contribution is the skills taxonomy. Bilingual by shape rather than by field: a
bare string in `content/cv.ts` is the same in both languages and an `{ en, uk }`
pair is a thing that genuinely differs, which is the name, the months, the
durations, the degrees and the two language rows. Job titles, employers, tooling
and every bullet stay English in both — a translated "Middle DevOps Engineer"
helps nobody. The site header wordmark stays English too; only the CV's own
heading takes the Ukrainian name.

Two things about it that are load-bearing:

- **The stack tiles' `span` is content, not styling.** A tile is as wide as its
  chips need to settle into two rows, and within a row the wider half holds
  more — Azure's eight entries take seven of twelve tracks to Data's four at
  five. Rows must add to exactly twelve or the grid leaves a hole beside the
  last tile in the row: same failure as a seven-tile photo collage, same
  invisibility. `lib/cv` fails the build on it and `npm run test:cv` pins the
  rule, so adding a tool without rebalancing its row is a red build rather than
  a bug nobody sees. **The ORDER of the groups is the pairing**, and it is
  load-bearing for the same reason: AWS needs six tracks and Azure seven, which
  do not fit in one row, so they are dealt into different rows beside partners
  that fit the remainder. The widths cannot be Tailwind utilities either — a
  span utility has to be a literal in the source to be emitted at all — so
  `.stack-mosaic` in `globals.css` takes the number through a custom property.
- **The PDF is not linked yet, and that is a Cloudinary account setting.**
  `npm run cv:upload` puts it at `docs/cv-serhii-butko.pdf` — the extension is
  part of the id, because without it the file is served as
  `application/octet-stream` named `cv-serhii-butko` and `fl_attachment` cannot
  supply a name containing a dot. But this cloud has **PDF and ZIP delivery
  disabled**, which is Cloudinary's default, so every request for it returns
  401 `deny or ACL failure`. Settings → Security → "PDF and ZIP files delivery",
  then re-run the script and paste the version into `content/cv.ts`. Until then
  `resume` is absent and the download button is not rendered — a missing button
  beats a dead link.
- **The portrait is the LinkedIn photograph, re-hosted.** LinkedIn serves it
  from a signed URL that expires, so it cannot be hot-linked; `npm run
cv:portrait -- <path>` uploads a saved copy to `profile/serhii-butko` and
  prints the fields to record. Optional — the card falls back to the gradient
  monogram rather than a broken frame.

**The standing instruction is to fill these in, not to remove them.** Deleting
an empty thing makes the site smaller; the site is meant to get bigger. Both
were briefly removed on 2026-08-27 and restored the same day — do not propose
removal again as the fix for emptiness. What is missing is content, and the
content is Serhii's to supply:

- `links.json` carries four entries whose `href` is still a bare domain —
  Instagram, X, Facebook, Apple Music. Three have `identity: true`, so they
  render `rel="me"`, which is an identity claim. **These need real URLs**, and
  until they have them they are the one genuinely wrong thing the site ships:
  the links page renders each as a full-size branded card.
- `/about` is in the nav and needs real prose behind it.
- `profile.ts` is placeholder copy, and it renders on every page through the
  header and footer.
- `src/content/posts/` is empty. Six fabricated `draft: true` seed posts were
  deleted on 2026-08-27: drafts are stripped whenever `NODE_ENV=production`, so
  they had never reached the live site — mock data nobody could read. The blog
  builds fine empty; both `[slug]` and `tag/[tag]` emit a sentinel param
  because `output: 'export'` rejects an empty `generateStaticParams`. The
  frontmatter contract now lives only in `lib/blog/frontmatter.ts` — read it
  before writing the first real post, and note that a post existing in one
  language only is a supported case, not a mistake.

**Pending Dependabot majors: ESLint 10 and TypeScript 7. Both were tried on
2026-08-27 and both are blocked upstream — by the same lagging ESLint plugin
ecosystem, not by anything in this repo.** Do not spend an afternoon on either
until the upstream box is ticked; nothing here needs changing when it is.

- **ESLint 10 crashes `npm run lint`.** `eslint-config-next@16.3.x` bundles
  `eslint-plugin-react@7.37.5`, which calls the `context.getFilename()` API that
  ESLint 10 removed: `TypeError: contextOrFilename.getFilename is not a
function`. `eslint-plugin-react` has no ESLint 10 release yet, and
  eslint-config-next's `eslint: ">=9.0.0"` peer range is over-permissive — npm
  installs the combination happily and it fails at run time. Recheck when
  `eslint-plugin-react` ships ESLint 10 support — still 7.37.5 as of
  2026-08-31, peering `eslint: ^9.7` at the top.

  **It has been merged once and reverted.** Dependabot #54 took ESLint to
  10.9.1 on 2026-08-31; both `verify` runs on it were red before it landed, and
  once on `main` every subsequent PR's CI failed on the same TypeError —
  including the grouped minor-and-patch bump that was open at the time, which
  looked like a merge conflict rather than what it was. `deploy.yml` does not
  lint, so the live site never noticed and nothing on the site was wrong; only
  CI was. Reverted in #56. A red `verify` on a Dependabot PR is the whole
  safeguard here — this is what merging past one costs.

- **TypeScript 7 breaks lint, not typecheck.** `tsc --noEmit`, the build, both
  script tests and `format:check` all pass clean on 7.0.2. `typescript-eslint`
  then refuses to load at all: `typescript-eslint does not support TS 7.0`.
  Tracking: https://github.com/typescript-eslint/typescript-eslint/issues/10940
  (support for TS >= 7.1). A side-by-side TS 6 install is the documented
  workaround; it is not worth the fragility here, because the ESLint boundary
  rules are load-bearing and typecheck on a repo this size is already instant.

  **It too has been merged once and reverted**, the same way ESLint 10 was.
  Dependabot #2 took TypeScript to 7.0.2 on 2026-09-05 and it reached `main`;
  `npm run lint` and CI's `Lint` step failed on every branch from then on, while
  `deploy.yml` — which does not lint — kept publishing a correct site, so again
  only CI was wrong. Pinned back to `^6.0.3` the same day. The tracking issue is
  for TS **>= 7.1**, so 7.0.x will never be the version that unblocks this: wait
  for a stable 7.1 (only `7.1.0-dev.*` builds exist as of 2026-09-05) and take
  the bump then.

Both are reverted and the lockfile restored, so the tree carries no drift from
the attempt. Take them one at a time when unblocked, verify each, and don't fold
them into feature work.

## Before you call anything done

```
npm run typecheck && npm run lint && npm run format:check && npm run build
npm run test:telegram && npm run test:dedup && npm run test:collage
npm run test:names && npm run test:threads-merge && npm run test:photo-merge
npm run test:shelves && npm run test:media-audit && npm run test:media-url
npm run test:cv && npm run test:threads-name
```

The build must run with `NEXT_PUBLIC_BASE_PATH=/Personal_WebSite` to match CI,
and `NEXT_PUBLIC_CLOUDINARY_CLOUD=<cloud>` **always** — the build fetches its
content snapshots from Cloudinary, so `lib/snapshot.ts` and `lib/media.ts` both
throw without it rather than emitting an empty gallery. A local build therefore
needs network access.

`.env` is not read by `next build` the way you might expect, and sourcing it in a
shell expands any `$` in the Cloudinary secret. Pass the cloud name explicitly,
or use `node --env-file=.env` for scripts (never for `next build` — Turbopack
workers reject `--env-file` in `NODE_OPTIONS`).

Scripts must be **executed**, not just typechecked. `sync-threads.ts` passed
typecheck and build for weeks while failing at runtime on every scheduled run.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
