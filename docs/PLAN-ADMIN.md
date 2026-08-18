# Editable Threads mirror + /admin

Spec for a later phase. Two changes that depend on each other.
Blocked on Meta account access; Telegram photos are being done first.

---

## Why the current Threads mirror has to change

It writes `src/content/threads.generated.ts` and re-writes it every six
hours. Editing that file is pointless — the next cron overwrites it. Serhii
wants mirrored posts **fully copied, stored, and editable**, so the sync has
to stop producing a generated artefact and start producing content files.

## A. Sync writes MDX, not a data file

`scripts/sync-threads.ts` changes its output to:

```
src/content/posts/threads-<sourceId>.<locale>.mdx
```

Frontmatter:

```yaml
title: <first line, trimmed to ~70 chars, ellipsis if cut>
date: <post timestamp, YYYY-MM-DD>
summary: <first ~160 chars of body>
tags: ['threads']
source: threads
sourceId: '<Threads media id>'
sourceUrl: <permalink>
draft: true # ALWAYS. Nothing auto-publishes.
```

**The one rule that matters: never overwrite an existing file.** Match on
`sourceId`. If a file for that id exists in any locale, skip it entirely —
do not diff, do not merge, do not touch. Serhii's edits win permanently. The
cron only ever adds posts it has never seen.

`draft: true` on every import is deliberate: a synced post is raw material,
not something that should appear because a cron ran.

Locale: imports land in one configured default (`SYNC_DEFAULT_LOCALE`,
default `uk`). Translating means creating the sibling file by hand, same as
any other post.

Images: unchanged. Downloaded, re-encoded to AVIF + WebP, never hotlinked.

**Retire what the mirror needed and the blog does not:**
`src/content/threads.generated.ts`, `src/lib/threads.ts`,
`ThreadsPostCard.tsx`, `ThreadsImage.tsx`, `/[locale]/threads/`, and the
home-page Threads tile. Mirrored posts become blog posts under a `threads`
tag. Keep `docs/SETUP-THREADS.md`.

## B. /admin — Sveltia CMS

A git-based CMS. `/admin` is a static page that authenticates with GitHub and
commits straight to this repo. The site stays on GitHub Pages.

```
public/admin/index.html     loads Sveltia CMS from a CDN
public/admin/config.yml     collections, fields, backend
```

```yaml
backend:
  name: github
  repo: sergei-butko/Personal_WebSite
  branch: main
  base_url: https://<worker>.workers.dev # the OAuth broker
publish_mode: editorial_workflow # saves land as PRs
media_folder: public/images/uploads
public_folder: /Personal_WebSite/images/uploads # basePath applies here
```

Collections: `posts` (folder `src/content/posts`, pattern
`<slug>.<locale>.mdx`) with a field per frontmatter key — `draft` as a
visible toggle, `fragrance` as a nested group. Optionally `profile` and
`social` as file collections.

### Auth, and what actually secures it

Deploy [`sveltia-cms-auth`](https://github.com/sveltia/sveltia-cms-auth) as a
Cloudflare Worker (free tier). Register a GitHub OAuth app with callback
`<worker-url>/callback`, put client id and secret in the Worker's encrypted
env, set `ALLOWED_DOMAINS` to `sergei-butko.github.io`.

**The Worker does not decide who may edit, and does not need to.** It only
completes an OAuth handshake. Authorisation is GitHub's: a token can only
commit where its user already has write access. This repo has one
collaborator, so only Serhii can save. Anyone else reaching `/admin` can log
in and will be refused by GitHub on the first write.

Worth stating because the alternative people reach for — a password check in
a static page — is not security. It ships to the browser.

### What to expect

- Saving is a git commit, so a change goes live via CI in a couple of
  minutes. Not instant; that is the trade for having no server.
- With `editorial_workflow`, saves become PRs — a second chance to catch
  something before it is public. Recommended after the seed-post incident.
- `/admin` lives in `public/`, so it is served as-is and never touched by the
  `[locale]` routing.

### Verify early, before building the rest

Sveltia is a Markdown CMS. These posts are **MDX with JSX components**
(`<Callout>`, `<Compare>`). Before wiring up every collection, open one
existing post in the CMS, save it unchanged, and diff. If JSX survives
round-tripping, proceed. If it is mangled: restrict the CMS to
frontmatter-plus-prose posts, or drop JSX from MDX in favour of plain
Markdown with styled classes. **Do not discover this after migrating
everything.**

## Order

1. Sync → MDX, never-overwrite, `draft: true`. Retire the old surface.
2. Sveltia round-trip test on one post.
3. Worker + OAuth app, then `/admin` config and collections.
