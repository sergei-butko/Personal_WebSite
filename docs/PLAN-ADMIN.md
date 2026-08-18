# /admin — scope and architecture

The site is a static export on GitHub Pages: no server, no database, no
runtime auth. Everything below is built within that constraint.

**Status:** links directory and Cloudinary media layer shipped. The rest is
specified here and not yet built.

---

## The two decisions that shape everything

**Media lives in Cloudinary, not git.** Uploads go straight from /admin to
Cloudinary; the repo stores only a `publicId` and intrinsic dimensions.
Cloudinary resizes and negotiates AVIF/WebP on its CDN, so uploaded content
needs no sharp pipeline. `lib/media.ts` is the only module that builds a
media URL, so switching to R2 later is one file.

**CMS-editable content cannot be TypeScript.** Sveltia reads JSON, YAML and
Markdown. Anything editable from /admin becomes a data file with a zod schema
guarding it at load — `content/links.json` is the pattern to copy.

---

## Collections

### Albums — `content/albums/<slug>.json`

A Telegram-style grouped post: several photos, ordered, with a caption and an
optional track.

```jsonc
{
  "slug": "kyiv-morning",
  "date": "2026-06-17",
  "title": { "en": "…", "uk": "…" },
  "caption": { "en": "…", "uk": "…" },
  "images": [
    {
      "publicId": "albums/kyiv-1",
      "width": 3000,
      "height": 2000,
      "alt": { "en": "…", "uk": "…" },
    },
  ],
  "music": { "provider": "spotify", "url": "https://open.spotify.com/track/…" },
  "sourceUrl": "https://t.me/just_my_photos/547",
  "draft": true,
}
```

Ordering is the array order — the CMS list widget drags to reorder, which is
the whole point. Uploads here are the originals, at whatever quality you
choose; nothing is re-encoded on the way in.

### Music embeds

`music` holds a provider and a URL, and the site renders the official embed —
Spotify, YouTube, SoundCloud or Apple Music. Nothing is hosted.

This is not only cheaper, it is the only lawful option: the tracks referenced
in the channel (The Offspring, Amy Winehouse) are commercial recordings, and
hosting the audio would be infringement regardless of where the file sat.
Embeds also give listeners the full track rather than a clip.

A `<details>`-style lazy embed is preferred — Spotify's iframe is heavy and
sets third-party cookies before anyone presses play.

### Posts — `content/posts/<slug>.<locale>.mdx`

Already exists. Gains fields for the card format:

```yaml
brand: Chanel # manual grouping, one per post
tags: [niche, edp, woody] # multiselect pills, from a fixed vocabulary
sourceUrl: https://www.threads.com/@sergei_butko/post/…
images: # Cloudinary, same shape as albums
  - publicId: posts/bleu-1
    width: 2000
    height: 1500
```

`brand` is a free-text-with-suggestions field, not an enum: new houses appear
constantly and a build should not fail because one is missing from a list.

`tags` is a fixed vocabulary so the pills stay consistent — a `select` widget
with `multiple: true`. Starting set:

`niche`, `designer`, `luxury`, `edt`, `edp`, `parfum`, `extrait`, `floral`,
`woody`, `chypre`, `fougere`, `oriental`, `fresh`, `gourmand`,
`reformulation`, `vintage`

Brand and tag index pages come free from the existing tag-page machinery.

### Links — `content/links.json`

Shipped. Grouped, bilingual titles, per-link notes, `primary` and `identity`
flags.

---

## Sveltia CMS

```
public/admin/index.html     loads Sveltia from a CDN
public/admin/config.yml     collections, fields, backend
```

```yaml
backend:
  name: github
  repo: sergei-butko/Personal_WebSite
  branch: main
  base_url: https://<worker>.workers.dev
publish_mode: editorial_workflow
media_library:
  name: cloudinary
  config:
    cloud_name: <cloud>
    api_key: <public api key>
```

Cloudinary's API key is publishable — it is the API _secret_ that must never
reach the browser. Unsigned uploads use a named upload preset instead.

### Auth, and what actually secures it

Deploy [`sveltia-cms-auth`](https://github.com/sveltia/sveltia-cms-auth) as a
Cloudflare Worker. Register a GitHub OAuth app with callback
`<worker-url>/callback`; client id and secret go in the Worker's encrypted
env; `ALLOWED_DOMAINS` set to the site host.

**The Worker does not decide who may edit.** It only completes an OAuth
handshake. Authorisation is GitHub's: a token can only commit where its user
already has write access, and this repo has one collaborator. Anyone else can
reach /admin and log in; GitHub refuses them on the first save.

Worth stating plainly because the instinct — a password field on a static
page — secures nothing. It ships to the browser.

### Expect

- Saving is a git commit: live in ~2 minutes via CI, not instantly.
- `editorial_workflow` turns saves into PRs. Recommended, after the
  seed-post incident.
- `/admin` sits in `public/`, so `[locale]` routing never touches it.

### Verify before building it out

Sveltia is a Markdown CMS; these posts are MDX with JSX components
(`<Callout>`, `<Compare>`). Open one post, save it unchanged, diff it. If JSX
survives, continue. If not: restrict the CMS to prose-only posts, or drop JSX
in favour of Markdown with styled classes. **Do not find this out after
migrating everything.**

---

## Migrating the 400 committed photos

Decided: move them to Cloudinary and purge the blobs from history.

This rewrites every commit hash and needs a force-push. Order matters.

1. **Upload.** `scripts/migrate-photos-to-cloudinary.ts` reads
   `photos.generated.ts`, uploads each original to Cloudinary under
   `photos/<telegram-id>-<n>`, and writes a new snapshot holding `publicId`
   plus dimensions. Idempotent — skips ids already present.
2. **Verify.** Build and confirm every image resolves from the CDN. Keep the
   local files until this passes.
3. **Repoint the sync.** `sync-telegram.ts` stops downloading and
   re-encoding; it uploads to Cloudinary and records the `publicId`.
4. **Delete** `public/images/photos/` and commit.
5. **Purge history**, only once 1–4 are merged and verified:
   ```bash
   git clone --mirror <repo> purge && cd purge
   git filter-repo --path public/images/photos --invert-paths
   git push --force --all && git push --force --tags
   ```
6. **Re-clone.** Every existing clone is now invalid — delete and clone
   fresh. Do not merge an old clone back in; it would reintroduce the blobs.

Take a backup clone before step 5. `git filter-repo` is not reversible.

---

## Order of work

1. Album collection, gallery rendering, music embeds.
2. Post card fields — brand, tags, images, source link — and index pages.
3. Sveltia round-trip test on one post.
4. Worker + OAuth app; `/admin` config and collections.
5. Photo migration, then the history purge as its own change.
